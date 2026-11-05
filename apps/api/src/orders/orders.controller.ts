import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
  Headers,
  Res,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiHeader } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Response } from 'express';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { CancelOrderDto } from './dto/cancel-order.dto';
import { QueryOrdersDto } from './dto/query-orders.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthUser } from '../auth/interfaces/auth-user.interface';

@ApiTags('Orders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  @ApiOperation({ summary: 'List orders' })
  findAll(@Query() query: QueryOrdersDto) {
    return this.ordersService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get order detail' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.ordersService.findOne(BigInt(id));
  }

  @Post()
  @Throttle({ default: { limit: 20, ttl: 60000 } }) // 20 orders per minute per IP
  @ApiOperation({ summary: 'Create order' })
  @ApiHeader({ name: 'Idempotency-Key', required: false, description: 'UUID for idempotency' })
  create(
    @Body() dto: CreateOrderDto,
    @CurrentUser() user: AuthUser,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.ordersService.create(dto, user, idempotencyKey);
  }

  @Post(':id/pay')
  @ApiOperation({ summary: 'Mark order as PAID (admin/cashier)' })
  pay(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    return this.ordersService.pay(BigInt(id), user);
  }

  @Post(':id/ship')
  @Roles('admin')
  @ApiOperation({ summary: 'Mark order as SHIPPED (admin only)' })
  ship(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    return this.ordersService.ship(BigInt(id), user);
  }

  @Post(':id/complete')
  @Roles('admin')
  @ApiOperation({ summary: 'Mark order as COMPLETED (admin only)' })
  complete(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    return this.ordersService.complete(BigInt(id), user);
  }

  @Post(':id/cancel')
  @Roles('admin')
  @ApiOperation({ summary: 'Cancel order with reason (admin only)' })
  cancel(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CancelOrderDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.ordersService.cancel(BigInt(id), dto, user);
  }

  @Get(':id/invoice')
  @ApiOperation({ summary: 'Download order invoice (HTML)' })
  async invoice(
    @Param('id', ParseIntPipe) id: number,
    @Res() res: Response,
  ) {
    const html = await this.ordersService.getInvoice(BigInt(id));
    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Content-Disposition', `attachment; filename="invoice-${id}.html"`);
    res.status(HttpStatus.OK).send(html);
  }
}
