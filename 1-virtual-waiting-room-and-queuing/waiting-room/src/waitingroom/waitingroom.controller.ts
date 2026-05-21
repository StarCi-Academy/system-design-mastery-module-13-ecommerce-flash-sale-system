import {
    Body,
    Controller,
    Get,
    Post,
    Query,
} from "@nestjs/common"
import {
    AdmitWaitingRoomDto,
} from "./dto"
import {
    WaitingroomService,
} from "./waitingroom.service"

/**
 * HTTP controller — virtual waiting room (lesson 1).
 * (EN: HTTP controller — virtual waiting room (lesson 1).)
 */
@Controller("api/waitingroom")
export class WaitingroomController {
    constructor(
        private readonly service: WaitingroomService,
    ) {}

    /**
     * Logic — cấp token / vào queue.
     * Code — GET token → issueToken.
     * (EN Logic: Issue queue token.)
     * (EN Code: GET token.)
     */
    @Get("token")
    token(
        @Query("userId") userId = "usr_123",
    ): ReturnType<WaitingroomService["issueToken"]> {
        return this.service.issueToken(userId)
    }

    /**
     * Logic — vị trí trong hàng.
     * Code — GET position → getPosition.
     * (EN Logic: Queue position.)
     * (EN Code: GET position.)
     */
    @Get("position")
    position(
        @Query("userId") userId = "usr_123",
    ): ReturnType<WaitingroomService["getPosition"]> {
        return this.service.getPosition(userId)
    }

    /**
     * Logic — trạng thái admit.
     * Code — GET status → getStatus.
     * (EN Logic: Admission status.)
     * (EN Code: GET status.)
     */
    @Get("status")
    status(
        @Query("userId") userId = "usr_123",
    ): ReturnType<WaitingroomService["getStatus"]> {
        return this.service.getStatus(userId)
    }

    /**
     * Logic — xả hàng đợi (admit batch từ đầu ZSET).
     * Code — POST admit → admitUsers.
     * (EN Logic: Batch admit from queue head.)
     * (EN Code: POST admit → admitUsers.)
     */
    @Post("admit")
    admit(
        @Body() body: AdmitWaitingRoomDto,
    ): ReturnType<WaitingroomService["admitUsers"]> {
        return this.service.admitUsers(body.count)
    }
}
