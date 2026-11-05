import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, MinLength } from 'class-validator';

export class CancelOrderDto {
  @ApiProperty({ example: 'Customer membatalkan pesanan' })
  @IsString()
  @IsNotEmpty()
  @MinLength(5)
  cancelReason!: string;
}
