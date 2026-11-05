import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { OrderNumberGenerator } from './order-number.generator';
import { IdempotencyService } from './idempotency.service';

@Module({
  imports: [
    BullModule.registerQueue(
      { name: 'invoice' },
      { name: 'notifications' },
    ),
  ],
  providers: [OrdersService, OrderNumberGenerator, IdempotencyService],
  controllers: [OrdersController],
  exports: [OrdersService],
})
export class OrdersModule {}
