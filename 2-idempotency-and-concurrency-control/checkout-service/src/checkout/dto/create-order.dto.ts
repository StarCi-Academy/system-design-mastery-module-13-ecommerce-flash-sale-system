import {
    IsInt,
    IsNotEmpty,
    IsString,
    Min,
} from "class-validator"

/**
 * DTO đặt hàng checkout.
 * (EN: Checkout create order DTO.)
 */
export class CreateOrderDto {
    @IsString()
    @IsNotEmpty()
    userId!: string

    @IsString()
    @IsNotEmpty()
    productSku!: string

    @IsInt()
    @Min(1)
    quantity!: number
}
