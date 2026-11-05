import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../common/prisma/prisma.service';
import { RedisService } from '../common/redis/redis.service';
import { MailService } from '../notifications/mail.service';

@Processor('invoice')
export class InvoiceProcessor extends WorkerHost {
  private readonly logger = new Logger(InvoiceProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly mailService: MailService,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    const { orderId } = job.data as { orderId: string };
    this.logger.log(`Processing invoice for order ${orderId}`);

    // Idempotency check - don't send twice
    const sentKey = `invoice:sent:${orderId}`;
    const alreadySent = await this.redis.get(sentKey);
    if (alreadySent) {
      this.logger.log(`Invoice for order ${orderId} already sent, skipping`);
      return;
    }

    const order = await this.prisma.order.findUnique({
      where: { id: BigInt(orderId) },
      include: {
        customer: true,
        items: {
          include: {
            product: { select: { productCode: true, productName: true } },
          },
        },
      },
    });

    if (!order) {
      this.logger.error(`Order ${orderId} not found`);
      return;
    }

    if (!order.customer.email) {
      this.logger.warn(`Customer ${order.customer.id} has no email, skipping invoice`);
      // Mark as sent so we don't retry
      await this.redis.set(sentKey, '1', 86400 * 7);
      return;
    }

    const itemsHtml = order.items
      .map(
        (item) =>
          `<tr>
            <td>${item.product.productCode}</td>
            <td>${item.product.productName}</td>
            <td>${item.quantity}</td>
            <td>Rp ${Number(item.unitPrice).toLocaleString('id-ID')}</td>
            <td>Rp ${Number(item.subtotal).toLocaleString('id-ID')}</td>
          </tr>`,
      )
      .join('');

    const html = `
      <h2>Invoice ${order.orderNumber}</h2>
      <p>Halo ${order.customer.customerName},</p>
      <p>Pembayaran order Anda telah diterima.</p>
      <table border="1" cellpadding="6">
        <tr><th>Kode</th><th>Produk</th><th>Qty</th><th>Harga</th><th>Subtotal</th></tr>
        ${itemsHtml}
        <tr><td colspan="4"><b>Total</b></td><td><b>Rp ${Number(order.totalAmount).toLocaleString('id-ID')}</b></td></tr>
      </table>
      <p>Terima kasih telah berbelanja!</p>
    `;

    await this.mailService.send({
      to: order.customer.email,
      subject: `Invoice ${order.orderNumber} - Azatech Shop`,
      html,
    });

    // Mark as sent (7 days TTL)
    await this.redis.set(sentKey, '1', 86400 * 7);
    this.logger.log(`Invoice sent for order ${orderId} to ${order.customer.email}`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error): void {
    this.logger.error(`Invoice job ${job.id} failed: ${error.message}`);
  }
}
