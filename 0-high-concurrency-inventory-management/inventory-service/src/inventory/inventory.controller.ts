import {
    Body,
    Controller,
    Get,
    Param,
    Post,
} from "@nestjs/common"
import {
    DecrementInventoryDto,
} from "./dto"
import {
    InventoryService,
} from "./inventory.service"

/**
 * HTTP controller — trừ kho Redis vs Postgres (lesson 0).
 * (EN: HTTP controller — Redis vs Postgres decrement (lesson 0).)
 */
@Controller("api/inventory")
export class InventoryController {
    constructor(
        private readonly service: InventoryService,
    ) {}

    /**
     * Logic — trừ kho nhanh bằng Redis Lua.
     * Code — POST decrement/redis → decrementRedis.
     * (EN Logic: Fast decrement via Redis Lua.)
     * (EN Code: POST decrement/redis.)
     */
    @Post("decrement/redis")
    decrementRedis(
        @Body() body: DecrementInventoryDto,
    ): ReturnType<InventoryService["decrementRedis"]> {
        return this.service.decrementRedis(body.productSku, body.quantity)
    }

    /**
     * Logic — trừ kho Postgres pessimistic (so sánh).
     * Code — POST decrement/db → decrementDb.
     * (EN Logic: Pessimistic DB decrement for comparison.)
     * (EN Code: POST decrement/db.)
     */
    @Post("decrement/db")
    decrementDb(
        @Body() body: DecrementInventoryDto,
    ): ReturnType<InventoryService["decrementDb"]> {
        return this.service.decrementDb(body.productSku, body.quantity)
    }

    /**
     * Logic — xem tồn Redis vs DB.
     * Code — GET stock/:sku → getStock.
     * (EN Logic: Inspect Redis vs DB stock.)
     * (EN Code: GET stock/:sku.)
     */
    @Get("stock/:sku")
    getStock(
        @Param("sku") sku: string,
    ): ReturnType<InventoryService["getStock"]> {
        return this.service.getStock(sku)
    }
}
