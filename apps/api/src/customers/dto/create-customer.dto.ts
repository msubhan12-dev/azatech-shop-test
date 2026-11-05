import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsEmail,
  IsEnum,
  IsDateString,
  MaxLength,
} from 'class-validator';

export enum Gender {
  Pria = 'Pria',
  Wanita = 'Wanita',
}

export class CreateCustomerDto {
  @ApiProperty({ example: 'Budi Santoso' })
  @IsString()
  @MaxLength(255)
  customerName!: string;

  @ApiProperty({ example: 'Jl. Sudirman No.1, Jakarta' })
  @IsString()
  @MaxLength(500)
  customerAddress!: string;

  @ApiProperty({ enum: Gender })
  @IsEnum(Gender)
  gender!: Gender;

  @ApiPropertyOptional({ example: '1995-02-10' })
  @IsOptional()
  @IsDateString()
  birthDate?: string;

  @ApiPropertyOptional({ example: '081234567890' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @ApiPropertyOptional({ example: 'budi@email.com' })
  @IsOptional()
  @IsEmail()
  email?: string;
}
