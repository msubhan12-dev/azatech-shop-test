/**
 * E2E Integration Tests
 * Tests run against real PostgreSQL and Redis (via Docker).
 * Uses DATABASE_TEST_URL environment variable.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { RequestIdInterceptor } from '../src/common/interceptors/request-id.interceptor';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';

let app: INestApplication;
let prisma: PrismaService;

// Store test tokens
let adminToken: string;
let cashierToken: string;

async function setupTestDb() {
  // Clean and seed test data
  await prisma.stockMovement.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.idempotencyKey.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.product.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.user.deleteMany();

  const password = await bcrypt.hash('Password123!', 10);

  await prisma.user.createMany({
    data: [
      { name: 'Admin Test', email: 'admin@test.com', password, role: 'admin' },
      { name: 'Cashier Test', email: 'cashier@test.com', password, role: 'cashier' },
    ],
  });

  // Create test products
  const product1 = await prisma.product.create({
    data: {
      productCode: 'TEST001',
      productName: 'Test Product 1',
      stock: 100,
      price: 10000,
      lowStockThreshold: 5,
    },
  });

  const product2 = await prisma.product.create({
    data: {
      productCode: 'TEST002',
      productName: 'Test Product 2',
      stock: 5,
      price: 20000,
      lowStockThreshold: 5,
    },
  });

  const customer = await prisma.customer.create({
    data: {
      customerName: 'Test Customer',
      customerAddress: 'Test Address',
      gender: 'Pria',
    },
  });

  return { product1, product2, customer };
}

beforeAll(async () => {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  app = moduleFixture.createNestApplication();

  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter(false));
  app.useGlobalInterceptors(new RequestIdInterceptor(), new TransformInterceptor());

  await app.init();

  prisma = moduleFixture.get<PrismaService>(PrismaService);
});

afterAll(async () => {
  await prisma.$disconnect();
  await app.close();
});

// === AUTH TESTS ===
describe('POST /api/auth/login', () => {
  beforeEach(async () => {
    await setupTestDb();
  });

  it('should login as admin', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'admin@test.com', password: 'Password123!' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('accessToken');
    expect(res.body.data).toHaveProperty('refreshToken');
    expect(res.body.data.user.role).toBe('admin');

    adminToken = res.body.data.accessToken;
  });

  it('should login as cashier', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'cashier@test.com', password: 'Password123!' });

    expect(res.status).toBe(200);
    cashierToken = res.body.data.accessToken;
  });

  it('should reject wrong password', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'admin@test.com', password: 'WrongPass!' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('should reject non-existent user', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'nobody@test.com', password: 'Password123!' });

    expect(res.status).toBe(401);
  });
});

// === PRODUCTS TESTS ===
describe('Products API', () => {
  beforeEach(async () => {
    await setupTestDb();
    const loginRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'admin@test.com', password: 'Password123!' });
    adminToken = loginRes.body.data.accessToken;

    const cashierRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'cashier@test.com', password: 'Password123!' });
    cashierToken = cashierRes.body.data.accessToken;
  });

  it('GET /api/products should list products', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/products')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeInstanceOf(Array);
    expect(res.body.meta).toHaveProperty('total');
  });

  it('POST /api/products should create product as admin', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        productCode: 'NEW001',
        productName: 'New Product',
        stock: 50,
        price: 15000,
      });

    expect(res.status).toBe(201);
    expect(res.body.data.productCode).toBe('NEW001');
  });

  it('POST /api/products should reject cashier', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/products')
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({
        productCode: 'NEW002',
        productName: 'New Product',
        stock: 50,
        price: 15000,
      });

    expect(res.status).toBe(403);
  });

  it('POST /api/products should reject duplicate code', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        productCode: 'TEST001',
        productName: 'Duplicate',
        stock: 10,
        price: 5000,
      });

    expect(res.status).toBe(409);
  });
});

// === ORDER STATE MACHINE TESTS ===
describe('Order Status Transitions', () => {
  let testData: Awaited<ReturnType<typeof setupTestDb>>;

  beforeEach(async () => {
    testData = await setupTestDb();

    const adminRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'admin@test.com', password: 'Password123!' });
    adminToken = adminRes.body.data.accessToken;

    const cashierRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'cashier@test.com', password: 'Password123!' });
    cashierToken = cashierRes.body.data.accessToken;
  });

  async function createOrder(token: string) {
    return request(app.getHttpServer())
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', uuidv4())
      .send({
        customerId: testData.customer.id,
        items: [{ productId: Number(testData.product1.id), quantity: 1 }],
      });
  }

  it('should create order with PENDING status', async () => {
    const res = await createOrder(adminToken);
    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('PENDING');
  });

  it('should allow cashier to mark PAID', async () => {
    const orderRes = await createOrder(cashierToken);
    const orderId = orderRes.body.data.id;

    const payRes = await request(app.getHttpServer())
      .post(`/api/orders/${orderId}/pay`)
      .set('Authorization', `Bearer ${cashierToken}`);

    expect(payRes.status).toBe(201);
    expect(payRes.body.data.status).toBe('PAID');
    expect(payRes.body.data.paidAt).not.toBeNull();
  });

  it('should reject cashier from marking SHIPPED', async () => {
    const orderRes = await createOrder(adminToken);
    const orderId = orderRes.body.data.id;

    // Pay first
    await request(app.getHttpServer())
      .post(`/api/orders/${orderId}/pay`)
      .set('Authorization', `Bearer ${adminToken}`);

    const shipRes = await request(app.getHttpServer())
      .post(`/api/orders/${orderId}/ship`)
      .set('Authorization', `Bearer ${cashierToken}`);

    expect(shipRes.status).toBe(403);
  });

  it('should reject invalid transition SHIPPED → CANCELLED (409)', async () => {
    const orderRes = await createOrder(adminToken);
    const orderId = orderRes.body.data.id;

    await request(app.getHttpServer())
      .post(`/api/orders/${orderId}/pay`)
      .set('Authorization', `Bearer ${adminToken}`);

    await request(app.getHttpServer())
      .post(`/api/orders/${orderId}/ship`)
      .set('Authorization', `Bearer ${adminToken}`);

    const cancelRes = await request(app.getHttpServer())
      .post(`/api/orders/${orderId}/cancel`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ cancelReason: 'Test cancel' });

    expect(cancelRes.status).toBe(409);
  });

  it('should restore stock when order is cancelled', async () => {
    const initialStock = testData.product1.stock;

    const orderRes = await createOrder(adminToken);
    const orderId = orderRes.body.data.id;

    // Verify stock was deducted
    const productAfterOrder = await prisma.product.findUnique({
      where: { id: testData.product1.id },
    });
    expect(productAfterOrder?.stock).toBe(initialStock - 1);

    // Cancel order
    await request(app.getHttpServer())
      .post(`/api/orders/${orderId}/cancel`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ cancelReason: 'Test cancellation' });

    // Verify stock was restored
    const productAfterCancel = await prisma.product.findUnique({
      where: { id: testData.product1.id },
    });
    expect(productAfterCancel?.stock).toBe(initialStock);
  });
});

// === IDEMPOTENCY TESTS ===
describe('Order Idempotency', () => {
  let testData: Awaited<ReturnType<typeof setupTestDb>>;

  beforeEach(async () => {
    testData = await setupTestDb();

    const adminRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'admin@test.com', password: 'Password123!' });
    adminToken = adminRes.body.data.accessToken;
  });

  it('should return same order for duplicate idempotency key', async () => {
    const key = uuidv4();
    const payload = {
      customerId: testData.customer.id,
      items: [{ productId: Number(testData.product1.id), quantity: 1 }],
    };

    const res1 = await request(app.getHttpServer())
      .post('/api/orders')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('Idempotency-Key', key)
      .send(payload);

    const res2 = await request(app.getHttpServer())
      .post('/api/orders')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('Idempotency-Key', key)
      .send(payload);

    expect(res1.status).toBe(201);
    expect(res2.status).toBe(201);
    expect(res1.body.data.id).toBe(res2.body.data.id);
    expect(res1.body.data.orderNumber).toBe(res2.body.data.orderNumber);

    // Only one order should exist
    const orders = await prisma.order.findMany({
      where: { customerId: testData.customer.id },
    });
    expect(orders).toHaveLength(1);
  });

  it('should reject same key with different payload (422)', async () => {
    const key = uuidv4();

    await request(app.getHttpServer())
      .post('/api/orders')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('Idempotency-Key', key)
      .send({
        customerId: testData.customer.id,
        items: [{ productId: Number(testData.product1.id), quantity: 1 }],
      });

    const res2 = await request(app.getHttpServer())
      .post('/api/orders')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('Idempotency-Key', key)
      .send({
        customerId: testData.customer.id,
        items: [{ productId: Number(testData.product1.id), quantity: 2 }], // different qty
      });

    expect(res2.status).toBe(422);
  });
});

// === CONCURRENCY TEST ===
describe('Stock Concurrency (WAJIB)', () => {
  it('should handle concurrent orders without overselling', async () => {
    // Reset with fresh product with stock=5
    await prisma.stockMovement.deleteMany();
    await prisma.orderItem.deleteMany();
    await prisma.order.deleteMany();
    await prisma.idempotencyKey.deleteMany();

    const product = await prisma.product.upsert({
      where: { productCode: 'CONCURRENT001' },
      create: {
        productCode: 'CONCURRENT001',
        productName: 'Concurrent Test Product',
        stock: 5,
        price: 10000,
        lowStockThreshold: 1,
      },
      update: { stock: 5 },
    });

    const customer = await prisma.customer.create({
      data: {
        customerName: 'Concurrent Customer',
        customerAddress: 'Test Address',
        gender: 'Pria',
      },
    });

    // Login as admin
    const loginRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'admin@test.com', password: 'Password123!' });
    const token = loginRes.body.data.accessToken;

    // Send 20 concurrent requests for stock=5 product
    const requests = Array.from({ length: 20 }, () =>
      request(app.getHttpServer())
        .post('/api/orders')
        .set('Authorization', `Bearer ${token}`)
        .set('Idempotency-Key', uuidv4())
        .send({
          customerId: customer.id,
          items: [{ productId: Number(product.id), quantity: 1 }],
        }),
    );

    const results = await Promise.all(requests);

    const successful = results.filter((r) => r.status === 201);
    const failed = results.filter((r) => r.status !== 201);

    // Exactly 5 should succeed, 15 should fail
    expect(successful.length).toBe(5);
    expect(failed.length).toBe(15);

    // Final stock should be 0
    const finalProduct = await prisma.product.findUnique({
      where: { id: product.id },
    });
    expect(finalProduct?.stock).toBe(0);
  }, 30000); // 30s timeout for this test
});

// === RBAC TESTS ===
describe('RBAC Authorization', () => {
  beforeEach(async () => {
    await setupTestDb();

    const adminRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'admin@test.com', password: 'Password123!' });
    adminToken = adminRes.body.data.accessToken;

    const cashierRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'cashier@test.com', password: 'Password123!' });
    cashierToken = cashierRes.body.data.accessToken;
  });

  it('cashier cannot delete customer', async () => {
    const customers = await request(app.getHttpServer())
      .get('/api/customers')
      .set('Authorization', `Bearer ${cashierToken}`);

    const customerId = customers.body.data[0]?.id;
    if (!customerId) return;

    const res = await request(app.getHttpServer())
      .delete(`/api/customers/${customerId}`)
      .set('Authorization', `Bearer ${cashierToken}`);

    expect(res.status).toBe(403);
  });

  it('cashier cannot access reports', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/reports/sales?from=2026-01-01&to=2026-12-31')
      .set('Authorization', `Bearer ${cashierToken}`);

    expect(res.status).toBe(403);
  });

  it('admin can access reports', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/reports/sales?from=2026-01-01&to=2026-12-31')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
  });

  it('unauthenticated request returns 401', async () => {
    const res = await request(app.getHttpServer()).get('/api/products');
    expect(res.status).toBe(401);
  });
});
