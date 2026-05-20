import {
    IsString,
    IsNotEmpty,
} from "class-validator"

/**
 * Yêu cầu DTO đầu vào để xử lý thao tác.
 * (EN: Input DTO validating request payload.)
 */
export class CreateCheckoutDto {
    @IsString()
    @IsNotEmpty()
    title: string
}
