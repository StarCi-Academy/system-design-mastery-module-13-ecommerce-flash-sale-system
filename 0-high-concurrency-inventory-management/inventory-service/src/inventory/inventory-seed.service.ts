/**
 * Seed SKU demo vào Postgres + đồng bộ counter Redis.
 * (EN: Seed demo SKU into Postgres + sync Redis counter.)
 */
import {
    Injectable,
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
} from "../entities"

@Injectable()
export class InventorySeedService implements OnModuleInit {
    private redis!: Redis

    constructor(
        private readonly config: ConfigService,
        @InjectRepository(InventoryItemEntity)
        private readonly items: Repository<InventoryItemEntity>,
    ) {}

    /**
     * Logic — khi DB trống, seed IPHONE15; đồng bộ Redis stock key.
     * Code — count() === 0 → save → SET stock:IPHONE15.
     * (EN Logic: Seed demo SKU when DB empty; sync Redis.)
     * (EN Code: count === 0 → save → SET redis key.)
     */
    async onModuleInit(): Promise<void> {
        const redisCfg = this.config.getOrThrow<RedisConfig>("redis")
        this.redis = new Redis({
            host: redisCfg.host,
            port: redisCfg.port,
            lazyConnect: true,
        })
        await this.redis.connect()

        if ((await this.items.count()) === 0) {
            await this.items.save({ sku: "IPHONE15", stock: 100 })
        }
        const row = await this.items.findOneOrFail({ where: { sku: "IPHONE15" } })
        await this.redis.set(this.stockKey("IPHONE15"), String(row.stock))
        await this.redis.quit()
    }

    private stockKey(sku: string): string {
        return `stock:${sku}`
    }
}
