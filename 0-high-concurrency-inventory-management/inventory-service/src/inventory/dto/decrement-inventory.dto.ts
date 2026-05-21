import {
    IsInt,
    IsNotEmpty,
    IsString,
    Min,
} from "class-validator"

/**
 * DTO trừ kho — SKU + số lượng.
 * (EN: Decrement inventory DTO — SKU and quantity.)
 */
export class DecrementInventoryDto {
    @IsString()
    @IsNotEmpty()
    productSku!: string

    @IsInt()
    @Min(1)
    quantity!: number
}
