import { ConflictException, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { QueryFailedError, Repository } from "typeorm";

import { CreateOrderDto, OrderResult } from "./dto";
import { IdempotencyService } from "./idempotency.service";
import { OrderEntity } from "./order.entity";

// Artificial delay (ms) that widens the PENDING window so a concurrent
// duplicate can reliably be observed hitting the 409 branch in a demo.
const PROCESSING_DELAY_MS = Number(
  process.env.CHECKOUT_PROCESSING_DELAY_MS ?? 1500,
);

function isUniqueViolation(e: unknown): boolean {
  // PostgreSQL unique_violation error code is 23505.
  return e instanceof QueryFailedError && (e as any).code === "23505";
}

@Injectable()
export class CheckoutService {
  constructor(
    private readonly idempotency: IdempotencyService,
    @InjectRepository(OrderEntity)
    private readonly orders: Repository<OrderEntity>,
  ) {}

  async handleCheckout(key: string, dto: CreateOrderDto): Promise<OrderResult> {
    const acquired = await this.idempotency.acquire(key);

    // Duplicate that arrives while the first request is still processing.
    if (acquired.state === "PENDING") {
      throw new ConflictException({
        statusCode: 409,
        message: "Request in progress",
        idempotencyKey: key,
      });
    }
    // Duplicate that arrives after completion: replay the cached result.
    if (acquired.state === "REPLAY") {
      return { ...acquired.result, replayed: true };
    }

    // We hold the lock (ACQUIRED). Do the real, side-effecting work once.
    const order = await this.createOrder(key, dto);
    const result: OrderResult = {
      orderId: order.id,
      status: order.status,
      amount: order.amount,
      replayed: false,
    };

    await this.idempotency.storeResult(key, result);
    return result;
  }

  private async createOrder(
    key: string,
    dto: CreateOrderDto,
  ): Promise<OrderEntity> {
    // Widen the PENDING window so the race is observable.
    await new Promise((r) => setTimeout(r, PROCESSING_DELAY_MS));
    try {
      const order = this.orders.create({
        idempotencyKey: key,
        status: "CONFIRMED",
        amount: dto.amount,
        sku: dto.sku,
      });
      return await this.orders.save(order);
    } catch (e) {
      // Last-line defense: even if two threads bypass Redis, the DB rejects
      // the second insert. Recover the existing order and replay it.
      if (isUniqueViolation(e)) {
        const existing = await this.orders.findOneByOrFail({
          idempotencyKey: key,
        });
        return existing;
      }
      throw e;
    }
  }
}
