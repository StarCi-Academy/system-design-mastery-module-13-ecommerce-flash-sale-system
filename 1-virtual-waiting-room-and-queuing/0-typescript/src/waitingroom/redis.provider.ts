import { Provider } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import Redis from "ioredis"

export const REDIS_CLIENT = Symbol("REDIS_CLIENT")

/**
 * Provides a single shared ioredis connection for the whole app.
 * A persistent TCP socket lets us pipeline ZADD/ZRANK/ZPOPMIN without
 * paying connection setup cost per request during a flash-sale spike.
 */
export const redisProvider: Provider = {
    provide: REDIS_CLIENT,
    inject: [ConfigService],
    useFactory: (cs: ConfigService): Redis => {
        return new Redis({
            host: cs.get<string>("app.redisHost"),
            port: cs.get<number>("app.redisPort"),
        })
    },
}
