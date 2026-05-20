import {
    Controller,
    Get,
    Post,
    Query,
} from "@nestjs/common"
import {
    WaitingroomService,
} from "./waitingroom.service"

/**
 * REST controller exposing virtual waiting-room endpoints.
 */
@Controller("api/waitingroom")
export class WaitingroomController {
    constructor(
        private readonly service: WaitingroomService,
    ) {}

    @Get("token")
    issueToken(@Query("userId") userId = "usr_123") {
        return this.service.issueToken(userId)
    }

    @Post("admit")
    admit(@Query("limit") limit = "1") {
        return this.service.admit(Number(limit) || 1)
    }
}
