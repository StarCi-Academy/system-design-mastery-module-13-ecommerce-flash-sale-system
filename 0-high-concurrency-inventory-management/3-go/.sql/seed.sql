-- Schema and seed data are authoritative (TypeORM runs with synchronize: false).
CREATE TABLE IF NOT EXISTS inventories (
    sku   VARCHAR(64) PRIMARY KEY,
    stock INTEGER NOT NULL CHECK (stock >= 0)  -- DB-level guard against oversell
);

CREATE TABLE IF NOT EXISTS inventory_ledgers (
    id         BIGSERIAL PRIMARY KEY,
    sku        VARCHAR(64) NOT NULL,
    delta      INTEGER NOT NULL,
    remaining  INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO inventories (sku, stock) VALUES ('IPHONE15', 100)
ON CONFLICT (sku) DO NOTHING;
