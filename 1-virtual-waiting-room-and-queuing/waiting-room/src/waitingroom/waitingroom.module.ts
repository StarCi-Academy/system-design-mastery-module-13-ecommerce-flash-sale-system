import {
    Module,
} from "@nestjs/common"
import {
    TypeOrmModule,
} from "@nestjs/typeorm"
import {
    WaitingroomEntity,
} from "./entities"
import {
    WaitingroomService,
} from "./waitingroom.service"
import {
    WaitingroomController,
} from "./waitingroom.controller"

/**
 * Feature Module quản lý bài học Virtual Waiting Room and Queuing.
 * (EN: Feature Module managing lesson Virtual Waiting Room and Queuing.)
 */
@Module({
    imports: [
        TypeOrmModule.forFeature([WaitingroomEntity]),
    ],
    controllers: [WaitingroomController],
    providers: [WaitingroomService],
    exports: [WaitingroomService],
})
export class WaitingroomModule {}
