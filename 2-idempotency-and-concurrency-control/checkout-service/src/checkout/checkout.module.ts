import {
    Module,
} from "@nestjs/common"
import {
    TypeOrmModule,
} from "@nestjs/typeorm"
import {
    CheckoutEntity,
} from "./entities"
import {
    CheckoutService,
} from "./checkout.service"
import {
    CheckoutController,
} from "./checkout.controller"

/**
 * Feature Module quản lý bài học Idempotency and Concurrency Control.
 * (EN: Feature Module managing lesson Idempotency and Concurrency Control.)
 */
@Module({
    imports: [
        TypeOrmModule.forFeature([CheckoutEntity]),
    ],
    controllers: [CheckoutController],
    providers: [CheckoutService],
    exports: [CheckoutService],
})
export class CheckoutModule {}
