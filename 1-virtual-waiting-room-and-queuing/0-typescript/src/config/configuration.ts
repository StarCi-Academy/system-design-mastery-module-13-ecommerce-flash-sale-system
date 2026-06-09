import { registerAs } from "@nestjs/config"

/**
 * Application configuration loaded from environment variables.
 * Keeping all env reads in one registerAs namespace means no service
 * touches process.env directly.
 */
export default registerAs("app", () => ({
    port: parseInt(process.env.PORT ?? "3030", 10),
    redisHost: process.env.REDIS_HOST ?? "localhost",
    redisPort: parseInt(process.env.REDIS_PORT ?? "6379", 10),
    admittedTtlSec: parseInt(process.env.ADMITTED_TTL_SEC ?? "300", 10),
}))
