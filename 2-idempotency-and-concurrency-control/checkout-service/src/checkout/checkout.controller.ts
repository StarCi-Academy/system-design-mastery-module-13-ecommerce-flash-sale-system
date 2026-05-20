import {
    Body,
    Controller,
    Headers,
    Post,
} from "@nestjs/common"
import {
    CheckoutService,
} from "./checkout.service"

/**
 * REST controller exposing idempotent checkout endpoints.
 */
@Controller("api/checkout")
export class CheckoutController {
    constructor(
        private readonly service: CheckoutService,
    ) {}

    @Post("order")
    checkout(
        @Headers("idempotency-key") idempotencyKey = "key_test_100",
        @Body() body: { userId?: string; productId?: number },
    ) {
        return this.service.checkout(
            idempotencyKey,
            body.userId ?? "usr_99",
            body.productId ?? 1,
        )
    }
}
