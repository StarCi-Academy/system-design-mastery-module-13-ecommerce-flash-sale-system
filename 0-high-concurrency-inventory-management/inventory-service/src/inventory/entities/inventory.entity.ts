import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
} from "typeorm"

/**
 * Thực thể lưu trữ dữ liệu tính năng.
 * (EN: Entity holding feature data records.)
 */
@Entity("inventory_records")
export class InventoryEntity {
    @PrimaryGeneratedColumn()
    id: number

    @Column()
    title: string

    @Column({ default: 0 })
    version: number
}
