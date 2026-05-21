import {
    Module,
} from "@nestjs/common"
import {
    WaitingroomController,
} from "./waitingroom.controller"
import {
    WaitingroomService,
} from "./waitingroom.service"

/**
 * Feature module — Redis ZSET waiting room.
 * (EN: Feature module — Redis ZSET waiting room.)
 */
@Module({
    controllers: [WaitingroomController],
    providers: [WaitingroomService],
})
export class WaitingroomModule {}
