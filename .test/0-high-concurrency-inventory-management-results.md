# Lesson 0 — High-Concurrency Inventory Management — Test Results

Run at: 2026-05-23
Service ports: 3029.
Image: starciacademy/system-design-high-concurrency-inventory-management-inventory-service:latest.

## Flow 1 — Redis Lua atomic decrement (PASS)

Request: POST /api/inventory/decrement/redis {productSku=IPHONE15, quantity=1}.

Response:
```json
{"path":"redis-lua-pre-decrement","productSku":"IPHONE15","quantity":1,"remaining":99,"soldOut":false,"redisKey":"stock:IPHONE15","lockType":"none-in-memory-atomic","ledgerWritten":true,"durableWrite":"inventory_ledgers-sync-insert"}
```

## Flow 2 — Inspect Redis counter vs Postgres ledger (PASS)

Request: GET /api/inventory/stock/IPHONE15.

Response:
```json
{"productSku":"IPHONE15","redisStock":99,"dbBaselineStock":100,"ledgerRowCount":1,"ledgerNetChange":-1,"redisKey":"stock:IPHONE15","sourceOfTruth":"redis-fast-counter + postgres-inventory_ledgers-per-sale"}
```

## Flow 3 — Oversell rejection (PASS)

Request: POST /api/inventory/decrement/redis {productSku=IPHONE15, quantity=200}.

Response:
```json
{"path":"redis-lua-pre-decrement","productSku":"IPHONE15","quantity":200,"remaining":0,"soldOut":true,"redisKey":"stock:IPHONE15","lockType":"none-in-memory-atomic","ledgerWritten":false,"note":"Lua rejected decrement — Postgres spared from oversell traffic."}
```

## Flow 4 — Pessimistic Postgres decrement (PASS)

Request: POST /api/inventory/decrement/db {productSku=IPHONE15, quantity=1}.

Response:
```json
{"path":"postgres-pessimistic-lock","productSku":"IPHONE15","quantity":1,"remaining":99,"soldOut":false,"lockType":"pessimistic-row","dbStock":99}
```

Summary: 4/4 flows PASS.
