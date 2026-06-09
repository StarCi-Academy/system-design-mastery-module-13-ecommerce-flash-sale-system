package com.starci.waitingroom;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ZSetOperations;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Service
public class WaitingRoomService {

    private static final String QUEUE_KEY = "waitingroom:queue";
    private static final String ADMITTED_KEY = "waitingroom:admitted";

    private final StringRedisTemplate redis;
    private final Duration admittedTtl;

    public WaitingRoomService(StringRedisTemplate redis,
                              @Value("${app.admitted.ttl-seconds}") long ttlSeconds) {
        this.redis = redis;
        this.admittedTtl = Duration.ofSeconds(ttlSeconds);
    }

    /**
     * Enqueue a fresh token scored by arrival time in milliseconds.
     * The sorted set keeps members ordered by score (FIFO). Returns a
     * 1-based position so the earliest arrival sees "1".
     */
    public TokenResult enqueue() {
        String token = UUID.randomUUID().toString();
        long score = System.currentTimeMillis();
        // ZADD NX never overwrites an existing member's original score.
        redis.opsForZSet().addIfAbsent(QUEUE_KEY, token, score);
        Long rank = redis.opsForZSet().rank(QUEUE_KEY, token);
        return new TokenResult(token, (rank == null ? 0L : rank) + 1);
    }

    /**
     * Look up a token's 1-based place in line. Checks the admitted set first,
     * then ZRANK. position is null when the token is admitted or unknown.
     */
    public PositionResult position(String token) {
        Boolean admitted = redis.opsForSet().isMember(ADMITTED_KEY, token);
        if (Boolean.TRUE.equals(admitted)) {
            return new PositionResult(token, null, true);
        }
        Long rank = redis.opsForZSet().rank(QUEUE_KEY, token);
        return new PositionResult(token, rank == null ? null : rank + 1, false);
    }

    /**
     * Admit the front N tokens. ZPOPMIN atomically removes the N lowest-scored
     * members (the longest waiters), which then enter the TTL-backed admitted set.
     */
    public AdmitResult admit(int count) {
        Set<ZSetOperations.TypedTuple<String>> popped =
                redis.opsForZSet().popMin(QUEUE_KEY, count);
        List<String> tokens = new ArrayList<>();
        if (popped != null) {
            for (ZSetOperations.TypedTuple<String> entry : popped) {
                if (entry.getValue() != null) {
                    tokens.add(entry.getValue());
                }
            }
        }
        if (tokens.isEmpty()) {
            return new AdmitResult(tokens, 0);
        }
        redis.opsForSet().add(ADMITTED_KEY, tokens.toArray(new String[0]));
        redis.expire(ADMITTED_KEY, admittedTtl);
        return new AdmitResult(tokens, tokens.size());
    }

    /**
     * Report admitted / waiting / unknown plus the 1-based position.
     */
    public StatusResult status(String token) {
        Boolean admitted = redis.opsForSet().isMember(ADMITTED_KEY, token);
        if (Boolean.TRUE.equals(admitted)) {
            return new StatusResult(token, "admitted", null);
        }
        Long rank = redis.opsForZSet().rank(QUEUE_KEY, token);
        if (rank == null) {
            return new StatusResult(token, "unknown", null);
        }
        return new StatusResult(token, "waiting", rank + 1);
    }

    public record TokenResult(String token, Long position) {}

    public record PositionResult(String token, Long position, boolean admitted) {}

    public record AdmitResult(List<String> admitted, int count) {}

    public record StatusResult(String token, String state, Long position) {}
}
