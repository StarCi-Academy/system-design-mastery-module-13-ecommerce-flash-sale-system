package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
)

// Config holds settings read once from the environment (config layer).
type Config struct {
	Port             string
	RedisAddr        string
	PostgresDSN      string
}

func loadConfig() Config {
	get := func(k, def string) string {
		if v := os.Getenv(k); v != "" {
			return v
		}
		return def
	}
	return Config{
		Port:      get("PORT", "3029"),
		RedisAddr: fmt.Sprintf("%s:%s", get("REDIS_HOST", "localhost"), get("REDIS_PORT", "6379")),
		PostgresDSN: fmt.Sprintf(
			"host=%s port=%s user=%s password=%s dbname=%s sslmode=disable",
			get("POSTGRES_HOST", "localhost"), get("POSTGRES_PORT", "5432"),
			get("POSTGRES_USER", "postgres"), get("POSTGRES_PASSWORD", "postgres"),
			get("POSTGRES_DB", "inventory_service"),
		),
	}
}

const seededSKU = "IPHONE15"

// decrementLua runs single-threaded inside Redis: check-and-decrement is one indivisible step.
const decrementLua = `
local stock = tonumber(redis.call('GET', KEYS[1]))
if stock == nil then return -1 end
if stock < tonumber(ARGV[1]) then return -2 end
return redis.call('DECRBY', KEYS[1], ARGV[1])
`

var (
	errUnknownSKU = errors.New("unknown_sku")
	errOutOfStock = errors.New("insufficient_stock")
)

// Server bundles the shared Redis client and Postgres pool.
type Server struct {
	rdb *redis.Client
	db  *pgxpool.Pool
}

// decrementRedis ships the Lua script to Redis; GET+check+DECRBY run atomically in one round-trip.
func (s *Server) decrementRedis(ctx context.Context, sku string, qty int64) (int64, error) {
	result, err := s.rdb.Eval(ctx, decrementLua, []string{"stock:" + sku}, qty).Int64()
	if err != nil {
		return 0, err
	}
	switch result {
	case -1:
		return 0, errUnknownSKU
	case -2:
		return 0, errOutOfStock
	}
	return result, nil
}

// decrementDb takes a pessimistic row lock (SELECT ... FOR UPDATE) inside one transaction.
func (s *Server) decrementDb(ctx context.Context, sku string, qty int64) (int64, error) {
	var remaining int64
	err := pgx.BeginFunc(ctx, s.db, func(tx pgx.Tx) error {
		var stock int64
		row := tx.QueryRow(ctx, "SELECT stock FROM inventories WHERE sku = $1 FOR UPDATE", sku)
		if err := row.Scan(&stock); err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return errUnknownSKU
			}
			return err
		}
		if stock < qty {
			return errOutOfStock
		}
		remaining = stock - qty
		if _, err := tx.Exec(ctx, "UPDATE inventories SET stock = $1 WHERE sku = $2", remaining, sku); err != nil {
			return err
		}
		// Append the audit row in the same transaction.
		_, err := tx.Exec(ctx,
			"INSERT INTO inventory_ledgers (sku, delta, remaining) VALUES ($1, $2, $3)",
			sku, -qty, remaining)
		return err
	})
	return remaining, err
}

type ledgerEntry struct {
	Delta     int64 `json:"delta"`
	Remaining int64 `json:"remaining"`
}

func (s *Server) readStock(ctx context.Context, sku string) (map[string]any, error) {
	var dbStock int64
	row := s.db.QueryRow(ctx, "SELECT stock FROM inventories WHERE sku = $1", sku)
	if err := row.Scan(&dbStock); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, errUnknownSKU
		}
		return nil, err
	}

	redisStock := int64(-1)
	if raw, err := s.rdb.Get(ctx, "stock:"+sku).Result(); err == nil {
		if v, perr := strconv.ParseInt(raw, 10, 64); perr == nil {
			redisStock = v
		}
	}

	rows, err := s.db.Query(ctx, "SELECT delta, remaining FROM inventory_ledgers WHERE sku = $1 ORDER BY id ASC", sku)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	ledger := []ledgerEntry{}
	for rows.Next() {
		var e ledgerEntry
		if err := rows.Scan(&e.Delta, &e.Remaining); err != nil {
			return nil, err
		}
		ledger = append(ledger, e)
	}

	return map[string]any{
		"sku":        sku,
		"dbStock":    dbStock,
		"redisStock": redisStock,
		"ledger":     ledger,
	}, nil
}

type decrementReq struct {
	SKU      string `json:"sku"`
	Quantity int64  `json:"quantity"`
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}

// errorStatus maps a service error to the canonical HTTP envelope shared by all languages.
func (s *Server) handleError(w http.ResponseWriter, sku string, err error) {
	if errors.Is(err, errUnknownSKU) {
		writeJSON(w, http.StatusNotFound, map[string]any{"error": "unknown_sku", "sku": sku})
		return
	}
	if errors.Is(err, errOutOfStock) {
		remaining := int64(0)
		if snap, serr := s.readStock(context.Background(), sku); serr == nil {
			if rs, ok := snap["redisStock"].(int64); ok && rs >= 0 {
				remaining = rs
			} else if ds, ok := snap["dbStock"].(int64); ok {
				remaining = ds
			}
		}
		writeJSON(w, http.StatusConflict, map[string]any{"error": "insufficient_stock", "sku": sku, "remaining": remaining})
		return
	}
	writeJSON(w, http.StatusInternalServerError, map[string]any{"error": "internal_error"})
}

func (s *Server) decrementHandler(strategy string, fn func(context.Context, string, int64) (int64, error)) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req decrementReq
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.SKU == "" || req.Quantity <= 0 {
			writeJSON(w, http.StatusBadRequest, map[string]any{"error": "bad_request"})
			return
		}
		remaining, err := fn(r.Context(), req.SKU, req.Quantity)
		if err != nil {
			s.handleError(w, req.SKU, err)
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"sku": req.SKU, "strategy": strategy, "remaining": remaining})
	}
}

func (s *Server) stockHandler(w http.ResponseWriter, r *http.Request) {
	sku := strings.TrimPrefix(r.URL.Path, "/api/inventory/stock/")
	if sku == "" {
		writeJSON(w, http.StatusBadRequest, map[string]any{"error": "bad_request"})
		return
	}
	snap, err := s.readStock(r.Context(), sku)
	if err != nil {
		s.handleError(w, sku, err)
		return
	}
	writeJSON(w, http.StatusOK, snap)
}

func main() {
	cfg := loadConfig()
	ctx := context.Background()

	rdb := redis.NewClient(&redis.Options{Addr: cfg.RedisAddr})
	// We never run migrations: seed.sql is the authoritative schema source.
	db, err := pgxpool.New(ctx, cfg.PostgresDSN)
	if err != nil {
		log.Fatalf("postgres: %v", err)
	}
	defer db.Close()

	srv := &Server{rdb: rdb, db: db}

	// Warm the hot Redis counter from the authoritative DB stock on startup.
	if snap, err := srv.readStock(ctx, seededSKU); err == nil {
		if ds, ok := snap["dbStock"].(int64); ok {
			rdb.Set(ctx, "stock:"+seededSKU, strconv.FormatInt(ds, 10), 0)
		}
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/api/inventory/decrement/redis", srv.decrementHandler("redis-lua", srv.decrementRedis))
	mux.HandleFunc("/api/inventory/decrement/db", srv.decrementHandler("db-pessimistic-lock", srv.decrementDb))
	mux.HandleFunc("/api/inventory/stock/", srv.stockHandler)

	addr := ":" + cfg.Port
	log.Printf("inventory-service listening on %s", addr)
	if err := http.ListenAndServe(addr, mux); err != nil {
		log.Fatal(err)
	}
}
