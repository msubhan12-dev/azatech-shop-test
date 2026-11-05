import {
  Injectable,
  ConflictException,
  UnprocessableEntityException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

const IDEMPOTENCY_TTL_HOURS = 24;

@Injectable()
export class IdempotencyService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Check if an idempotency key has been seen before.
   * - Returns stored response if key exists and is 'completed'
   * - Returns null if key is new (should process)
   * - Throws 409 if key is 'processing' (request in flight)
   * - Throws 422 if key exists with different payload
   */
  async check(
    key: string,
    payload: unknown,
  ): Promise<{ alreadyProcessed: true; response: unknown } | { alreadyProcessed: false }> {
    const existing = await this.prisma.idempotencyKey.findUnique({
      where: { key },
    });

    if (!existing) {
      return { alreadyProcessed: false };
    }

    // Check if expired
    if (existing.expiresAt < new Date()) {
      // Expired — treat as new
      await this.prisma.idempotencyKey.delete({ where: { key } });
      return { alreadyProcessed: false };
    }

    // Check payload match
    const storedPayload = JSON.stringify(existing.payload);
    const newPayload = JSON.stringify(payload);

    if (storedPayload !== newPayload) {
      throw new UnprocessableEntityException(
        `Idempotency key ${key} sudah digunakan dengan payload yang berbeda`,
      );
    }

    // If still processing, return 409
    if (existing.status === 'processing') {
      throw new ConflictException(
        `Request dengan Idempotency-Key ${key} sedang diproses`,
      );
    }

    // Completed — return cached response
    return { alreadyProcessed: true, response: existing.response };
  }

  /**
   * Mark a key as 'processing' to prevent concurrent duplicate requests
   */
  async start(key: string, payload: unknown): Promise<void> {
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + IDEMPOTENCY_TTL_HOURS);

    await this.prisma.idempotencyKey.upsert({
      where: { key },
      create: {
        key,
        payload: payload as object,
        status: 'processing',
        expiresAt,
      },
      update: {
        status: 'processing',
        payload: payload as object,
        expiresAt,
      },
    });
  }

  /**
   * Mark a key as 'completed' and store the response
   */
  async complete(key: string, response: unknown): Promise<void> {
    await this.prisma.idempotencyKey.update({
      where: { key },
      data: {
        status: 'completed',
        response: response as object,
      },
    });
  }

  /**
   * Mark a key as 'failed' (for cleanup purposes)
   */
  async fail(key: string): Promise<void> {
    await this.prisma.idempotencyKey.update({
      where: { key },
      data: { status: 'failed' },
    });
  }
}
