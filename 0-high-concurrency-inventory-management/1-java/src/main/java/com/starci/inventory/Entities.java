package com.starci.inventory;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/** Authoritative durable stock per SKU. Schema owned by seed.sql (ddl-auto: none). */
@Entity
@Table(name = "inventories")
class InventoryEntity {
    @Id
    @Column(name = "sku")
    private String sku;

    @Column(name = "stock")
    private int stock;

    protected InventoryEntity() {
    }

    public String getSku() {
        return sku;
    }

    public int getStock() {
        return stock;
    }

    public void setStock(int stock) {
        this.stock = stock;
    }
}

/** Append-only audit trail: one row per database-path decrement. */
@Entity
@Table(name = "inventory_ledgers")
class InventoryLedgerEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "sku")
    private String sku;

    @Column(name = "delta")
    private int delta;

    @Column(name = "remaining")
    private int remaining;

    protected InventoryLedgerEntity() {
    }

    public InventoryLedgerEntity(String sku, int delta, int remaining) {
        this.sku = sku;
        this.delta = delta;
        this.remaining = remaining;
    }

    public int getDelta() {
        return delta;
    }

    public int getRemaining() {
        return remaining;
    }
}
