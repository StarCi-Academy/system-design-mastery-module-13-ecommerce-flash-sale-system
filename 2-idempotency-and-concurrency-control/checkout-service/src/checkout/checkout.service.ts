/**
 * Service checkout — idempotency key + Postgres order.
 * (EN: Checkout service — idempotency key + Postgres order.)
 */
import {
    ConflictException,
    Injectable,
    OnModuleDestroy,
    OnModuleInit,
} from "@nestjs/common"
import {
    ConfigService,
} from "@nestjs/config"
import {
    InjectRepository,
} from "@nestjs/typeorm"
import Redis from "ioredis"
import {
    Repository,
} from "typeorm"
import type {
    RedisConfig,
} from "../config"
import {
    OrderEntity,
} from "../entities"

const IDEMPOTENCY_TTL_SEC = 86_400
const IDEMPOTENCY_PENDING_TTL_SEC = 30
const IDEMPOTENCY_PENDING_VALUE = "PENDING"
/** Delay mô phỏng xử lý đơn — demo double-click trên lớp. */
const CHECKOUT_PROCESSING_DELAY_MS = 1500

@Injectable()
export class CheckoutService implements OnModuleInit, OnModuleDestroy {
    private redis!: Redis

    constructor(
        private readonly config: ConfigService,
        @InjectRepository(OrderEntity)
        private readonly orders: Repository<OrderEntity>,
    ) {}

    /**
     * Logic — khởi tạo Redis registry idempotency.
     * Code — OnModuleInit → ioredis.
     * (EN Logic: Initialize Redis idempotency registry.)
     * (EN Code: OnModuleInit → ioredis.)
     */
    onModuleInit(): void {
        const redis = this.config.getOrThrow<RedisConfig>("redis")
        this.redis = new Redis({
            host: redis.host,
            port: redis.port,
            lazyConnect: true,
        })
    }

    /**
     * Logic — đóng Redis.
     * Code — OnModuleDestroy → quit().
     * (EN Logic: Close Redis.)
     * (EN Code: OnModuleDestroy → quit().)
     */
    async onModuleDestroy(): Promise<void> {
        await this.redis?.quit()
    }

    /**
     * Logic — SET NX PENDING chặn double-click; xong ghi JSON kết quả.
     * Code — set PENDING → delay → save Order → setex payload.
     * (EN Logic: PENDING lock then persist order and cache result.)
     * (EN Code: SET NX PENDING → process → SET JSON result.)
     */
    async placeOrder(
        idempotencyKey: string,
        userId: string,
        productSku: string,
        quantity: number,
    ) {
        await this.connectRedis()
        const cacheKey = this.idempotencyKey(idempotencyKey)
        const lockAcquired = await this.redis.set(
            cacheKey,
            IDEMPOTENCY_PENDING_VALUE,
            "EX",
            IDEMPOTENCY_PENDING_TTL_SEC,
            "NX",
        )
        if (!lockAcquired) {
            const current = await this.redis.get(cacheKey)
            if (current === IDEMPOTENCY_PENDING_VALUE) {
                throw new ConflictException(
                    "Đơn hàng của bạn đang được xử lý, vui lòng không nhấn lại!",
                )
            }
            if (current) {
                const parsed = JSON.parse(current) as {
                    orderId: string
                    userId: string
                    productSku: string
                    quantity: number
                    status: string
                }
                return {
                    duplicate: true,
                    idempotencyKey,
                    order: parsed,
                    registry: "redis-idempotency-cache",
                    lockingStrategy: "redis-pending-then-result",
                }
            }
            throw new ConflictException(
                "Đơn hàng của bạn đang được xử lý, vui lòng không nhấn lại!",
            )
        }

        try {
            await this.delay(CHECKOUT_PROCESSING_DELAY_MS)

            const existing = await this.orders.findOne({
                where: { idempotencyKey },
            })
            if (existing) {
                const payload = this.toPayload(existing)
                await this.redis.setex(
                    cacheKey,
                    IDEMPOTENCY_TTL_SEC,
                    JSON.stringify(payload),
                )
                return {
                    duplicate: true,
                    idempotencyKey,
                    order: payload,
                    registry: "postgres-unique-idempotency-key",
                    lockingStrategy: "postgres-unique-constraint",
                }
            }

            const orderId = `ord_${Date.now()}`
            const row = await this.orders.save({
                orderId,
                userId,
                productSku,
                quantity,
                idempotencyKey,
                status: "confirmed",
            })
            const payload = this.toPayload(row)
            await this.redis.setex(
                cacheKey,
                IDEMPOTENCY_TTL_SEC,
                JSON.stringify(payload),
            )

            return {
                duplicate: false,
                idempotencyKey,
                order: payload,
                registry: "redis+postgres",
                lockingStrategy: "redis-pending-lock-then-result",
                note: "Parallel duplicate key while PENDING → 409; after completion → same order.",
            }
        } catch (err) {
            if (err instanceof ConflictException) {
                throw err
            }
            await this.redis.del(cacheKey)
            throw err
        }
    }

    private delay(ms: number): Promise<void> {
        return new Promise((resolve) => {
            setTimeout(resolve, ms)
        })
    }

    private idempotencyKey(key: string): string {
        return `idempotency:${key}`
    }

    private toPayload(row: OrderEntity) {
        return {
            orderId: row.orderId,
            userId: row.userId,
            productSku: row.productSku,
            quantity: row.quantity,
            status: row.status,
        }
    }

    private async connectRedis(): Promise<void> {
        if (this.redis.status !== "ready") {
            await this.redis.connect()
        }
    }
}
