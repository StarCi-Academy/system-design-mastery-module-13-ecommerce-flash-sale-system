import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
} from "typeorm";

// The orders table. The UNIQUE constraint on idempotencyKey is the durable
// last line of defense: even if Redis is flushed or a key expires, the
// database physically refuses a second row for the same idempotency key.
@Entity("orders")
@Unique("uq_orders_idempotency_key", ["idempotencyKey"])
export class OrderEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  // The request-scoped idempotency key, enforced UNIQUE at the DB layer.
  @Column({ name: "idempotency_key", type: "varchar", length: 128 })
  idempotencyKey!: string;

  @Column({ type: "varchar", length: 16 })
  status!: string;

  // Decimal amount stored as NUMERIC and serialized as a string ("999.00")
  // to preserve precision across all four language implementations.
  @Column({ type: "numeric", precision: 12, scale: 2 })
  amount!: string;

  @Column({ name: "sku", type: "varchar", length: 64 })
  sku!: string;
}
