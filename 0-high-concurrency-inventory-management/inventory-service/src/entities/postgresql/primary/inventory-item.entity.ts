import {
    Column,
    Entity,
    PrimaryColumn,
} from "typeorm"

/**
 * Entity tồn kho — ledger Postgres (nguồn sự thật bền vững).
 * (EN: Inventory item entity — durable Postgres ledger.)
 */
@Entity("inventory_items")
export class InventoryItemEntity {
    @PrimaryColumn()
    sku!: string

    @Column({ type: "int" })
    stock!: number
}
