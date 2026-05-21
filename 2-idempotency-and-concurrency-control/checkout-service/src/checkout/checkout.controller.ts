import {
    Body,
    Controller,
    Headers,
    Post,
} from "@nestjs/common"
import {
    CreateOrderDto,
} from "./dto"
import {
    CheckoutService,
} from "./checkout.service"

/**
 * HTTP controller — idempotent checkout (lesson 2).
 * (EN: HTTP controller — idempotent checkout (lesson 2).)
 */
@Controller("api/checkout")
export class CheckoutController {
    constructor(
        private readonly service: CheckoutService,
    ) {}

    /**
     * Logic — đặt hàng với Idempotency-Key (chống double-submit).
     * Code — POST order + header → placeOrder.
     * (EN Logic: Place order with Idempotency-Key header.)
     * (EN Code: POST order → placeOrder.)
     */
    @Post("order")
    placeOrder(
        @Headers("idempotency-key") idempotencyKey: string | undefined,
        @Body() body: CreateOrderDto,
    ): ReturnType<CheckoutService["placeOrder"]> {
        const key = idempotencyKey?.trim() || "missing-idempotency-key"
        return this.service.placeOrder(
            key,
            body.userId,
            body.productSku,
            body.quantity,
        )
    }
}
