import { Module } from "@nestjs/common"
import { ConfigModule, ConfigService } from "@nestjs/config"
import { TypeOrmModule } from "@nestjs/typeorm"
import configuration from "./config/configuration"
import { InventoryModule } from "./inventory"
import { InventoryEntity, InventoryLedgerEntity } from "./inventory/inventory.entities"

@Module({
    imports: [
        ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
        TypeOrmModule.forRootAsync({
            inject: [ConfigService],
            useFactory: (cs: ConfigService) => ({
                type: "postgres" as const,
                host: cs.get<string>("app.postgresHost"),
                port: cs.get<number>("app.postgresPort"),
                username: cs.get<string>("app.postgresUser"),
                password: cs.get<string>("app.postgresPassword"),
                database: cs.get<string>("app.postgresDb"),
                entities: [InventoryEntity, InventoryLedgerEntity],
                // Schema and seed data are owned by seed.sql, not TypeORM.
                synchronize: false,
            }),
        }),
        InventoryModule,
    ],
})
export class AppModule {}
