import { Inject, Injectable } from "@nestjs/common";
import Redis from "ioredis";

import { OrderResult } from "./dto";

// Tri-state outcome of trying to acquire the idempotency lock.
export type AcquireResult =
  | { state: "ACQUIRED" } // first request wins the key
  | { state: "PENDING" } // another request is still processing
  | { state: "REPLAY"; result: OrderResult }; // a finished result is cached, replay it

const PENDING = "PENDING";
const PENDING_TTL_SEC = 30;
const RESULT_TTL_SEC = 60 * 60 * 24; // 24 hours

@Injectable()
export class IdempotencyService {
  constructor(@Inject("REDIS") private readonly redis: Redis) {}

  // Try to claim the key. SET NX is atomic: only ONE concurrent caller can
  // create the key. EX 30 auto-releases the PENDING marker if the owner
  // crashes mid-flight.
  async acquire(key: string): Promise<AcquireResult> {
    const redisKey = `idempotency:${key}`;
    const ok = await this.redis.set(
      redisKey,
      PENDING,
      "EX",
      PENDING_TTL_SEC,
      "NX",
    );
    if (ok === "OK") return { state: "ACQUIRED" };

    // Key already exists: either still PENDING, or a cached JSON result.
    const current = await this.redis.get(redisKey);
    if (current === PENDING) return { state: "PENDING" };
    return { state: "REPLAY", result: JSON.parse(current as string) };
  }

  // Overwrite the PENDING marker with the JSON result and a long TTL so later
  // retries replay it instead of reprocessing.
  async storeResult(key: string, result: OrderResult): Promise<void> {
    await this.redis.set(
      `idempotency:${key}`,
      JSON.stringify(result),
      "EX",
      RESULT_TTL_SEC,
    );
  }
}
