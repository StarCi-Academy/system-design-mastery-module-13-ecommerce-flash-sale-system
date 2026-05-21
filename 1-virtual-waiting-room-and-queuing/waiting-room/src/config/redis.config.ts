/**
 * Config `registerAs` — chỉ đọc `process.env` tại factory.
 * (EN: Config `registerAs` — reads `process.env` in factory only.)
 */
import {
    registerAs,
} from "@nestjs/config"

export interface RedisConfig {
    host: string
    port: number
}

/**
 * Cấu hình Redis — namespace `redis` cho ConfigService.
 * (EN: Redis connection config — `redis` namespace for ConfigService.)
 */
export const redisConfig = registerAs(
    "redis",
    (): RedisConfig => ({
        host: process.env.REDIS_HOST ?? "localhost",
        port: Number(process.env.REDIS_PORT) || 6379,
    }),
)
