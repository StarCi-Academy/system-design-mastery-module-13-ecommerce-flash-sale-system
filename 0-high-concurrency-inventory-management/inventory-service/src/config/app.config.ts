import {
    registerAs,
} from "@nestjs/config"

/**
 * Cấu hình app (cổng HTTP).
 * (EN: App config (HTTP port).)
 */
export interface AppConfig {
    port: number
}

export const appConfig = registerAs(
    "app",
    (): AppConfig => ({
        port: Number(process.env.PORT) || 3000,
    }),
)
