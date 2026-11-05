import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../common/prisma/prisma.service';
import { MailService } from '../notifications/mail.service';

@Processor('notifications')
export class NotificationsProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationsProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    const { name } = job;

    if (name === 'low-stock') {
      await this.handleLowStock(job.data as { productId: string });
    }
  }

  private async handleLowStock(data: { productId: string }): Promise<void> {
    const { productId } = data;
    this.logger.log(`Low stock notification for product ${productId}`);

    const product = await this.prisma.product.findUnique({
      where: { id: BigInt(productId) },
    });

    if (!product) return;

    // Find admin users to notify
    const admins = await this.prisma.user.findMany({
      where: { role: 'admin' },
      select: { email: true, name: true },
    });

    for (const admin of admins) {
      await this.mailService.send({
        to: admin.email,
        subject: `⚠️ Stok Rendah: ${product.productName}`,
        html: `
          <h3>Peringatan Stok Rendah</h3>
          <p>Produk <strong>${product.productName}</strong> (${product.productCode}) 
          memiliki stok tersisa <strong>${product.stock}</strong> unit.</p>
          <p>Threshold minimum: ${product.lowStockThreshold}</p>
          <p>Segera lakukan stock adjustment.</p>
        `,
      });
    }
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error): void {
    this.logger.error(`Notification job ${job.id} failed: ${error.message}`);
  }
}
