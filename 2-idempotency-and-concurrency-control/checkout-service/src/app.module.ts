/**
 * Module gốc — Postgres biz demo + Redis.
 * (EN: Root module — Postgres demo data + Redis.)
 */
import {
    Module,
} from "@nestjs/common"
import {
    ConfigModule,
    ConfigService,
} from "@nestjs/config"
import {
    TypeOrmModule,
} from "@nestjs/typeorm"
import {
    appConfig,
    databaseConfig,
    redisConfig,
    type DatabaseConfig,
} from "./config"
import {
    CheckoutModule,
} from "./checkout"

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            load: [appConfig, databaseConfig, redisConfig],
        }),
        TypeOrmModule.forRootAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: (config: ConfigService) => {
                const db = config.getOrThrow<DatabaseConfig>("database")
                return {
                    type: "postgres" as const,
                    host: db.host,
                    port: db.port,
                    username: db.username,
                    password: db.password,
                    database: db.database,
                    autoLoadEntities: true,
                    synchronize: true,
                }
            },
        }),
        CheckoutModule,
    ],
})
export class AppModule {}
