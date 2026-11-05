import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNumber,
  IsPositive,
  IsOptional,
  Min,
  MaxLength,
  IsDecimal,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateProductDto {
  @ApiProperty({ example: 'P0001' })
  @IsString()
  @MaxLength(50)
  productCode!: string;

  @ApiProperty({ example: 'Hydrococo 150ml' })
  @IsString()
  @MaxLength(255)
  productName!: string;

  @ApiProperty({ example: 50 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  stock!: number;

  @ApiProperty({ example: 12000 })
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  price!: number;

  @ApiPropertyOptional({ example: 5 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  lowStockThreshold?: number;
}
