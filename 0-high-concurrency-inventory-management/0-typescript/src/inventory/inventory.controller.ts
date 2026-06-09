import {
    BadRequestException,
    Body,
    Controller,
    Get,
    Param,
    Post,
} from "@nestjs/common"
import { InventoryService } from "./inventory.service"

interface DecrementDto {
    sku: string
    quantity: number
}

function parseDto(body: DecrementDto): { sku: string; quantity: number } {
    const sku = body?.sku
    const quantity = Number(body?.quantity)
    if (!sku || !Number.isInteger(quantity) || quantity <= 0) {
        throw new BadRequestException("sku required and quantity must be a positive integer")
    }
    return { sku, quantity }
}

@Controller("api/inventory")
export class InventoryController {
    public constructor(private readonly inventory: InventoryService) {}

    @Post("decrement/redis")
    public async decrementRedis(@Body() body: DecrementDto): Promise<{
        sku: string
        strategy: string
        remaining: number
    }> {
        const { sku, quantity } = parseDto(body)
        const remaining = await this.inventory.decrementRedis(sku, quantity)
        return { sku, strategy: "redis-lua", remaining }
    }

    @Post("decrement/db")
    public async decrementDb(@Body() body: DecrementDto): Promise<{
        sku: string
        strategy: string
        remaining: number
    }> {
        const { sku, quantity } = parseDto(body)
        const remaining = await this.inventory.decrementDb(sku, quantity)
        return { sku, strategy: "db-pessimistic-lock", remaining }
    }

    @Get("stock/:sku")
    public async readStock(@Param("sku") sku: string): Promise<{
        sku: string
        dbStock: number
        redisStock: number
        ledger: { delta: number; remaining: number }[]
    }> {
        return this.inventory.readStock(sku)
    }
}
