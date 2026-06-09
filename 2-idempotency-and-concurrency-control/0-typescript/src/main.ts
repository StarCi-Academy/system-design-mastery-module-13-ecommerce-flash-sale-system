import "reflect-metadata";
import { NestFactory } from "@nestjs/core";

import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const port = Number(process.env.PORT ?? 3031);
  await app.listen(port, "0.0.0.0");
  // eslint-disable-next-line no-console
  console.log(`checkout-service listening on :${port}`);
}

bootstrap();
