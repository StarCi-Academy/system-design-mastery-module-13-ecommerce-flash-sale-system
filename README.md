# System Design Mastery — Module 13: Flash Sale at Scale

## Tổng quan (VI)
**Trừ kho Redis Lua** → **phòng chờ ZSET** → **checkout idempotent**. Tuân `coding-rules.md`.

## Overview (EN)
**Redis pre-decrement**, **virtual waiting room**, **idempotent checkout**. Follows `coding-rules.md`.

## Lessons
- `0-high-concurrency-inventory-management` — `inventory-service`
- `1-virtual-waiting-room-and-queuing` — `waiting-room`
- `2-idempotency-and-concurrency-control` — `checkout-service`

## Regenerate
```bash
node scratch/apply_module_13_flash_sale_rules.mjs
```
