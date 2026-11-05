import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { RedisService } from '../common/redis/redis.service';

const CACHE_KEY = 'dashboard:summary';
const CACHE_TTL = 300; // 5 minutes

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async getSummary() {
    // Try cache first
    const cached = await this.redis.getJson<unknown>(CACHE_KEY);
    if (cached) {
      this.logger.debug('Dashboard summary served from cache');
      return cached;
    }

    const [
      totalOrders,
      pendingOrders,
      paidOrders,
      shippedOrders,
      completedOrders,
      cancelledOrders,
      totalRevenue,
      totalProducts,
      lowStockCount,
      totalCustomers,
      recentOrders,
    ] = await Promise.all([
      this.prisma.order.count(),
      this.prisma.order.count({ where: { status: 'PENDING' } }),
      this.prisma.order.count({ where: { status: 'PAID' } }),
      this.prisma.order.count({ where: { status: 'SHIPPED' } }),
      this.prisma.order.count({ where: { status: 'COMPLETED' } }),
      this.prisma.order.count({ where: { status: 'CANCELLED' } }),
      this.prisma.order.aggregate({
        where: { status: { in: ['PAID', 'SHIPPED', 'COMPLETED'] } },
        _sum: { totalAmount: true },
      }),
      this.prisma.product.count({ where: { deletedAt: null } }),
      this.prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*) FROM products 
        WHERE deleted_at IS NULL 
          AND stock <= low_stock_threshold
      `,
      this.prisma.customer.count({ where: { deletedAt: null } }),
      this.prisma.order.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          customer: { select: { customerName: true } },
        },
      }),
    ]);

    const summary = {
      orders: {
        total: totalOrders,
        pending: pendingOrders,
        paid: paidOrders,
        shipped: shippedOrders,
        completed: completedOrders,
        cancelled: cancelledOrders,
      },
      revenue: {
        total: Number(totalRevenue._sum.totalAmount ?? 0),
      },
      products: {
        total: totalProducts,
        lowStock: Number(lowStockCount[0]?.count ?? 0),
      },
      customers: {
        total: totalCustomers,
      },
      recentOrders: recentOrders.map((o) => ({
        id: o.id.toString(),
        orderNumber: o.orderNumber,
        status: o.status,
        totalAmount: Number(o.totalAmount),
        customerName: o.customer.customerName,
        orderDate: o.orderDate,
      })),
    };

    await this.redis.setJson(CACHE_KEY, summary, CACHE_TTL);
    return summary;
  }
}
