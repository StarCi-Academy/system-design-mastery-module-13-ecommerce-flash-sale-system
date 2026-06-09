import { ConfigService } from "@nestjs/config"
import { NestFactory } from "@nestjs/core"
import { AppModule } from "./app.module"

async function bootstrap(): Promise<void> {
    const app = await NestFactory.create(AppModule)
    const cs = app.get(ConfigService)
    const port = cs.get<number>("app.port") ?? 3030
    await app.listen(port, "0.0.0.0")
    // eslint-disable-next-line no-console
    console.log(`waiting-room-api listening on :${port}`)
}

void bootstrap()
