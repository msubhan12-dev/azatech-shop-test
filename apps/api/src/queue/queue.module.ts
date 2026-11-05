import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { InvoiceProcessor } from './invoice.processor';
import { NotificationsProcessor } from './notifications.processor';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    BullModule.registerQueue(
      { name: 'invoice' },
      { name: 'notifications' },
    ),
    NotificationsModule,
  ],
  providers: [InvoiceProcessor, NotificationsProcessor],
})
export class QueueModule {}
