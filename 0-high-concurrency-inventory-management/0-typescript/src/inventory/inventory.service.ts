import {
    ConflictException,
    Inject,
    Injectable,
    NotFoundException,
} from "@nestjs/common"
import { InjectDataSource } from "@nestjs/typeorm"
import { DataSource } from "typeorm"
import Redis from "ioredis"
import { REDIS_CLIENT } from "./redis.provider"
import { InventoryEntity, InventoryLedgerEntity } from "./inventory.entities"

/**
 * Lua runs atomically on Redis's single-threaded core: the check and the
 * decrement happen as one indivisible unit, so no other client can interleave.
 */
const DECREMENT_LUA = `
local stock = tonumber(redis.call('GET', KEYS[1]))
if stock == nil then return -1 end
if stock < tonumber(ARGV[1]) then return -2 end
return redis.call('DECRBY', KEYS[1], ARGV[1])
`

@Injectable()
export class InventoryService {
    public constructor(
        @Inject(REDIS_CLIENT) private readonly redis: Redis,
        @InjectDataSource() private readonly dataSource: DataSource,
    ) {}

    /** Redis Lua atomic decrement — one round-trip, no check-then-set race. */
    public async decrementRedis(sku: string, quantity: number): Promise<number> {
        const result = Number(
            await this.redis.eval(
                DECREMENT_LUA,
                1,
                `stock:${sku}`,
                String(quantity),
            ),
        )
        if (result === -1) throw new NotFoundException(`Unknown SKU: ${sku}`)
        if (result === -2) throw new ConflictException("insufficient_stock")
        return result // remaining stock after the atomic decrement
    }

    /** Pessimistic write lock decrement — serialize writers on the authoritative row. */
    public async decrementDb(sku: string, quantity: number): Promise<number> {
        return this.dataSource.transaction(async (manager) => {
            const inv = await manager.findOne(InventoryEntity, {
                where: { sku },
                lock: { mode: "pessimistic_write" },
            })
            if (!inv) throw new NotFoundException(`Unknown SKU: ${sku}`)
            if (inv.stock < quantity)
                throw new ConflictException("insufficient_stock")

            inv.stock -= quantity
            await manager.save(inv)

            // Append the audit row in the SAME transaction so stock and ledger
            // commit or roll back together.
            await manager.insert(InventoryLedgerEntity, {
                sku,
                delta: -quantity,
                remaining: inv.stock,
            })
            return inv.stock
        })
    }

    /** Read the durable DB stock, the hot Redis counter, and the ledger. */
    public async readStock(sku: string): Promise<{
        sku: string
        dbStock: number
        redisStock: number
        ledger: { delta: number; remaining: number }[]
    }> {
        const inv = await this.dataSource
            .getRepository(InventoryEntity)
            .findOne({ where: { sku } })
        if (!inv) throw new NotFoundException(`Unknown SKU: ${sku}`)

        const redisRaw = await this.redis.get(`stock:${sku}`)
        const ledgerRows = await this.dataSource
            .getRepository(InventoryLedgerEntity)
            .find({ where: { sku }, order: { id: "ASC" } })

        return {
            sku,
            dbStock: inv.stock,
            redisStock: redisRaw === null ? -1 : Number(redisRaw),
            ledger: ledgerRows.map((row) => ({
                delta: row.delta,
                remaining: row.remaining,
            })),
        }
    }

    /** Warm the Redis hot counter from the authoritative DB stock on startup. */
    public async warmCounter(sku: string): Promise<void> {
        const inv = await this.dataSource
            .getRepository(InventoryEntity)
            .findOne({ where: { sku } })
        if (inv) await this.redis.set(`stock:${sku}`, String(inv.stock))
    }
}
