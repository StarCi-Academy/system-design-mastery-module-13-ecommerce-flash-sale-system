package com.starci.inventory;

import java.util.List;

import jakarta.annotation.PostConstruct;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.RedisScript;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class InventoryService {

    private static final String SEEDED_SKU = "IPHONE15";

    // Lua runs single-threaded inside Redis: check-and-decrement is one indivisible step.
    private static final RedisScript<Long> DECREMENT_LUA = RedisScript.of("""
            local stock = tonumber(redis.call('GET', KEYS[1]))
            if stock == nil then return -1 end
            if stock < tonumber(ARGV[1]) then return -2 end
            return redis.call('DECRBY', KEYS[1], ARGV[1])
            """, Long.class);

    private final StringRedisTemplate redis;
    private final InventoryRepository inventories;
    private final InventoryLedgerRepository ledgers;

    public InventoryService(StringRedisTemplate redis,
                            InventoryRepository inventories,
                            InventoryLedgerRepository ledgers) {
        this.redis = redis;
        this.inventories = inventories;
        this.ledgers = ledgers;
    }

    /** Warm the hot Redis counter from the authoritative DB stock on startup. */
    @PostConstruct
    public void warmCounter() {
        inventories.findById(SEEDED_SKU)
                .ifPresent(inv -> redis.opsForValue().set("stock:" + SEEDED_SKU, String.valueOf(inv.getStock())));
    }

    /** Redis Lua atomic decrement — one round-trip, no check-then-set race. */
    public long decrementRedis(String sku, long qty) {
        Long result = redis.execute(DECREMENT_LUA, List.of("stock:" + sku), String.valueOf(qty));
        if (result == null || result == -1L) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "unknown_sku");
        }
        if (result == -2L) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "insufficient_stock");
        }
        return result;
    }

    /** Pessimistic write lock decrement inside a transaction. */
    @Transactional
    public long decrementDb(String sku, int qty) {
        InventoryEntity inv = inventories.findBySkuForUpdate(sku)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "unknown_sku"));
        if (inv.getStock() < qty) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "insufficient_stock");
        }
        inv.setStock(inv.getStock() - qty);
        inventories.save(inv);
        // Append the audit row in the same transaction.
        ledgers.save(new InventoryLedgerEntity(sku, -qty, inv.getStock()));
        return inv.getStock();
    }

    public StockSnapshot readStock(String sku) {
        InventoryEntity inv = inventories.findById(sku)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "unknown_sku"));
        String redisRaw = redis.opsForValue().get("stock:" + sku);
        long redisStock = redisRaw == null ? -1 : Long.parseLong(redisRaw);
        List<LedgerLine> ledger = ledgers.findBySkuOrderByIdAsc(sku).stream()
                .map(row -> new LedgerLine(row.getDelta(), row.getRemaining()))
                .toList();
        return new StockSnapshot(sku, inv.getStock(), redisStock, ledger);
    }

    public record LedgerLine(int delta, int remaining) {
    }

    public record StockSnapshot(String sku, long dbStock, long redisStock, List<LedgerLine> ledger) {
    }
}
