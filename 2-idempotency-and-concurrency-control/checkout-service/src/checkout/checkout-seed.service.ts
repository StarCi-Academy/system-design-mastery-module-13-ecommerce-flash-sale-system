/**
 * Seed đơn mẫu (tuỳ chọn) — DB trống không bắt buộc order có sẵn.
 * (EN: Optional seed — empty DB is fine for checkout lab.)
 */
import {
    Injectable,
    OnModuleInit,
} from "@nestjs/common"
import {
    InjectRepository,
} from "@nestjs/typeorm"
import {
    Repository,
} from "typeorm"
import {
    OrderEntity,
} from "../entities"

@Injectable()
export class CheckoutSeedService implements OnModuleInit {
    constructor(
        @InjectRepository(OrderEntity)
        private readonly orders: Repository<OrderEntity>,
    ) {}

    /**
     * Logic — không seed order mặc định; lab tạo qua POST.
     * Code — onModuleInit no-op khi count >= 0.
     * (EN Logic: No default orders; created via POST.)
     * (EN Code: onModuleInit noop.)
     */
    async onModuleInit(): Promise<void> {
        await this.orders.count()
    }
}
