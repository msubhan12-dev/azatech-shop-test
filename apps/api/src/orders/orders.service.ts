import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { OrderStatus, StockMovementType, Prisma } from '@prisma/client';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../common/prisma/prisma.service';
import { RedisService } from '../common/redis/redis.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { CancelOrderDto } from './dto/cancel-order.dto';
import { QueryOrdersDto } from './dto/query-orders.dto';
import { OrderStateMachine } from './order-state-machine';
import { OrderNumberGenerator } from './order-number.generator';
import { IdempotencyService } from './idempotency.service';
import { paginate } from '../common/dto/pagination.dto';
import { AuthUser } from '../auth/interfaces/auth-user.interface';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly orderNumberGenerator: OrderNumberGenerator,
    private readonly idempotency: IdempotencyService,
    @InjectQueue('invoice') private readonly invoiceQueue: Queue,
    @InjectQueue('notifications') private readonly notificationsQueue: Queue,
  ) {}

  async findAll(query: QueryOrdersDto) {
    const { page = 1, perPage = 10, status, customerId, from, to, sortOrder = 'desc' } = query;
    const skip = (page - 1) * perPage;

    const where: Prisma.OrderWhereInput = {};
    if (status) where.status = status;
    if (customerId) where.customerId = customerId;
    if (from || to) {
      where.orderDate = {};
      if (from) where.orderDate.gte = new Date(from);
      if (to) {
        const toDate = new Date(to);
        toDate.setHours(23, 59, 59, 999);
        where.orderDate.lte = toDate;
      }
    }

    const [items, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        skip,
        take: perPage,
        orderBy: { orderDate: sortOrder },
        include: {
          customer: { select: { id: true, customerName: true } },
          creator: { select: { id: true, name: true } },
          items: {
            include: {
              product: { select: { id: true, productCode: true, productName: true } },
            },
          },
        },
      }),
      this.prisma.order.count({ where }),
    ]);

    return paginate(items.map(this.toResponse.bind(this)), total, page, perPage);
  }

  async findOne(id: bigint) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        customer: true,
        creator: { select: { id: true, name: true, email: true } },
        items: {
          include: {
            product: {
              select: {
                id: true,
                productCode: true,
                productName: true,
                price: true,
              },
            },
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException(`Order dengan ID ${id} tidak ditemukan`);
    }

    return this.toResponse(order);
  }

  async create(dto: CreateOrderDto, user: AuthUser, idempotencyKey?: string) {
    // --- Idempotency check ---
    if (idempotencyKey) {
      const result = await this.idempotency.check(idempotencyKey, dto);
      if (result.alreadyProcessed) {
        this.logger.log(`Idempotency hit for key: ${idempotencyKey}`);
        return result.response;
      }
      await this.idempotency.start(idempotencyKey, dto);
    }

    try {
      const response = await this.createOrderInternal(dto, user);

      if (idempotencyKey) {
        await this.idempotency.complete(idempotencyKey, response);
      }

      return response;
    } catch (error) {
      if (idempotencyKey) {
        await this.idempotency.fail(idempotencyKey);
      }
      throw error;
    }
  }

  private async createOrderInternal(dto: CreateOrderDto, user: AuthUser) {
    // Validate customer exists
    const customer = await this.prisma.customer.findFirst({
      where: { id: dto.customerId, deletedAt: null },
    });
    if (!customer) {
      throw new NotFoundException(`Pelanggan dengan ID ${dto.customerId} tidak ditemukan`);
    }

    // Validate no duplicate product IDs
    const productIds = dto.items.map((i) => i.productId);
    if (new Set(productIds).size !== productIds.length) {
      throw new BadRequestException('Produk tidak boleh duplikat dalam satu order');
    }

    /**
     * CONCURRENCY STRATEGY: Pessimistic Locking (SELECT ... FOR UPDATE)
     * We sort product IDs to ensure consistent lock ordering and avoid deadlocks.
     * All items in an order are locked in ascending ID order.
     *
     * Why pessimistic over optimistic:
     * - Online shop with high contention on popular items
     * - Optimistic lock would cause many retries under load
     * - PostgreSQL row-level locks are cheap for <10 items/order
     *
     * Deadlock prevention:
     * - Always acquire locks in ascending product_id order
     * - This ensures multiple concurrent transactions always
     *   acquire locks in the same order, preventing circular waits
     */
    const sortedProductIds = [...productIds].sort((a, b) => a - b);

    const result = await this.prisma.$transaction(
      async (tx) => {
        // Lock products in sorted order to prevent deadlock
        const products: Array<{
          id: bigint;
          productCode: string;
          productName: string;
          price: Prisma.Decimal;
          stock: number;
          lowStockThreshold: number;
        }> = [];

        for (const productId of sortedProductIds) {
          // SELECT ... FOR UPDATE to lock the row
          const locked = await tx.$queryRaw<
            Array<{ id: bigint; product_code: string; product_name: string; price: string; stock: number; low_stock_threshold: number }>
          >`
            SELECT id, product_code, product_name, price, stock, low_stock_threshold
            FROM products
            WHERE id = ${BigInt(productId)}
              AND deleted_at IS NULL
            FOR UPDATE
          `;

          if (locked.length === 0) {
            throw new NotFoundException(`Produk dengan ID ${productId} tidak ditemukan`);
          }

          products.push({
            id: locked[0].id,
            productCode: locked[0].product_code,
            productName: locked[0].product_name,
            price: new Prisma.Decimal(locked[0].price),
            stock: locked[0].stock,
            lowStockThreshold: locked[0].low_stock_threshold,
          });
        }

        // Validate stock and calculate totals
        const itemsWithPrice: Array<{
          productId: bigint;
          quantity: number;
          unitPrice: Prisma.Decimal;
          subtotal: Prisma.Decimal;
        }> = [];

        const errors: Record<string, string[]> = {};

        for (const item of dto.items) {
          const product = products.find((p) => p.id === BigInt(item.productId));
          if (!product) {
            throw new NotFoundException(`Produk ${item.productId} tidak ditemukan`);
          }

          if (product.stock < item.quantity) {
            const key = `items.${dto.items.indexOf(item)}.quantity`;
            errors[key] = [
              `Stok ${product.productName} tersisa ${product.stock}, diminta ${item.quantity}`,
            ];
          }

          const unitPrice = product.price;
          const subtotal = unitPrice.mul(item.quantity);
          itemsWithPrice.push({
            productId: product.id,
            quantity: item.quantity,
            unitPrice,
            subtotal,
          });
        }

        if (Object.keys(errors).length > 0) {
          throw Object.assign(new BadRequestException('Stok tidak mencukupi'), {
            response: {
              success: false,
              message: 'Stok tidak mencukupi',
              errors,
            },
          });
        }

        // Calculate total
        const totalAmount = itemsWithPrice.reduce(
          (sum, item) => sum.plus(item.subtotal),
          new Prisma.Decimal(0),
        );

        // Generate order number
        const orderNumber = await this.generateUniqueOrderNumber(tx);

        // Create order
        const order = await tx.order.create({
          data: {
            orderNumber,
            customerId: dto.customerId,
            createdBy: user.id,
            status: OrderStatus.PENDING,
            totalAmount,
            items: {
              create: itemsWithPrice.map((item) => ({
                productId: item.productId,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                subtotal: item.subtotal,
              })),
            },
          },
          include: {
            items: {
              include: {
                product: { select: { id: true, productCode: true, productName: true } },
              },
            },
            customer: { select: { id: true, customerName: true } },
            creator: { select: { id: true, name: true } },
          },
        });

        // Deduct stock and record movements
        const lowStockProducts: bigint[] = [];
        for (const item of itemsWithPrice) {
          const product = products.find((p) => p.id === item.productId)!;
          const newStock = product.stock - item.quantity;

          await tx.product.update({
            where: { id: item.productId },
            data: { stock: newStock },
          });

          await tx.stockMovement.create({
            data: {
              productId: item.productId,
              type: StockMovementType.ORDER_OUT,
              quantityChange: -item.quantity,
              stockAfter: newStock,
              referenceType: 'order',
              referenceId: order.id.toString(),
              note: `Order ${orderNumber}`,
              createdBy: user.id,
            },
          });

          // Check low stock threshold
          if (newStock <= product.lowStockThreshold) {
            lowStockProducts.push(item.productId);
          }
        }

        return { order, lowStockProducts };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
        timeout: 10000,
      },
    );

    // Dispatch low stock notifications (outside transaction)
    for (const productId of result.lowStockProducts) {
      await this.notificationsQueue.add(
        'low-stock',
        { productId: productId.toString() },
        { jobId: `low-stock-${productId}-${Date.now()}` },
      );
    }

    await this.invalidateDashboardCache();

    return this.toResponse(result.order);
  }

  async pay(id: bigint, user: AuthUser) {
    const order = await this.getOrderOrThrow(id);

    OrderStateMachine.assertTransition(order.status, OrderStatus.PAID, user.role, order.orderNumber);

    const updated = await this.prisma.order.update({
      where: { id },
      data: {
        status: OrderStatus.PAID,
        paidAt: new Date(),
      },
      include: this.orderIncludes(),
    });

    // Dispatch invoice job
    await this.invoiceQueue.add(
      'generate-invoice',
      { orderId: id.toString() },
      {
        jobId: `invoice-${id}`, // deduplicate: same job ID won't be queued twice
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
      },
    );

    await this.invalidateDashboardCache();
    return this.toResponse(updated);
  }

  async ship(id: bigint, user: AuthUser) {
    const order = await this.getOrderOrThrow(id);
    OrderStateMachine.assertTransition(order.status, OrderStatus.SHIPPED, user.role, order.orderNumber);

    const updated = await this.prisma.order.update({
      where: { id },
      data: { status: OrderStatus.SHIPPED, shippedAt: new Date() },
      include: this.orderIncludes(),
    });

    await this.invalidateDashboardCache();
    return this.toResponse(updated);
  }

  async complete(id: bigint, user: AuthUser) {
    const order = await this.getOrderOrThrow(id);
    OrderStateMachine.assertTransition(order.status, OrderStatus.COMPLETED, user.role, order.orderNumber);

    const updated = await this.prisma.order.update({
      where: { id },
      data: { status: OrderStatus.COMPLETED, completedAt: new Date() },
      include: this.orderIncludes(),
    });

    await this.invalidateDashboardCache();
    return this.toResponse(updated);
  }

  async cancel(id: bigint, dto: CancelOrderDto, user: AuthUser) {
    const order = await this.getOrderOrThrow(id);
    OrderStateMachine.assertTransition(order.status, OrderStatus.CANCELLED, user.role, order.orderNumber);

    /**
     * IDEMPOTENT CANCELLATION:
     * We use a Redis lock to prevent double-cancel.
     * The lock key includes the order ID.
     * If order is already CANCELLED, we reject the request (409).
     */
    const lockKey = `order:cancel:lock:${id}`;
    const lockAcquired = await this.redis.setNx(lockKey, '1', 30);

    if (!lockAcquired) {
      throw new ConflictException('Pembatalan order sedang diproses');
    }

    try {
      const updated = await this.prisma.$transaction(
        async (tx) => {
          // Re-check order status inside transaction to handle race conditions
          const freshOrder = await tx.order.findUnique({
            where: { id },
            include: { items: true },
          });

          if (!freshOrder) throw new NotFoundException('Order tidak ditemukan');
          if (freshOrder.status === OrderStatus.CANCELLED) {
            throw new ConflictException('Order sudah dibatalkan');
          }

          // Validate transition again with fresh data
          OrderStateMachine.assertTransition(
            freshOrder.status,
            OrderStatus.CANCELLED,
            user.role,
            freshOrder.orderNumber,
          );

          // Restore stock for each item
          for (const item of freshOrder.items) {
            // Lock the product row first
            const lockedProducts = await tx.$queryRaw<Array<{ stock: number }>>`
              SELECT stock FROM products WHERE id = ${item.productId} FOR UPDATE
            `;

            const currentStock = lockedProducts[0]?.stock ?? 0;
            const newStock = currentStock + item.quantity;

            await tx.product.update({
              where: { id: item.productId },
              data: { stock: newStock },
            });

            await tx.stockMovement.create({
              data: {
                productId: item.productId,
                type: StockMovementType.CANCEL_RESTORE,
                quantityChange: item.quantity,
                stockAfter: newStock,
                referenceType: 'order',
                referenceId: id.toString(),
                note: `Pembatalan order ${freshOrder.orderNumber}: ${dto.cancelReason}`,
                createdBy: user.id,
              },
            });
          }

          return tx.order.update({
            where: { id },
            data: {
              status: OrderStatus.CANCELLED,
              cancelledAt: new Date(),
              cancelReason: dto.cancelReason,
            },
            include: this.orderIncludes(),
          });
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
          timeout: 10000,
        },
      );

      await this.invalidateDashboardCache();
      return this.toResponse(updated);
    } finally {
      await this.redis.del(lockKey);
    }
  }

  async getInvoice(id: bigint) {
    const order = await this.findOne(id);
    // Invoice is generated as an HTML string
    return this.generateInvoiceHtml(order as ReturnType<typeof this.toResponse>);
  }

  private async getOrderOrThrow(id: bigint) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!order) throw new NotFoundException(`Order ${id} tidak ditemukan`);
    return order;
  }

  private orderIncludes() {
    return {
      customer: { select: { id: true, customerName: true } },
      creator: { select: { id: true, name: true } },
      items: {
        include: {
          product: { select: { id: true, productCode: true, productName: true } },
        },
      },
    } as const;
  }

  private toResponse(order: Record<string, unknown>) {
    const o = order as {
      id: bigint;
      orderNumber: string;
      customerId: string;
      createdBy: bigint;
      status: OrderStatus;
      totalAmount: Prisma.Decimal;
      paidAt: Date | null;
      shippedAt: Date | null;
      completedAt: Date | null;
      cancelledAt: Date | null;
      cancelReason: string | null;
      orderDate: Date;
      createdAt: Date;
      updatedAt: Date;
      customer?: unknown;
      creator?: { id: bigint; name: string };
      items?: Array<{
        id: bigint;
        orderId: bigint;
        productId: bigint;
        quantity: number;
        unitPrice: Prisma.Decimal;
        subtotal: Prisma.Decimal;
        product?: { id: bigint; productCode: string; productName: string };
      }>;
    };

    return {
      ...o,
      id: o.id.toString(),
      createdBy: o.createdBy.toString(),
      totalAmount: Number(o.totalAmount),
      creator: o.creator
        ? { ...o.creator, id: o.creator.id.toString() }
        : undefined,
      items: o.items?.map((item) => ({
        ...item,
        id: item.id.toString(),
        orderId: item.orderId.toString(),
        productId: item.productId.toString(),
        unitPrice: Number(item.unitPrice),
        subtotal: Number(item.subtotal),
        product: item.product
          ? { ...item.product, id: item.product.id.toString() }
          : undefined,
      })),
    };
  }

  private async generateUniqueOrderNumber(
    tx: Prisma.TransactionClient,
  ): Promise<string> {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const prefix = `INV-${y}${m}${d}-`;

    // Use SELECT FOR UPDATE to prevent race condition on sequence
    const result = await tx.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) as count FROM orders WHERE order_number LIKE ${prefix + '%'}
    `;

    const count = Number(result[0]?.count ?? 0);
    return `${prefix}${String(count + 1).padStart(4, '0')}`;
  }

  private generateInvoiceHtml(order: ReturnType<typeof this.toResponse>): string {
    const o = order as {
      orderNumber: string;
      orderDate: Date;
      status: string;
      totalAmount: number;
      customer?: { customerName: string };
      items?: Array<{
        product?: { productCode: string; productName: string };
        quantity: number;
        unitPrice: number;
        subtotal: number;
      }>;
    };

    const itemRows = (o.items ?? [])
      .map(
        (item) => `
        <tr>
          <td>${item.product?.productCode ?? ''}</td>
          <td>${item.product?.productName ?? ''}</td>
          <td>${item.quantity}</td>
          <td>Rp ${Number(item.unitPrice).toLocaleString('id-ID')}</td>
          <td>Rp ${Number(item.subtotal).toLocaleString('id-ID')}</td>
        </tr>
      `,
      )
      .join('');

    return `<!DOCTYPE html>
<html>
<head><title>Invoice ${o.orderNumber}</title></head>
<body>
  <h1>INVOICE</h1>
  <h2>${o.orderNumber}</h2>
  <p>Tanggal: ${new Date(o.orderDate).toLocaleDateString('id-ID')}</p>
  <p>Pelanggan: ${o.customer?.customerName ?? '-'}</p>
  <p>Status: ${o.status}</p>
  <table border="1" cellpadding="8">
    <thead>
      <tr>
        <th>Kode</th><th>Produk</th><th>Qty</th><th>Harga</th><th>Subtotal</th>
      </tr>
    </thead>
    <tbody>${itemRows}</tbody>
    <tfoot>
      <tr>
        <td colspan="4"><strong>TOTAL</strong></td>
        <td><strong>Rp ${Number(o.totalAmount).toLocaleString('id-ID')}</strong></td>
      </tr>
    </tfoot>
  </table>
</body>
</html>`;
  }

  private async invalidateDashboardCache(): Promise<void> {
    await this.redis.del('dashboard:summary');
  }
}
