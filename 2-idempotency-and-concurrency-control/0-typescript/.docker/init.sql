-- Schema authority for the checkout-service (TypeORM synchronize is OFF).
-- The UNIQUE(idempotency_key) constraint is the durable last line of defense:
-- the database physically refuses a second row for the same idempotency key.
CREATE TABLE IF NOT EXISTS orders (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    idempotency_key VARCHAR(128)  NOT NULL,
    status          VARCHAR(16)   NOT NULL,
    amount          NUMERIC(12,2) NOT NULL,
    sku             VARCHAR(64)   NOT NULL,
    CONSTRAINT uq_orders_idempotency_key UNIQUE (idempotency_key)
);
