import {
    Module,
} from "@nestjs/common"
import {
    TypeOrmModule,
} from "@nestjs/typeorm"
import {
    InventoryItemEntity,
    InventoryLedgerEntity,
} from "../entities"
import {
    InventoryController,
} from "./inventory.controller"
import {
    InventoryService,
} from "./inventory.service"

/**
 * Feature module — inventory Postgres + Redis Lua.
 * (EN: Feature module — inventory Postgres + Redis Lua.)
 */
@Module({
    imports: [TypeOrmModule.forFeature([InventoryItemEntity, InventoryLedgerEntity])],
    controllers: [InventoryController],
    providers: [InventoryService],
})
export class InventoryModule {}
