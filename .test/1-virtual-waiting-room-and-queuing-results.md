# Lesson 1 — Virtual Waiting Room and Queuing — Test Results

Run at: 2026-05-23
Port: 3030.
Image: starciacademy/system-design-virtual-waiting-room-and-queuing-waiting-room:latest.

## Flow 1 — Enqueue three users (PASS)

GET /api/waitingroom/token?userId={usr1,usr2,usr3}.

- usr1 → position 1, queueSize 1, newlyEnqueued true.
- usr2 → position 2, queueSize 2.
- usr3 → position 3, queueSize 3.

## Flow 2 — Position check for usr2 (PASS)

GET /api/waitingroom/position?userId=usr2 → `{"userId":"usr2","position":2,"inQueue":true,"redisCommand":"ZRANK"}`.

## Flow 3 — Admit batch of 2 (PASS)

POST /api/waitingroom/admit {count:2} → admitted usr1, usr2; queueRemaining 1; commands ZRANGE+SADD+ZREM+EXPIRE.

## Flow 4 — Status differentiation (PASS)

- usr1 → status admitted, checkoutToken issued.
- usr3 → status waiting, position 1 (moved up after admit).

Summary: 4/4 flows PASS.
