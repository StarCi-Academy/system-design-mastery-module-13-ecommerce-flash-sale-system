import {
    Module,
} from "@nestjs/common"
import {
    TypeOrmModule,
} from "@nestjs/typeorm"
import {
    InventoryEntity,
} from "./entities"
import {
    InventoryService,
} from "./inventory.service"
import {
    InventoryController,
} from "./inventory.controller"

/**
 * Feature Module quản lý bài học High-Concurrency Inventory Management.
 * (EN: Feature Module managing lesson High-Concurrency Inventory Management.)
 */
@Module({
    imports: [
        TypeOrmModule.forFeature([InventoryEntity]),
    ],
    controllers: [InventoryController],
    providers: [InventoryService],
    exports: [InventoryService],
})
export class InventoryModule {}
