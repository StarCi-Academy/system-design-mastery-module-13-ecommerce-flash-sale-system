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
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
)

const (
	pendingMarker = "PENDING"
	pendingTTL    = 30 * time.Second
	resultTTL     = 24 * time.Hour
)

// CreateOrderRequest is the POST /api/checkout/order body.
type CreateOrderRequest struct {
	Amount string `json:"amount"`
	Sku    string `json:"sku"`
}

// OrderResponse is the canonical success response shared by all languages.
type OrderResponse struct {
	OrderID  string `json:"orderId"`
	Status   string `json:"status"`
	Amount   string `json:"amount"`
	Replayed bool   `json:"replayed"`
}

type Handler struct {
	rdb     *redis.Client
	db      *pgxpool.Pool
	delayMs int
}

func env(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

func main() {
	ctx := context.Background()

	rdb := redis.NewClient(&redis.Options{
		Addr: env("REDIS_HOST", "localhost") + ":" + env("REDIS_PORT", "6379"),
	})

	dsn := fmt.Sprintf("postgres://%s:%s@%s:%s/%s",
		env("POSTGRES_USER", "postgres"),
		env("POSTGRES_PASSWORD", "postgres"),
		env("POSTGRES_HOST", "localhost"),
		env("POSTGRES_PORT", "5432"),
		env("POSTGRES_DB", "checkout"),
	)
	db, err := pgxpool.New(ctx, dsn)
	if err != nil {
		log.Fatalf("pgx connect: %v", err)
	}
	if err := migrate(ctx, db); err != nil {
		log.Fatalf("migrate: %v", err)
	}

	delayMs, _ := strconv.Atoi(env("CHECKOUT_PROCESSING_DELAY_MS", "1500"))
	h := &Handler{rdb: rdb, db: db, delayMs: delayMs}

	mux := http.NewServeMux()
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})
	mux.HandleFunc("/api/checkout/order", h.handleCheckout)

	port := env("PORT", "3031")
	log.Printf("checkout-service listening on :%s", port)
	log.Fatal(http.ListenAndServe("0.0.0.0:"+port, mux))
}

// migrate creates the orders table with a UNIQUE(idempotency_key) constraint.
func migrate(ctx context.Context, db *pgxpool.Pool) error {
	_, err := db.Exec(ctx, `
		CREATE TABLE IF NOT EXISTS orders (
			id              UUID PRIMARY KEY,
			idempotency_key VARCHAR(128) NOT NULL,
			status          VARCHAR(16)  NOT NULL,
			amount          NUMERIC(12,2) NOT NULL,
			sku             VARCHAR(64)  NOT NULL,
			CONSTRAINT uq_orders_idempotency_key UNIQUE (idempotency_key)
		)`)
	return err
}

func (h *Handler) handleCheckout(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"message": "method not allowed"})
		return
	}
	key := r.Header.Get("Idempotency-Key")
	if key == "" {
		key = "missing-idempotency-key"
	}
	var req CreateOrderRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": "invalid body"})
		return
	}

	ctx := r.Context()
	redisKey := "idempotency:" + key

	// SET NX is atomic first-wins: exactly one concurrent caller claims the key.
	won, err := h.rdb.SetNX(ctx, redisKey, pendingMarker, pendingTTL).Result()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"message": "idempotency store unavailable"})
		return
	}

	if !won {
		// Key already exists: still PENDING (409) or a cached result (200 replay).
		val, gErr := h.rdb.Get(ctx, redisKey).Result()
		if gErr == nil && val == pendingMarker {
			writeJSON(w, http.StatusConflict, map[string]any{
				"statusCode":     409,
				"message":        "Request in progress",
				"idempotencyKey": key,
			})
			return
		}
		var cached OrderResponse
		if gErr == nil && json.Unmarshal([]byte(val), &cached) == nil {
			cached.Replayed = true
			writeJSON(w, http.StatusOK, cached)
			return
		}
		writeJSON(w, http.StatusConflict, map[string]any{
			"statusCode":     409,
			"message":        "Request in progress",
			"idempotencyKey": key,
		})
		return
	}

	// We won the claim. Widen the PENDING window so the race is observable.
	time.Sleep(time.Duration(h.delayMs) * time.Millisecond)

	order, err := h.createOrder(ctx, key, req)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"message": "failed to create order"})
		return
	}

	resp := OrderResponse{OrderID: order.ID, Status: order.Status, Amount: order.Amount, Replayed: false}
	payload, _ := json.Marshal(resp)
	h.rdb.Set(ctx, redisKey, payload, resultTTL)
	writeJSON(w, http.StatusCreated, resp)
}

type order struct {
	ID     string
	Status string
	Amount string
}

func (h *Handler) createOrder(ctx context.Context, key string, req CreateOrderRequest) (order, error) {
	id := uuid.NewString()
	_, err := h.db.Exec(ctx,
		`INSERT INTO orders (id, idempotency_key, status, amount, sku) VALUES ($1,$2,$3,$4,$5)`,
		id, key, "CONFIRMED", req.Amount, req.Sku)
	if err != nil {
		// Last-line defense: UNIQUE(idempotency_key) rejects a duplicate insert.
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			row := h.db.QueryRow(ctx,
				`SELECT id, status, amount::text FROM orders WHERE idempotency_key=$1`, key)
			var ex order
			if sErr := row.Scan(&ex.ID, &ex.Status, &ex.Amount); sErr != nil && !errors.Is(sErr, pgx.ErrNoRows) {
				return order{}, sErr
			}
			return ex, nil
		}
		return order{}, err
	}
	return order{ID: id, Status: "CONFIRMED", Amount: req.Amount}, nil
}

func writeJSON(w http.ResponseWriter, code int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(body)
}
