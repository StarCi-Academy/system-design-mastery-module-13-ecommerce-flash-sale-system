import { Module, OnModuleInit } from "@nestjs/common"
import { TypeOrmModule } from "@nestjs/typeorm"
import { InventoryController } from "./inventory.controller"
import { InventoryService } from "./inventory.service"
import { redisProvider } from "./redis.provider"
import { InventoryEntity, InventoryLedgerEntity } from "./inventory.entities"

const SEEDED_SKU = "IPHONE15"

@Module({
    imports: [TypeOrmModule.forFeature([InventoryEntity, InventoryLedgerEntity])],
    controllers: [InventoryController],
    providers: [redisProvider, InventoryService],
    exports: [InventoryService],
})
export class InventoryModule implements OnModuleInit {
    public constructor(private readonly inventory: InventoryService) {}

    /** Warm the Redis hot counter from the seeded DB stock on boot. */
    public async onModuleInit(): Promise<void> {
        await this.inventory.warmCounter(SEEDED_SKU)
    }
}
