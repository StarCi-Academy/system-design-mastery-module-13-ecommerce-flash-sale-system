import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import Redis from "ioredis";

import { CheckoutController } from "./checkout/checkout.controller";
import { CheckoutService } from "./checkout/checkout.service";
import { IdempotencyService } from "./checkout/idempotency.service";
import { OrderEntity } from "./checkout/order.entity";

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: "postgres",
      host: process.env.POSTGRES_HOST ?? "localhost",
      port: Number(process.env.POSTGRES_PORT ?? 5432),
      username: process.env.POSTGRES_USER ?? "postgres",
      password: process.env.POSTGRES_PASSWORD ?? "postgres",
      database: process.env.POSTGRES_DB ?? "checkout",
      entities: [OrderEntity],
      // Schema authority is .docker/init.sql, not TypeORM. Keeping synchronize
      // off avoids silent schema drift; the UNIQUE constraint lives in SQL.
      synchronize: false,
    }),
    TypeOrmModule.forFeature([OrderEntity]),
  ],
  controllers: [CheckoutController],
  providers: [
    CheckoutService,
    IdempotencyService,
    {
      provide: "REDIS",
      useFactory: () =>
        new Redis({
          host: process.env.REDIS_HOST ?? "localhost",
          port: Number(process.env.REDIS_PORT ?? 6379),
        }),
    },
  ],
})
export class AppModule {}
