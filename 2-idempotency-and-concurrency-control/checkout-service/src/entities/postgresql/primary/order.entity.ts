import {
    Column,
    Entity,
    PrimaryColumn,
} from "typeorm"

/**
 * Entity đơn hàng — Postgres ACID + idempotency key unique.
 * (EN: Order entity — Postgres ACID + unique idempotency key.)
 */
@Entity("orders")
export class OrderEntity {
    @PrimaryColumn()
    orderId!: string

    @Column()
    userId!: string

    @Column()
    productSku!: string

    @Column({ type: "int" })
    quantity!: number

    @Column({ unique: true })
    idempotencyKey!: string

    @Column()
    status!: string
}
