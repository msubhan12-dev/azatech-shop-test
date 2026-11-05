import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { StockAdjustmentDto } from './dto/stock-adjustment.dto';
import { QueryProductsDto } from './dto/query-products.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthUser } from '../auth/interfaces/auth-user.interface';
import { PaginationDto } from '../common/dto/pagination.dto';

@ApiTags('Products')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  @ApiOperation({ summary: 'List products with pagination' })
  findAll(@Query() query: QueryProductsDto) {
    return this.productsService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get product by ID' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.productsService.findOne(BigInt(id));
  }

  @Post()
  @Roles('admin')
  @ApiOperation({ summary: 'Create product (admin only)' })
  create(@Body() dto: CreateProductDto, @CurrentUser() user: AuthUser) {
    return this.productsService.create(dto, user);
  }

  @Put(':id')
  @Roles('admin')
  @ApiOperation({ summary: 'Update product (admin only)' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateProductDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.productsService.update(BigInt(id), dto, user);
  }

  @Delete(':id')
  @Roles('admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft delete product (admin only)' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.productsService.remove(BigInt(id));
  }

  @Post(':id/stock-adjustments')
  @Roles('admin')
  @ApiOperation({ summary: 'Stock adjustment (admin only)' })
  adjustStock(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: StockAdjustmentDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.productsService.adjustStock(BigInt(id), dto, user);
  }

  @Get(':id/stock-movements')
  @Roles('admin')
  @ApiOperation({ summary: 'Get stock movement history (admin only)' })
  getStockMovements(
    @Param('id', ParseIntPipe) id: number,
    @Query() query: PaginationDto,
  ) {
    return this.productsService.getStockMovements(
      BigInt(id),
      query.page,
      query.perPage,
    );
  }
}
