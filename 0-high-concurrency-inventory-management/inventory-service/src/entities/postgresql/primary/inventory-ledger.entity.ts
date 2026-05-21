import {
    Column,
    CreateDateColumn,
    Entity,
    PrimaryGeneratedColumn,
} from "typeorm"

/**
 * Ledger trừ kho — mỗi lần Redis decrement thành công ghi một dòng (đồng bộ).
 * (EN: Inventory ledger row — one sync INSERT per successful Redis decrement.)
 */
@Entity("inventory_ledgers")
export class InventoryLedgerEntity {
    @PrimaryGeneratedColumn()
    id!: number

    @Column()
    sku!: string

    @Column({ type: "int", name: "quantity_changed" })
    quantityChanged!: number

    @CreateDateColumn({ name: "created_at" })
    createdAt!: Date
}
