import { Body, Controller, Get, Headers, Post, Res } from "@nestjs/common";
import type { Response } from "express";

import { CheckoutService } from "./checkout.service";
import { CreateOrderDto } from "./dto";

@Controller()
export class CheckoutController {
  constructor(private readonly checkout: CheckoutService) {}

  @Get("health")
  health(): { status: string } {
    return { status: "ok" };
  }

  // POST /api/checkout/order
  // 201 on first creation, 200 on replay, 409 on in-flight duplicate.
  @Post("api/checkout/order")
  async createOrder(
    @Headers("idempotency-key") key: string,
    @Body() dto: CreateOrderDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const idempotencyKey = key ?? "missing-idempotency-key";
    const result = await this.checkout.handleCheckout(idempotencyKey, dto);
    // First creation returns 201; a replayed result returns 200.
    res.status(result.replayed ? 200 : 201);
    return result;
  }
}
