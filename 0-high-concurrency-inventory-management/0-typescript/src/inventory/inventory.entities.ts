import { Column, Entity, PrimaryColumn, PrimaryGeneratedColumn } from "typeorm"

/** Authoritative durable stock per SKU. Schema owned by seed.sql (synchronize: false). */
@Entity({ name: "inventories" })
export class InventoryEntity {
    @PrimaryColumn({ type: "varchar", length: 64 })
    sku: string

    @Column({ type: "int" })
    stock: number
}

/** Append-only audit trail: one row per database-path decrement. */
@Entity({ name: "inventory_ledgers" })
export class InventoryLedgerEntity {
    @PrimaryGeneratedColumn({ type: "bigint" })
    id: string

    @Column({ type: "varchar", length: 64 })
    sku: string

    @Column({ type: "int" })
    delta: number

    @Column({ type: "int", name: "remaining" })
    remaining: number
}
