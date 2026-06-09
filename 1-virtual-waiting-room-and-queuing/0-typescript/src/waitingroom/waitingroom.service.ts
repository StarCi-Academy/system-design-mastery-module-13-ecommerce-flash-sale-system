import { Inject, Injectable } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import Redis from "ioredis"
import { randomUUID } from "crypto"
import { REDIS_CLIENT } from "./redis.provider"

export type WaitingState = "admitted" | "waiting" | "unknown"

@Injectable()
export class WaitingRoomService {
    private readonly QUEUE_KEY = "waitingroom:queue"
    private readonly ADMITTED_KEY = "waitingroom:admitted"
    private readonly admittedTtlSec: number

    public constructor(
        @Inject(REDIS_CLIENT) private readonly redis: Redis,
        cs: ConfigService,
    ) {
        this.admittedTtlSec = cs.get<number>("app.admittedTtlSec") ?? 300
    }

    /**
     * Enqueue a fresh token scored by enqueue time in milliseconds.
     * The ZSET keeps members ordered by score, so the earliest arrival
     * sits at rank 0 (FIFO fairness). Returns a 1-based position.
     */
    public async enqueue(): Promise<{ token: string; position: number }> {
        const token = randomUUID()
        const score = Date.now()
        // ZADD NX never overwrites an existing member's original score.
        await this.redis.zadd(this.QUEUE_KEY, "NX", score, token)
        const rank = await this.redis.zrank(this.QUEUE_KEY, token)
        return { token, position: (rank ?? 0) + 1 }
    }

    /**
     * Look up a token's place in line. Checks the admitted SET first
     * (O(1) SISMEMBER), then ZRANK (O(log N)). position is null when the
     * token was never enqueued or has already been admitted/expired.
     */
    public async position(
        token: string,
    ): Promise<{ token: string; position: number | null; admitted: boolean }> {
        const admitted = (await this.redis.sismember(this.ADMITTED_KEY, token)) === 1
        if (admitted) return { token, position: null, admitted: true }
        const rank = await this.redis.zrank(this.QUEUE_KEY, token)
        return { token, position: rank === null ? null : rank + 1, admitted: false }
    }

    /**
     * Admit the front N tokens. ZPOPMIN atomically removes the N members
     * with the lowest scores (the longest waiters), then they are added to
     * the admitted SET whose TTL is refreshed so abandoned grants expire.
     */
    public async admit(count: number): Promise<{ admitted: string[]; count: number }> {
        const popped = await this.redis.zpopmin(this.QUEUE_KEY, count)
        // ioredis returns a flat [member, score, member, score, ...] array.
        const tokens: string[] = []
        for (let i = 0; i < popped.length; i += 2) tokens.push(popped[i])
        if (tokens.length === 0) return { admitted: [], count: 0 }
        await this.redis.sadd(this.ADMITTED_KEY, ...tokens)
        await this.redis.expire(this.ADMITTED_KEY, this.admittedTtlSec)
        return { admitted: tokens, count: tokens.length }
    }

    /**
     * Report whether a token is admitted, still waiting (with its 1-based
     * position), or unknown (never enqueued / already left).
     */
    public async status(
        token: string,
    ): Promise<{ token: string; state: WaitingState; position: number | null }> {
        const admitted = (await this.redis.sismember(this.ADMITTED_KEY, token)) === 1
        if (admitted) return { token, state: "admitted", position: null }
        const rank = await this.redis.zrank(this.QUEUE_KEY, token)
        if (rank === null) return { token, state: "unknown", position: null }
        return { token, state: "waiting", position: rank + 1 }
    }
}
