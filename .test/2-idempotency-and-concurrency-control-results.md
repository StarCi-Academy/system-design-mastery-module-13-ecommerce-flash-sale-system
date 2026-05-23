# Lesson 2 — Idempotency and Concurrency Control — Test Results

Run at: 2026-05-23
Port: 3031.
Image: starciacademy/system-design-idempotency-and-concurrency-control-checkout-service:latest.

## Flow 1 — First order creation (PASS)

POST /api/checkout/order, header Idempotency-Key=idem-001 → `duplicate:false`, new orderId, registry "redis+postgres".

## Flow 2 — Replay with same idempotency key (PASS)

POST same idem-001 → `duplicate:true`, same orderId returned from Redis cache, registry "redis-idempotency-cache".

## Flow 3 — Different idempotency key (PASS)

POST /api/checkout/order, idem-002, usr2, qty 2 → new orderId, status confirmed.

## Flow 4 — Concurrent race on PENDING lock (PASS)

Two requests with idem-003 fired in parallel within 100ms:
- First → 409 Conflict ("Đơn hàng của bạn đang được xử lý, vui lòng không nhấn lại!").
- Second (the one that won SET NX) → confirmed order.

Confirms `SET NX` PENDING lock plus result cache pattern works.

Summary: 4/4 flows PASS.
