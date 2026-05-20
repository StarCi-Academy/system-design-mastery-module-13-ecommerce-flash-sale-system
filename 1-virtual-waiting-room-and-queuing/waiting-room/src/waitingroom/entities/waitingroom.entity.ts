import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
} from "typeorm"

/**
 * Thực thể lưu trữ dữ liệu tính năng.
 * (EN: Entity holding feature data records.)
 */
@Entity("waitingroom_records")
export class WaitingroomEntity {
    @PrimaryGeneratedColumn()
    id: number

    @Column()
    title: string

    @Column({ default: 0 })
    version: number
}
