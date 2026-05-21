import {
    IsInt,
    Min,
} from "class-validator"

/**
 * DTO admit phòng chờ — số user lấy từ đầu hàng.
 * (EN: Admit waiting room DTO — batch size from queue head.)
 */
export class AdmitWaitingRoomDto {
    @IsInt()
    @Min(1)
    count!: number
}
