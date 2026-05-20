import {
    Body,
    Controller,
    Get,
    Param,
    Post,
} from "@nestjs/common"
import {
    InventoryService,
} from "./inventory.service"

/**
 * REST controller exposing flash-sale inventory endpoints.
 */
@Controller("api/inventory")
export class InventoryController {
    constructor(
        private readonly service: InventoryService,
    ) {}

    @Post("seed")
    seed(@Body() body: { productSku?: string; quantity?: number }) {
        return this.service.seed(body.productSku ?? "IPHONE15", body.quantity ?? 100)
    }

    @Post("decrement/redis")
    decrement(@Body() body: { productSku?: string; quantity?: number }) {
        return this.service.decrement(body.productSku ?? "IPHONE15", body.quantity ?? 1)
    }

    @Get("status/:productSku")
    getStatus(@Param("productSku") productSku: string) {
        return this.service.getStatus(productSku)
    }
}
