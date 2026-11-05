import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class OrderNumberGenerator {
  constructor(private readonly prisma: PrismaService) {}

  async generate(date: Date = new Date()): Promise<string> {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const prefix = `INV-${y}${m}${d}-`;

    // Count orders with same date prefix to get sequential number
    const count = await this.prisma.order.count({
      where: {
        orderNumber: { startsWith: prefix },
      },
    });

    return `${prefix}${String(count + 1).padStart(4, '0')}`;
  }
}
