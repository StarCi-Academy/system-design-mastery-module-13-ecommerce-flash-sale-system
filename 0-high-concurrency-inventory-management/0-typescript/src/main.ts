import "reflect-metadata"
import { NestFactory } from "@nestjs/core"
import { ConfigService } from "@nestjs/config"
import { AppModule } from "./app.module"
import { InventoryService } from "./inventory/inventory.service"
import { InsufficientStockFilter } from "./inventory/insufficient-stock.exception"

async function bootstrap(): Promise<void> {
    const app = await NestFactory.create(AppModule)
    const config = app.get(ConfigService)
    const inventory = app.get(InventoryService)
    app.useGlobalFilters(new InsufficientStockFilter(inventory))
    const port = config.get<number>("app.port") ?? 3029
    await app.listen(port, "0.0.0.0")
}

void bootstrap()
