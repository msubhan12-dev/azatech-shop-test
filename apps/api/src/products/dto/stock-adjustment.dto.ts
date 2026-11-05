import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsString, MinLength, IsNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';

export class StockAdjustmentDto {
  @ApiProperty({ example: 10, description: 'Positive to add, negative to remove' })
  @Type(() => Number)
  @IsNumber()
  quantityChange!: number;

  @ApiProperty({ example: 'Stock opname bulanan' })
  @IsString()
  @IsNotEmpty()
  @MinLength(5)
  note!: string;
}
