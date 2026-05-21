/**
 * Module gốc — Redis virtual waiting room (không Postgres).
 * (EN: Root module — Redis virtual waiting room (no Postgres).)
 */
import {
    Module,
} from "@nestjs/common"
import {
    ConfigModule,
} from "@nestjs/config"
import {
    appConfig,
    redisConfig,
} from "./config"
import {
    WaitingroomModule,
} from "./waitingroom"

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            load: [appConfig, redisConfig],
        }),
        WaitingroomModule,
    ],
})
export class AppModule {}
