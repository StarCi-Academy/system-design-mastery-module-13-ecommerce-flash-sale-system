import { Module } from "@nestjs/common"
import { ConfigModule } from "@nestjs/config"
import { configuration } from "./config"
import { WaitingRoomModule } from "./waitingroom"

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            load: [configuration],
            envFilePath: [".env"],
        }),
        WaitingRoomModule,
    ],
})
export class AppModule {}
