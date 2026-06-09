import { registerAs } from "@nestjs/config"

/**
 * Centralized configuration read once from environment variables.
 * No service reads process.env directly; everything flows through ConfigService.
 */
export default registerAs("app", () => ({
    port: Number(process.env.PORT) || 3029,
    redisHost: process.env.REDIS_HOST || "localhost",
    redisPort: Number(process.env.REDIS_PORT) || 6379,
    postgresHost: process.env.POSTGRES_HOST || "localhost",
    postgresPort: Number(process.env.POSTGRES_PORT) || 5432,
    postgresUser: process.env.POSTGRES_USER || "postgres",
    postgresPassword: process.env.POSTGRES_PASSWORD || "postgres",
    postgresDb: process.env.POSTGRES_DB || "inventory_service",
}))
