import { ConfigService } from "@nestjs/config"
import { Provider } from "@nestjs/common"
import Redis from "ioredis"

export const REDIS_CLIENT = "REDIS_CLIENT"

/** One shared ioredis connection for the whole app, registered under REDIS_CLIENT. */
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
