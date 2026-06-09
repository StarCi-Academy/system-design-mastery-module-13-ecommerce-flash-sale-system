import { Module } from "@nestjs/common"
import { HealthController } from "./health.controller"
import { redisProvider } from "./redis.provider"
import { WaitingRoomController } from "./waitingroom.controller"
import { WaitingRoomService } from "./waitingroom.service"

@Module({
    controllers: [WaitingRoomController, HealthController],
    providers: [redisProvider, WaitingRoomService],
})
export class WaitingRoomModule {}
