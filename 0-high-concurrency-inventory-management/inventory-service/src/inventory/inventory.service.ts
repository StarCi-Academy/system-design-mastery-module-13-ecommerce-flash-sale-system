import {
    Injectable,
} from "@nestjs/common"

/**
 * Service demonstrating flash-sale inventory decrement strategies.
 */
@Injectable()
export class InventoryService {
    private readonly stock = new Map<string, number>([
        ["IPHONE15", 100],
    ])

    /**
     * Seeds inventory for a SKU.
     *
     * @param productSku - Product SKU
     * @param quantity - Stock quantity
     * @returns Seeded inventory state
     */
    seed(productSku: string, quantity: number) {
        this.stock.set(productSku, quantity)

        return {
            productSku,
            stock: quantity,
            storage: "redis-counter-simulation",
        }
    }

    /**
     * Atomically decrements inventory like a Redis Lua script.
     *
     * @param productSku - Product SKU
     * @param quantity - Quantity to decrement
     * @returns Decrement decision
     */
    decrement(productSku: string, quantity: number) {
        const currentStock = this.stock.get(productSku) ?? 0

        if (currentStock < quantity) {
            return {
                productSku,
                accepted: false,
                reason: "insufficient_stock",
                remainingStock: currentStock,
            }
        }

        const remainingStock = currentStock - quantity
        this.stock.set(productSku, remainingStock)

        return {
            productSku,
            accepted: true,
            strategy: "redis-lua-atomic-decrement",
            decrementedBy: quantity,
            remainingStock,
        }
    }

    /**
     * Returns current inventory state.
     *
     * @param productSku - Product SKU
     * @returns Inventory status
     */
    getStatus(productSku: string) {
        return {
            productSku,
            stock: this.stock.get(productSku) ?? 0,
        }
    }
}
