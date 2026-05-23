-- Tạo bảng inventory_items nếu chưa tồn tại.
-- (EN: Create inventory_items table if it does not exist.)
CREATE TABLE IF NOT EXISTS inventory_items (
    sku        TEXT    PRIMARY KEY,
    stock      INTEGER NOT NULL
);

-- Tạo bảng inventory_ledgers nếu chưa tồn tại.
-- (EN: Create inventory_ledgers table if it does not exist.)
CREATE TABLE IF NOT EXISTS inventory_ledgers (
    id               SERIAL  PRIMARY KEY,
    sku              TEXT    NOT NULL,
    quantity_changed INTEGER NOT NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed SKU demo IPHONE15 với tồn kho 100 đơn vị.
-- (EN: Seed demo SKU IPHONE15 with 100 units of stock.)
INSERT INTO inventory_items (sku, stock)
VALUES ('IPHONE15', 100)
ON CONFLICT (sku) DO NOTHING;
