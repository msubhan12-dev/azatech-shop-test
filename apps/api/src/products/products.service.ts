import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { StockMovementType } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { RedisService } from '../common/redis/redis.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { StockAdjustmentDto } from './dto/stock-adjustment.dto';
import { QueryProductsDto } from './dto/query-products.dto';
import { paginate } from '../common/dto/pagination.dto';
import { AuthUser } from '../auth/interfaces/auth-user.interface';

const CACHE_TTL = 300; // 5 minutes

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async findAll(query: QueryProductsDto) {
    const { page = 1, perPage = 10, search, sortBy = 'createdAt', sortOrder = 'desc', withDeleted } = query;
    const skip = (page - 1) * perPage;

    const where: Record<string, unknown> = {
      deletedAt: withDeleted ? undefined : null,
    };

    if (search) {
      where['OR'] = [
        { productName: { contains: search, mode: 'insensitive' } },
        { productCode: { contains: search, mode: 'insensitive' } },
      ];
    }

    const validSortFields = ['productCode', 'productName', 'price', 'stock', 'createdAt'];
    const orderField = validSortFields.includes(sortBy) ? sortBy : 'createdAt';

    const [items, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip,
        take: perPage,
        orderBy: { [orderField]: sortOrder },
      }),
      this.prisma.product.count({ where }),
    ]);

    return paginate(items.map(this.toResponse), total, page, perPage);
  }

  async findOne(id: bigint): Promise<ReturnType<typeof this.toResponse>> {
    const product = await this.prisma.product.findFirst({
      where: { id, deletedAt: null },
    });

    if (!product) {
      throw new NotFoundException(`Produk dengan ID ${id} tidak ditemukan`);
    }

    return this.toResponse(product);
  }

  async create(dto: CreateProductDto, user: AuthUser) {
    const existing = await this.prisma.product.findFirst({
      where: { productCode: dto.productCode, deletedAt: null },
    });

    if (existing) {
      throw new ConflictException(`Kode produk ${dto.productCode} sudah digunakan`);
    }

    const product = await this.prisma.$transaction(async (tx) => {
      const created = await tx.product.create({
        data: {
          productCode: dto.productCode,
          productName: dto.productName,
          stock: dto.stock,
          price: dto.price,
          lowStockThreshold: dto.lowStockThreshold ?? 5,
        },
      });

      if (dto.stock > 0) {
        await tx.stockMovement.create({
          data: {
            productId: created.id,
            type: StockMovementType.INITIAL,
            quantityChange: dto.stock,
            stockAfter: dto.stock,
            note: 'Initial stock saat produk dibuat',
            createdBy: user.id,
          },
        });
      }

      return created;
    });

    await this.invalidateCache();
    return this.toResponse(product);
  }

  async update(id: bigint, dto: UpdateProductDto, user: AuthUser) {
    await this.findOne(id);

    if (dto.productCode) {
      const existing = await this.prisma.product.findFirst({
        where: { productCode: dto.productCode, deletedAt: null, NOT: { id } },
      });
      if (existing) {
        throw new ConflictException(`Kode produk ${dto.productCode} sudah digunakan`);
      }
    }

    const updated = await this.prisma.product.update({
      where: { id },
      data: {
        ...(dto.productCode && { productCode: dto.productCode }),
        ...(dto.productName && { productName: dto.productName }),
        ...(dto.price !== undefined && { price: dto.price }),
        ...(dto.lowStockThreshold !== undefined && { lowStockThreshold: dto.lowStockThreshold }),
      },
    });

    await this.invalidateCache();
    return this.toResponse(updated);
  }

  async remove(id: bigint): Promise<void> {
    await this.findOne(id);

    await this.prisma.product.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await this.invalidateCache();
  }

  async adjustStock(id: bigint, dto: StockAdjustmentDto, user: AuthUser) {
    const product = await this.prisma.product.findFirst({
      where: { id, deletedAt: null },
    });

    if (!product) {
      throw new NotFoundException(`Produk dengan ID ${id} tidak ditemukan`);
    }

    const newStock = product.stock + dto.quantityChange;
    if (newStock < 0) {
      throw new BadRequestException(
        `Stok tidak mencukupi. Stok saat ini: ${product.stock}, perubahan: ${dto.quantityChange}`,
      );
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.product.update({
        where: { id },
        data: { stock: newStock },
      });

      await tx.stockMovement.create({
        data: {
          productId: id,
          type: StockMovementType.ADJUSTMENT,
          quantityChange: dto.quantityChange,
          stockAfter: newStock,
          note: dto.note,
          createdBy: user.id,
        },
      });

      return updated;
    });

    await this.invalidateCache();
    return this.toResponse(result);
  }

  async getStockMovements(id: bigint, page = 1, perPage = 20) {
    await this.findOne(id);

    const skip = (page - 1) * perPage;
    const [items, total] = await Promise.all([
      this.prisma.stockMovement.findMany({
        where: { productId: id },
        skip,
        take: perPage,
        orderBy: { createdAt: 'desc' },
        include: {
          creator: { select: { id: true, name: true, email: true } },
        },
      }),
      this.prisma.stockMovement.count({ where: { productId: id } }),
    ]);

    return paginate(
      items.map((m) => ({
        ...m,
        id: m.id.toString(),
        productId: m.productId.toString(),
        createdBy: m.createdBy?.toString() ?? null,
        creator: m.creator
          ? { ...m.creator, id: m.creator.id.toString() }
          : null,
      })),
      total,
      page,
      perPage,
    );
  }

  private toResponse(product: {
    id: bigint;
    productCode: string;
    productName: string;
    stock: number;
    price: unknown;
    lowStockThreshold: number;
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date | null;
  }) {
    return {
      ...product,
      id: product.id.toString(),
      price: Number(product.price),
    };
  }

  private async invalidateCache(): Promise<void> {
    await this.redis.delPattern('products:*');
    await this.redis.del('dashboard:summary');
  }
}
