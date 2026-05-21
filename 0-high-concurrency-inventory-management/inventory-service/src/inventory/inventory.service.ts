/**
 * Service tồn kho — Redis Lua pre-decrement vs Postgres pessimistic lock.
 * (EN: Inventory service — Redis Lua pre-decrement vs Postgres pessimistic lock.)
 */
import {
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
    InventoryItemEntity,
    InventoryLedgerEntity,
} from "../entities"

const DECR_LUA = `
local current = tonumber(redis.call('GET', KEYS[1]) or '0')
local qty = tonumber(ARGV[1])
if current < qty then
  return -1
end
redis.call('DECRBY', KEYS[1], qty)
return current - qty
`

@Injectable()
export class InventoryService implements OnModuleInit, OnModuleDestroy {
    private redis!: Redis

    constructor(
        private readonly config: ConfigService,
        @InjectRepository(InventoryItemEntity)
        private readonly items: Repository<InventoryItemEntity>,
        @InjectRepository(InventoryLedgerEntity)
        private readonly ledgers: Repository<InventoryLedgerEntity>,
    ) {}

    /**
     * Logic — khởi tạo Redis client.
     * Code — OnModuleInit → ioredis lazyConnect.
     * (EN Logic: Initialize Redis client.)
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
     * Logic — đóng Redis khi shutdown.
     * Code — OnModuleDestroy → quit().
     * (EN Logic: Close Redis on shutdown.)
     * (EN Code: OnModuleDestroy → quit().)
     */
    async onModuleDestroy(): Promise<void> {
        await this.redis?.quit()
    }

    /**
     * Logic — Lua trừ Redis; thành công thì INSERT ledger Postgres (đồng bộ).
     * Code — EVAL DECR_LUA → remaining < 0 ? soldOut : ledgers.save(-quantity).
     * (EN Logic: Redis Lua then synchronous Postgres ledger INSERT.)
     * (EN Code: EVAL Lua → INSERT inventory_ledgers on success.)
     */
    async decrementRedis(sku: string, quantity: number) {
        await this.connectRedis()
        const key = this.stockKey(sku)
        const remaining = (await this.redis.eval(
            DECR_LUA,
            1,
            key,
            String(quantity),
        )) as number
        const soldOut = remaining < 0
        if (soldOut) {
            return {
                path: "redis-lua-pre-decrement",
                productSku: sku,
                quantity,
                remaining: 0,
                soldOut: true,
                redisKey: key,
                lockType: "none-in-memory-atomic",
                ledgerWritten: false,
                note: "Lua rejected decrement — Postgres spared from oversell traffic.",
            }
        }
        await this.ledgers.save({
            sku,
            quantityChanged: -quantity,
        })
        return {
            path: "redis-lua-pre-decrement",
            productSku: sku,
            quantity,
            remaining,
            soldOut: false,
            redisKey: key,
            lockType: "none-in-memory-atomic",
            ledgerWritten: true,
            durableWrite: "inventory_ledgers-sync-insert",
        }
    }

    /**
     * Logic — trừ kho Postgres pessimistic (chậm hơn — so sánh lab).
     * Code — findOne lock pessimistic_write → save.
     * (EN Logic: Pessimistic row lock decrement (slower lab path).)
     * (EN Code: FOR UPDATE style lock → save.)
     */
    async decrementDb(sku: string, quantity: number) {
        const item = await this.items.findOne({
            where: { sku },
            lock: { mode: "pessimistic_write" },
        })
        if (!item || item.stock < quantity) {
            return {
                path: "postgres-pessimistic-lock",
                productSku: sku,
                quantity,
                remaining: item?.stock ?? 0,
                soldOut: true,
                lockType: "pessimistic-row",
                note: "Row lock blocks concurrent transactions — pool pressure under burst.",
            }
        }
        item.stock -= quantity
        await this.items.save(item)
        await this.connectRedis()
        await this.redis.set(this.stockKey(sku), String(item.stock))
        return {
            path: "postgres-pessimistic-lock",
            productSku: sku,
            quantity,
            remaining: item.stock,
            soldOut: item.stock === 0,
            lockType: "pessimistic-row",
            dbStock: item.stock,
        }
    }

    /**
     * Logic — so sánh counter Redis vs ledger Postgres (baseline items không đổi trên path Redis).
     * Code — GET stock:sku + COUNT/SUM inventory_ledgers.
     * (EN Logic: Redis counter vs Postgres ledger rows.)
     * (EN Code: GET redis + aggregate ledgers.)
     */
    async getStock(sku: string) {
        await this.connectRedis()
        const redisRaw = await this.redis.get(this.stockKey(sku))
        const redisStock = redisRaw == null ? null : Number(redisRaw)
        const row = await this.items.findOne({ where: { sku } })
        const ledgerRowCount = await this.ledgers.count({ where: { sku } })
        const ledgerAgg = await this.ledgers
            .createQueryBuilder("l")
            .select("COALESCE(SUM(l.quantityChanged), 0)", "net")
            .where("l.sku = :sku", { sku })
            .getRawOne<{ net: string }>()
        const ledgerNetChange = Number(ledgerAgg?.net ?? 0)
        return {
            productSku: sku,
            redisStock,
            dbBaselineStock: row?.stock ?? null,
            ledgerRowCount,
            ledgerNetChange,
            redisKey: this.stockKey(sku),
            sourceOfTruth:
                "redis-fast-counter + postgres-inventory_ledgers-per-sale",
        }
    }

    private stockKey(sku: string): string {
        return `stock:${sku}`
    }

    private async connectRedis(): Promise<void> {
        if (this.redis.status !== "ready") {
            await this.redis.connect()
        }
    }
}
