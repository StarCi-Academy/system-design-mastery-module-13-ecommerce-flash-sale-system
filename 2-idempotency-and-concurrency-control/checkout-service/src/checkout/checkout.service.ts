import {
    Injectable,
} from "@nestjs/common"

/**
 * Service demonstrating idempotent checkout requests.
 */
@Injectable()
export class CheckoutService {
    private readonly processed = new Map<string, unknown>()

    /**
     * Creates or replays an idempotent checkout order.
     *
     * @param idempotencyKey - Client-provided idempotency key
     * @param userId - User id
     * @param productId - Product id
     * @returns Checkout result
     */
    checkout(idempotencyKey: string, userId: string, productId: number) {
        const existing = this.processed.get(idempotencyKey)
        if (existing) {
            return {
                replayed: true,
                idempotencyKey,
                result: existing,
            }
        }

        const result = {
            orderId: `ord_${Date.now()}`,
            userId,
            productId,
            status: "created",
            lockStrategy: "redis-idempotency-key",
        }

        this.processed.set(idempotencyKey, result)

        return {
            replayed: false,
            idempotencyKey,
            result,
        }
    }
}
