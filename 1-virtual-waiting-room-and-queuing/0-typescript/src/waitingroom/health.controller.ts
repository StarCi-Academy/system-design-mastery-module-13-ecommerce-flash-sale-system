import { Controller, Get } from "@nestjs/common"

@Controller()
export class HealthController {
    @Get("health")
    public health(): { status: string } {
        return { status: "ok" }
    }
}
