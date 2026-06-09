package main

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
)

const (
	queueKey    = "waitingroom:queue"
	admittedKey = "waitingroom:admitted"
)

// WaitingRoom owns the shared Redis client and the admitted-set TTL.
type WaitingRoom struct {
	rdb         *redis.Client
	admittedTTL time.Duration
}

// NewWaitingRoom builds a WaitingRoom with one shared go-redis client.
func NewWaitingRoom(rdb *redis.Client, ttl time.Duration) *WaitingRoom {
	return &WaitingRoom{rdb: rdb, admittedTTL: ttl}
}

// Enqueue hands out a token and places it in the queue with score = arrival ms.
// The sorted set keeps members ordered by score, so the earliest arrival sits
// at rank 0 (FIFO fairness). Returns a 1-based position.
func (w *WaitingRoom) Enqueue(ctx context.Context) (string, int64, error) {
	token := uuid.NewString()
	score := float64(time.Now().UnixMilli())
	// ZADD NX never overwrites an existing member's original score.
	if err := w.rdb.ZAddNX(ctx, queueKey, redis.Z{Score: score, Member: token}).Err(); err != nil {
		return "", 0, err
	}
	rank, err := w.rdb.ZRank(ctx, queueKey, token).Result()
	if err != nil {
		return "", 0, err
	}
	return token, rank + 1, nil
}

// Position returns a token's 1-based place in line and whether it is admitted.
// position is -1 (rendered as null) when the token is not waiting.
func (w *WaitingRoom) Position(ctx context.Context, token string) (int64, bool, error) {
	isAdmitted, err := w.rdb.SIsMember(ctx, admittedKey, token).Result()
	if err != nil {
		return -1, false, err
	}
	if isAdmitted {
		return -1, true, nil
	}
	rank, err := w.rdb.ZRank(ctx, queueKey, token).Result()
	if err == redis.Nil {
		return -1, false, nil
	}
	if err != nil {
		return -1, false, err
	}
	return rank + 1, false, nil
}

// Admit pops the front N tokens (lowest score = longest waiters) atomically
// and moves them into the admitted set, refreshing its TTL.
func (w *WaitingRoom) Admit(ctx context.Context, count int64) ([]string, error) {
	popped, err := w.rdb.ZPopMin(ctx, queueKey, count).Result()
	if err != nil {
		return nil, err
	}
	tokens := make([]string, 0, len(popped))
	for _, z := range popped {
		if s, ok := z.Member.(string); ok {
			tokens = append(tokens, s)
		}
	}
	if len(tokens) == 0 {
		return tokens, nil
	}
	members := make([]interface{}, len(tokens))
	for i, t := range tokens {
		members[i] = t
	}
	if err := w.rdb.SAdd(ctx, admittedKey, members...).Err(); err != nil {
		return nil, err
	}
	if err := w.rdb.Expire(ctx, admittedKey, w.admittedTTL).Err(); err != nil {
		return nil, err
	}
	return tokens, nil
}

// Status reports admitted / waiting / unknown plus the 1-based position.
func (w *WaitingRoom) Status(ctx context.Context, token string) (string, int64, error) {
	isAdmitted, err := w.rdb.SIsMember(ctx, admittedKey, token).Result()
	if err != nil {
		return "", -1, err
	}
	if isAdmitted {
		return "admitted", -1, nil
	}
	rank, err := w.rdb.ZRank(ctx, queueKey, token).Result()
	if err == redis.Nil {
		return "unknown", -1, nil
	}
	if err != nil {
		return "", -1, err
	}
	return "waiting", rank + 1, nil
}
