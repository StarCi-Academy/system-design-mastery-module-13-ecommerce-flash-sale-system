import {
    ArgumentsHost,
    Catch,
    ConflictException,
    ExceptionFilter,
} from "@nestjs/common"
import { Request, Response } from "express"
import { InventoryService } from "./inventory.service"

/**
 * Maps the insufficient-stock conflict to the canonical 409 envelope shared by
 * all four language implementations: { error, sku, remaining }.
 */
@Catch(ConflictException)
export class InsufficientStockFilter implements ExceptionFilter {
    public constructor(private readonly inventory: InventoryService) {}

    public async catch(
        _exception: ConflictException,
        host: ArgumentsHost,
    ): Promise<void> {
        const ctx = host.switchToHttp()
        const response = ctx.getResponse<Response>()
        const request = ctx.getRequest<Request>()
        const sku = request.body?.sku ?? request.params?.sku ?? null

        let remaining = 0
        if (sku) {
            try {
                const snapshot = await this.inventory.readStock(sku)
                remaining = snapshot.redisStock >= 0 ? snapshot.redisStock : snapshot.dbStock
            } catch {
                remaining = 0
            }
        }

        response.status(409).json({ error: "insufficient_stock", sku, remaining })
    }
}
