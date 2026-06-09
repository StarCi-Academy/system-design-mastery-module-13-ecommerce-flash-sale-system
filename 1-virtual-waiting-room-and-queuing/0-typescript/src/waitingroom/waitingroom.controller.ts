import { Body, Controller, Get, HttpCode, Post, Query } from "@nestjs/common"
import { WaitingRoomService } from "./waitingroom.service"

interface AdmitBody {
    count?: number
}

@Controller("api/waitingroom")
export class WaitingRoomController {
    public constructor(private readonly service: WaitingRoomService) {}

    @Get("token")
    public async token(): Promise<{ token: string; position: number }> {
        return this.service.enqueue()
    }

    @Get("position")
    public async position(
        @Query("token") token: string,
    ): Promise<{ token: string; position: number | null; admitted: boolean }> {
        return this.service.position(token)
    }

    @Post("admit")
    @HttpCode(200)
    public async admit(
        @Body() body: AdmitBody,
    ): Promise<{ admitted: string[]; count: number }> {
        const count = Math.max(1, Math.floor(Number(body?.count ?? 1)))
        return this.service.admit(count)
    }

    @Get("status")
    public async status(
        @Query("token") token: string,
    ): Promise<{ token: string; state: string; position: number | null }> {
        return this.service.status(token)
    }
}
