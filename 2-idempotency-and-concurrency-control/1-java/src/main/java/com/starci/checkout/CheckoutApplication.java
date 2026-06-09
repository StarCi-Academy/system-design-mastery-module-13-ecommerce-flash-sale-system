package com.starci.checkout;

import java.math.BigDecimal;
import java.time.Duration;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@SpringBootApplication
public class CheckoutApplication {
    public static void main(String[] args) {
        SpringApplication.run(CheckoutApplication.class, args);
    }
}

// The orders table. UNIQUE(idempotency_key) is the durable last line of defense.
@Entity
@Table(name = "orders", uniqueConstraints = @UniqueConstraint(
        name = "uq_orders_idempotency_key", columnNames = "idempotency_key"))
class OrderEntity {
    @Id
    @Column(columnDefinition = "uuid")
    UUID id;

    @Column(name = "idempotency_key", nullable = false, updatable = false)
    String idempotencyKey;

    @Column(nullable = false, length = 16)
    String status;

    // Decimal amount stored as NUMERIC; serialized as a string ("999.00").
    @Column(nullable = false, precision = 12, scale = 2)
    BigDecimal amount;

    @Column(nullable = false, length = 64)
    String sku;

    OrderEntity() {}

    OrderEntity(String idempotencyKey, BigDecimal amount, String sku) {
        this.id = UUID.randomUUID();
        this.idempotencyKey = idempotencyKey;
        this.status = "CONFIRMED";
        this.amount = amount;
        this.sku = sku;
    }
}

interface OrderRepository extends JpaRepository<OrderEntity, UUID> {
    Optional<OrderEntity> findByIdempotencyKey(String idempotencyKey);
}

class CreateOrderRequest {
    public String amount;
    public String sku;
}

@RestController
@RequestMapping
class CheckoutController {

    private static final String PENDING = "PENDING";
    private static final Duration PENDING_TTL = Duration.ofSeconds(30);
    private static final Duration RESULT_TTL = Duration.ofHours(24);

    private final StringRedisTemplate redis;
    private final OrderRepository orders;
    private final ObjectMapper mapper = new ObjectMapper();
    private final long delayMs;

    CheckoutController(StringRedisTemplate redis, OrderRepository orders) {
        this.redis = redis;
        this.orders = orders;
        String env = System.getenv("CHECKOUT_PROCESSING_DELAY_MS");
        this.delayMs = env != null ? Long.parseLong(env) : 1500L;
    }

    @GetMapping("/health")
    Map<String, String> health() {
        return Map.of("status", "ok");
    }

    @PostMapping("/api/checkout/order")
    ResponseEntity<JsonNode> createOrder(
            @RequestHeader(value = "Idempotency-Key", required = false) String keyHeader,
            @RequestBody CreateOrderRequest body) throws Exception {

        String key = (keyHeader == null || keyHeader.isEmpty()) ? "missing-idempotency-key" : keyHeader;
        String redisKey = "idempotency:" + key;

        // SET NX is atomic first-wins: exactly one concurrent caller wins.
        Boolean acquired = redis.opsForValue().setIfAbsent(redisKey, PENDING, PENDING_TTL);
        if (!Boolean.TRUE.equals(acquired)) {
            String existing = redis.opsForValue().get(redisKey);
            if (existing != null && !PENDING.equals(existing)) {
                // Cached JSON result -> replay it with replayed=true, HTTP 200.
                var node = (com.fasterxml.jackson.databind.node.ObjectNode) mapper.readTree(existing);
                node.put("replayed", true);
                return ResponseEntity.ok(node);
            }
            // Still PENDING -> concurrent duplicate, HTTP 409.
            JsonNode conflict = mapper.readTree(
                    "{\"statusCode\":409,\"message\":\"Request in progress\",\"idempotencyKey\":\""
                            + key + "\"}");
            return ResponseEntity.status(HttpStatus.CONFLICT).body(conflict);
        }

        // Widen the PENDING window so a concurrent duplicate hits the 409 branch.
        Thread.sleep(delayMs);

        OrderEntity order = createOrEnsure(key, body);
        var result = mapper.createObjectNode();
        result.put("orderId", order.id.toString());
        result.put("status", order.status);
        result.put("amount", order.amount.toPlainString());
        result.put("replayed", false);

        redis.opsForValue().set(redisKey, mapper.writeValueAsString(result), RESULT_TTL);
        return ResponseEntity.status(HttpStatus.CREATED).body(result);
    }

    private OrderEntity createOrEnsure(String key, CreateOrderRequest body) {
        try {
            return orders.saveAndFlush(new OrderEntity(key, new BigDecimal(body.amount), body.sku));
        } catch (org.springframework.dao.DataIntegrityViolationException e) {
            // Last-line defense: UNIQUE(idempotency_key) rejected the duplicate.
            return orders.findByIdempotencyKey(key).orElseThrow(() -> e);
        }
    }
}
