import {
    Module,
} from "@nestjs/common"
import {
    TypeOrmModule,
} from "@nestjs/typeorm"
import {
    OrderEntity,
} from "../entities"
import {
    CheckoutController,
} from "./checkout.controller"
import {
    CheckoutSeedService,
} from "./checkout-seed.service"
import {
    CheckoutService,
} from "./checkout.service"

/**
 * Feature module — checkout Postgres + Redis idempotency.
 * (EN: Feature module — checkout Postgres + Redis idempotency.)
 */
@Module({
    imports: [TypeOrmModule.forFeature([OrderEntity])],
    controllers: [CheckoutController],
    providers: [CheckoutService, CheckoutSeedService],
})
export class CheckoutModule {}
