import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSalesReport(from: string, to: string, groupBy: 'day' | 'month') {
    if (!from || !to) {
      throw new BadRequestException('Parameter from dan to wajib diisi');
    }

    const fromDate = new Date(from);
    const toDate = new Date(to);
    toDate.setHours(23, 59, 59, 999);

    if (fromDate > toDate) {
      throw new BadRequestException('Tanggal from tidak boleh lebih dari to');
    }

    /**
     * Aggregate at DB level — no N+1 queries
     * Only count PAID, SHIPPED, COMPLETED orders
     */
    const truncFormat = groupBy === 'day' ? 'day' : 'month';

    const results = await this.prisma.$queryRaw<
      Array<{ period: Date; total_orders: bigint; total_revenue: string }>
    >`
      SELECT
        DATE_TRUNC(${truncFormat}, order_date) AS period,
        COUNT(*) AS total_orders,
        SUM(total_amount) AS total_revenue
      FROM orders
      WHERE order_date >= ${fromDate}
        AND order_date <= ${toDate}
        AND status IN ('PAID', 'SHIPPED', 'COMPLETED')
      GROUP BY DATE_TRUNC(${truncFormat}, order_date)
      ORDER BY period ASC
    `;

    return results.map((r) => ({
      period: r.period,
      totalOrders: Number(r.total_orders),
      totalRevenue: Number(r.total_revenue),
    }));
  }

  async getTopProducts(from: string, to: string, limit: number) {
    if (!from || !to) {
      throw new BadRequestException('Parameter from dan to wajib diisi');
    }

    const fromDate = new Date(from);
    const toDate = new Date(to);
    toDate.setHours(23, 59, 59, 999);

    const results = await this.prisma.$queryRaw<
      Array<{
        product_id: bigint;
        product_code: string;
        product_name: string;
        total_quantity: bigint;
        total_revenue: string;
      }>
    >`
      SELECT
        p.id AS product_id,
        p.product_code,
        p.product_name,
        SUM(oi.quantity) AS total_quantity,
        SUM(oi.subtotal) AS total_revenue
      FROM order_items oi
      JOIN products p ON p.id = oi.product_id
      JOIN orders o ON o.id = oi.order_id
      WHERE o.order_date >= ${fromDate}
        AND o.order_date <= ${toDate}
        AND o.status IN ('PAID', 'SHIPPED', 'COMPLETED')
      GROUP BY p.id, p.product_code, p.product_name
      ORDER BY total_quantity DESC
      LIMIT ${limit}
    `;

    return results.map((r) => ({
      productId: r.product_id.toString(),
      productCode: r.product_code,
      productName: r.product_name,
      totalQuantity: Number(r.total_quantity),
      totalRevenue: Number(r.total_revenue),
    }));
  }
}
