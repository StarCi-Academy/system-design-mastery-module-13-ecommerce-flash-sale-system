package com.starci.inventory;

import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/inventory")
public class InventoryController {

    private final InventoryService inventory;

    public InventoryController(InventoryService inventory) {
        this.inventory = inventory;
    }

    public record DecrementRequest(String sku, Integer quantity) {
    }

    @PostMapping("/decrement/redis")
    public Map<String, Object> decrementRedis(@RequestBody DecrementRequest req) {
        validate(req);
        try {
            long remaining = inventory.decrementRedis(req.sku(), req.quantity());
            return Map.of("sku", req.sku(), "strategy", "redis-lua", "remaining", remaining);
        } catch (ResponseStatusException ex) {
            throw enrich(ex, req.sku());
        }
    }

    @PostMapping("/decrement/db")
    public Map<String, Object> decrementDb(@RequestBody DecrementRequest req) {
        validate(req);
        try {
            long remaining = inventory.decrementDb(req.sku(), req.quantity());
            return Map.of("sku", req.sku(), "strategy", "db-pessimistic-lock", "remaining", remaining);
        } catch (ResponseStatusException ex) {
            throw enrich(ex, req.sku());
        }
    }

    /** Attach the SKU so the 409 handler can include sku + remaining. */
    private ResponseStatusException enrich(ResponseStatusException ex, String sku) {
        return new ResponseStatusException(ex.getStatusCode(), sku);
    }

    @GetMapping("/stock/{sku}")
    public InventoryService.StockSnapshot readStock(@PathVariable String sku) {
        return inventory.readStock(sku);
    }

    private void validate(DecrementRequest req) {
        if (req.sku() == null || req.sku().isBlank() || req.quantity() == null || req.quantity() <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "bad_request");
        }
    }

    /** Map the conflict to the canonical 409 envelope: { error, sku, remaining }. */
    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<Map<String, Object>> handle(ResponseStatusException ex) {
        HttpStatus status = HttpStatus.valueOf(ex.getStatusCode().value());
        String sku = ex.getReason();
        if (status == HttpStatus.CONFLICT && sku != null) {
            long remaining = 0;
            try {
                InventoryService.StockSnapshot snap = inventory.readStock(sku);
                remaining = snap.redisStock() >= 0 ? snap.redisStock() : snap.dbStock();
            } catch (RuntimeException ignored) {
                remaining = 0;
            }
            return ResponseEntity.status(status)
                    .body(Map.of("error", "insufficient_stock", "sku", sku, "remaining", remaining));
        }
        if (status == HttpStatus.NOT_FOUND) {
            return ResponseEntity.status(status).body(Map.of("error", "unknown_sku"));
        }
        return ResponseEntity.status(status).body(Map.of("error", "bad_request"));
    }
}
