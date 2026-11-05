import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsBoolean } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class QueryProductsDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Include soft-deleted products' })
  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  withDeleted?: boolean;
}
