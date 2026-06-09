package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"math"
	"net/http"

	"github.com/redis/go-redis/v9"
)

// nullableInt renders a 1-based position, or null when not waiting.
func nullableInt(v int64) interface{} {
	if v < 0 {
		return nil
	}
	return v
}

func writeJSON(w http.ResponseWriter, status int, body interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}

func main() {
	cfg := LoadConfig()
	rdb := redis.NewClient(&redis.Options{
		Addr: fmt.Sprintf("%s:%d", cfg.RedisHost, cfg.RedisPort),
	})
	room := NewWaitingRoom(rdb, cfg.AdmittedTTL)
	ctx := context.Background()

	mux := http.NewServeMux()

	mux.HandleFunc("/health", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})

	mux.HandleFunc("/api/waitingroom/token", func(w http.ResponseWriter, _ *http.Request) {
		token, position, err := room.Enqueue(ctx)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, map[string]interface{}{"token": token, "position": position})
	})

	mux.HandleFunc("/api/waitingroom/position", func(w http.ResponseWriter, r *http.Request) {
		token := r.URL.Query().Get("token")
		position, admitted, err := room.Position(ctx, token)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, map[string]interface{}{
			"token": token, "position": nullableInt(position), "admitted": admitted,
		})
	})

	mux.HandleFunc("/api/waitingroom/admit", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
			return
		}
		var body struct {
			Count *int `json:"count"`
		}
		_ = json.NewDecoder(r.Body).Decode(&body)
		count := 1
		if body.Count != nil {
			count = int(math.Max(1, float64(*body.Count)))
		}
		tokens, err := room.Admit(ctx, int64(count))
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, map[string]interface{}{"admitted": tokens, "count": len(tokens)})
	})

	mux.HandleFunc("/api/waitingroom/status", func(w http.ResponseWriter, r *http.Request) {
		token := r.URL.Query().Get("token")
		state, position, err := room.Status(ctx, token)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, map[string]interface{}{
			"token": token, "state": state, "position": nullableInt(position),
		})
	})

	addr := ":" + cfg.Port
	log.Printf("waiting-room-api listening on %s", addr)
	if err := http.ListenAndServe(addr, mux); err != nil {
		log.Fatal(err)
	}
}
