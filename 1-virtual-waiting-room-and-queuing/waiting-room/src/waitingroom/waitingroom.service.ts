/**
 * Service phòng chờ ảo — Redis ZSET queue.
 * (EN: Virtual waiting room service — Redis ZSET queue.)
 */
import {
    Injectable,
    OnModuleDestroy,
    OnModuleInit,
} from "@nestjs/common"
import {
    ConfigService,
} from "@nestjs/config"
import Redis from "ioredis"
import type {
    RedisConfig,
} from "../config"
import {
    WAITING_ROOM_ADMITTED_KEY,
    WAITING_ROOM_ADMITTED_TTL_SEC,
    WAITING_ROOM_DEFAULT_ADMIT_COUNT,
    WAITING_ROOM_QUEUE_KEY,
} from "../constants"

@Injectable()
export class WaitingroomService implements OnModuleInit, OnModuleDestroy {
    private redis!: Redis

    constructor(
        private readonly config: ConfigService,
    ) {}

    /**
     * Logic — khởi tạo Redis.
     * Code — OnModuleInit → ioredis.
     * (EN Logic: Initialize Redis.)
     * (EN Code: OnModuleInit → ioredis.)
     */
    onModuleInit(): void {
        const redis = this.config.getOrThrow<RedisConfig>("redis")
        this.redis = new Redis({
            host: redis.host,
            port: redis.port,
            lazyConnect: true,
        })
    }

    /**
     * Logic — đóng Redis.
     * Code — OnModuleDestroy → quit().
     * (EN Logic: Close Redis.)
     * (EN Code: OnModuleDestroy → quit().)
     */
    async onModuleDestroy(): Promise<void> {
        await this.redis?.quit()
    }

    /**
     * Logic — user vào hàng đợi, nhận token + vị trí.
     * Code — ZADD queue score=now nếu chưa có member.
     * (EN Logic: Enqueue user and return token + position.)
     * (EN Code: ZADD with timestamp score.)
     */
    async issueToken(userId: string) {
        await this.connectRedis()
        const score = Date.now()
        const added = await this.redis.zadd(WAITING_ROOM_QUEUE_KEY, "NX", score, userId)
        const rank = await this.redis.zrank(WAITING_ROOM_QUEUE_KEY, userId)
        const position = rank == null ? null : rank + 1
        const queueSize = await this.redis.zcard(WAITING_ROOM_QUEUE_KEY)
        return {
            userId,
            queueToken: `wr_${userId}`,
            position,
            queueSize,
            newlyEnqueued: added > 0,
            redisStructure: "sorted-set",
            redisKey: WAITING_ROOM_QUEUE_KEY,
            scoreField: "enqueue-timestamp-ms",
            admitEndpoint: "POST /api/waitingroom/admit",
        }
    }

    /**
     * Logic — đọc vị trí hiện tại trong queue.
     * Code — ZRANK → position = rank + 1.
     * (EN Logic: Current queue position.)
     * (EN Code: ZRANK + 1.)
     */
    async getPosition(userId: string) {
        await this.connectRedis()
        const rank = await this.redis.zrank(WAITING_ROOM_QUEUE_KEY, userId)
        return {
            userId,
            position: rank == null ? null : rank + 1,
            inQueue: rank != null,
            redisCommand: "ZRANK",
        }
    }

    /**
     * Logic — admit thủ công: ZRANGE top N → SADD admitted → ZREM khỏi queue.
     * Code — POST admit body count.
     * (EN Logic: Manual batch admit from queue head.)
     * (EN Code: ZRANGE + SADD + ZREM.)
     */
    async admitUsers(count: number) {
        await this.connectRedis()
        const batch = Math.max(1, Math.floor(count))
        const topUsers = await this.redis.zrange(
            WAITING_ROOM_QUEUE_KEY,
            0,
            batch - 1,
        )
        if (topUsers.length > 0) {
            const pipeline = this.redis.pipeline()
            for (const user of topUsers) {
                pipeline.sadd(WAITING_ROOM_ADMITTED_KEY, user)
                pipeline.zrem(WAITING_ROOM_QUEUE_KEY, user)
            }
            pipeline.expire(WAITING_ROOM_ADMITTED_KEY, WAITING_ROOM_ADMITTED_TTL_SEC)
            await pipeline.exec()
        }
        const queueRemaining = await this.redis.zcard(WAITING_ROOM_QUEUE_KEY)
        return {
            admittedCount: topUsers.length,
            admittedUserIds: topUsers,
            queueRemaining,
            redisCommands: ["ZRANGE", "SADD", "ZREM", "EXPIRE"],
            admittedKey: WAITING_ROOM_ADMITTED_KEY,
            admittedTtlSeconds: WAITING_ROOM_ADMITTED_TTL_SEC,
            defaultAdmitCount: WAITING_ROOM_DEFAULT_ADMIT_COUNT,
        }
    }

    /**
     * Logic — admitted nếu có trong SET; còn trong queue thì waiting.
     * Code — SISMEMBER admitted; else ZRANK queue.
     * (EN Logic: Admitted SET membership or waiting in ZSET.)
     * (EN Code: SISMEMBER + ZRANK.)
     */
    async getStatus(userId: string) {
        await this.connectRedis()
        const isAdmitted = (await this.redis.sismember(
            WAITING_ROOM_ADMITTED_KEY,
            userId,
        )) === 1
        if (isAdmitted) {
            return {
                userId,
                status: "admitted",
                admitted: true,
                position: null,
                checkoutToken: `checkout_${userId}`,
                admittedKey: WAITING_ROOM_ADMITTED_KEY,
            }
        }
        const rank = await this.redis.zrank(WAITING_ROOM_QUEUE_KEY, userId)
        if (rank == null) {
            return {
                userId,
                status: "not-in-queue",
                admitted: false,
                checkoutToken: null,
            }
        }
        return {
            userId,
            status: "waiting",
            admitted: false,
            position: rank + 1,
            checkoutToken: null,
            admitHint: "POST /api/waitingroom/admit with { count: N }",
        }
    }

    private async connectRedis(): Promise<void> {
        if (this.redis.status !== "ready") {
            await this.redis.connect()
        }
    }
}
