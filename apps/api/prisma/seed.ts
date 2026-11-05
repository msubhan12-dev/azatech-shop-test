import { PrismaClient, OrderStatus, StockMovementType, Gender } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

function randomDate(daysBack: number): Date {
  const now = new Date();
  const past = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);
  return new Date(past.getTime() + Math.random() * (now.getTime() - past.getTime()));
}

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateOrderNumber(date: Date, seq: number): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `INV-${y}${m}${d}-${String(seq).padStart(4, '0')}`;
}

async function main() {
  console.log('🌱 Starting seed...');

  // Clean existing data
  await prisma.stockMovement.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.product.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.user.deleteMany();
  await prisma.idempotencyKey.deleteMany();

  // Create users
  const hashedPassword = await bcrypt.hash('Password123!', 10);

  const admin = await prisma.user.create({
    data: {
      name: 'Admin Azatech',
      email: 'admin@azatech.id',
      password: hashedPassword,
      role: 'admin',
    },
  });

  const cashier = await prisma.user.create({
    data: {
      name: 'Kasir Azatech',
      email: 'cashier@azatech.id',
      password: hashedPassword,
      role: 'cashier',
    },
  });

  console.log('✅ Users created');

  // Create 50 products
  const productData = [
    { code: 'P0001', name: 'Hydrococo 150ml', price: 5000 },
    { code: 'P0002', name: 'Teh Botol Sosro 350ml', price: 5500 },
    { code: 'P0003', name: 'Aqua 600ml', price: 3500 },
    { code: 'P0004', name: 'Indomie Goreng', price: 3500 },
    { code: 'P0005', name: 'Indomie Kuah', price: 3000 },
    { code: 'P0006', name: 'Mie Sedaap', price: 3200 },
    { code: 'P0007', name: 'Roti Tawar Sari Roti', price: 18000 },
    { code: 'P0008', name: 'Susu Ultra 250ml', price: 5000 },
    { code: 'P0009', name: 'Yakult 5 botol', price: 12000 },
    { code: 'P0010', name: 'Beng-Beng Wafer', price: 3500 },
    { code: 'P0011', name: 'Chitato BBQ 68g', price: 15000 },
    { code: 'P0012', name: 'Pringles Original 110g', price: 28000 },
    { code: 'P0013', name: 'Oreo Original', price: 8500 },
    { code: 'P0014', name: 'Roma Marie', price: 9000 },
    { code: 'P0015', name: 'Pocari Sweat 500ml', price: 8000 },
    { code: 'P0016', name: 'Mizone Lemon 500ml', price: 6000 },
    { code: 'P0017', name: 'Kopiko 78 Derajat', price: 4500 },
    { code: 'P0018', name: 'Kopi Nescafe Sachet', price: 3000 },
    { code: 'P0019', name: 'Milo Sachet 18g', price: 3500 },
    { code: 'P0020', name: 'Ovomaltine Kaleng', price: 45000 },
    { code: 'P0021', name: 'Sabun Lifebuoy Bar', price: 7000 },
    { code: 'P0022', name: 'Shampoo Pantene 170ml', price: 22000 },
    { code: 'P0023', name: 'Pasta Gigi Pepsodent 190g', price: 18000 },
    { code: 'P0024', name: 'Sikat Gigi Oral B', price: 15000 },
    { code: 'P0025', name: 'Detergen Rinso 800g', price: 28000 },
    { code: 'P0026', name: 'Softener Downy 900ml', price: 35000 },
    { code: 'P0027', name: 'Minyak Goreng Bimoli 2L', price: 38000 },
    { code: 'P0028', name: 'Gula Pasir 1kg', price: 16000 },
    { code: 'P0029', name: 'Tepung Terigu Segitiga 1kg', price: 13000 },
    { code: 'P0030', name: 'Beras Premium 5kg', price: 75000 },
    { code: 'P0031', name: 'Telur Ayam 1 kg', price: 30000 },
    { code: 'P0032', name: 'Sarden ABC 155g', price: 14000 },
    { code: 'P0033', name: 'Kecap Bango 600ml', price: 25000 },
    { code: 'P0034', name: 'Saos Sambal ABC 330ml', price: 14000 },
    { code: 'P0035', name: 'Mayonaise Kraft 220ml', price: 22000 },
    { code: 'P0036', name: 'Keju Prochiz 170g', price: 32000 },
    { code: 'P0037', name: 'Mentega Wijsman 200g', price: 28000 },
    { code: 'P0038', name: 'Susu Kental Manis Frisian Flag', price: 12000 },
    { code: 'P0039', name: 'Tisu Paseo 250 sheet', price: 15000 },
    { code: 'P0040', name: 'Pembersih Lantai Wipol', price: 18000 },
    { code: 'P0041', name: 'Baygon Spray 600ml', price: 42000 },
    { code: 'P0042', name: 'Isi Ulang LPG 3kg', price: 28000 },
    { code: 'P0043', name: 'Baterai ABC AA (2pcs)', price: 8500 },
    { code: 'P0044', name: 'Kantong Plastik Kecil (100pcs)', price: 12000 },
    { code: 'P0045', name: 'Rokok Sampoerna A Mild (12)', price: 32000 },
    { code: 'P0046', name: 'Rokok Gudang Garam (12)', price: 28000 },
    { code: 'P0047', name: 'Permen Kopiko', price: 2000 },
    { code: 'P0048', name: 'Permen Mentos Roll', price: 5000 },
    { code: 'P0049', name: 'Coklat SilverQueen 33g', price: 15000 },
    { code: 'P0050', name: 'Biskuit Khong Guan Kaleng', price: 85000 },
  ];

  const products: { id: bigint; price: number; stock: number }[] = [];
  for (const p of productData) {
    const stock = Math.floor(Math.random() * 100) + 20;
    const product = await prisma.product.create({
      data: {
        productCode: p.code,
        productName: p.name,
        stock,
        price: p.price,
        lowStockThreshold: 5,
      },
    });
    // Record initial stock
    await prisma.stockMovement.create({
      data: {
        productId: product.id,
        type: StockMovementType.INITIAL,
        quantityChange: stock,
        stockAfter: stock,
        note: 'Initial stock from seeder',
        createdBy: admin.id,
      },
    });
    products.push({ id: product.id, price: p.price, stock });
  }
  console.log('✅ Products created');

  // Create 30 customers
  const genders: Gender[] = ['Pria', 'Wanita'];
  const customerNames = [
    'Budi Santoso', 'Siti Aminah', 'Joko Widodo', 'Dewi Rahayu', 'Ahmad Fauzi',
    'Rina Marlina', 'Hendra Gunawan', 'Maya Sari', 'Riko Prasetyo', 'Linda Wati',
    'Bambang Suprianto', 'Fitri Handayani', 'Dedi Kurniawan', 'Yuni Astuti', 'Agus Salim',
    'Novi Andriani', 'Wahyu Hidayat', 'Sri Mulyani', 'Eko Prasetyo', 'Anita Safitri',
    'Fajar Nugraha', 'Retno Wulandari', 'Irfan Hakim', 'Dina Permata', 'Rizky Ramadhan',
    'Citra Kencana', 'Bagas Wibowo', 'Indah Pertiwi', 'Toni Firmansyah', 'Lestari Ningrum',
  ];

  const customers: string[] = [];
  for (let i = 0; i < 30; i++) {
    const gender = randomItem(genders);
    const customer = await prisma.customer.create({
      data: {
        customerName: customerNames[i],
        customerAddress: `Jl. ${customerNames[i].split(' ')[0]} No.${i + 1}, Jakarta`,
        gender,
        birthDate: new Date(1970 + Math.floor(Math.random() * 35), Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1),
        phone: `08${Math.floor(Math.random() * 9000000000) + 1000000000}`,
        email: `${customerNames[i].toLowerCase().replace(' ', '.')}@email.com`,
      },
    });
    customers.push(customer.id);
  }
  console.log('✅ Customers created');

  // Create 150 orders spread across 90 days
  const statuses: OrderStatus[] = ['PENDING', 'PAID', 'SHIPPED', 'COMPLETED', 'CANCELLED'];
  const statusWeights = [0.1, 0.1, 0.1, 0.6, 0.1]; // 60% completed for reports

  let orderSeq = 1;
  const productStockMap = new Map(products.map(p => [p.id.toString(), p.stock]));

  for (let i = 0; i < 150; i++) {
    const orderDate = randomDate(90);
    const orderNumber = generateOrderNumber(orderDate, orderSeq++);
    const customerId = randomItem(customers);
    const createdBy = Math.random() > 0.5 ? admin.id : cashier.id;

    // Pick status based on weights
    const rand = Math.random();
    let cumulative = 0;
    let status: OrderStatus = 'COMPLETED';
    for (let s = 0; s < statuses.length; s++) {
      cumulative += statusWeights[s];
      if (rand < cumulative) {
        status = statuses[s];
        break;
      }
    }

    // Pick 1-5 random products
    const numItems = Math.floor(Math.random() * 4) + 1;
    const shuffled = [...products].sort(() => Math.random() - 0.5).slice(0, numItems);

    const items = shuffled.map(p => ({
      productId: p.id,
      quantity: Math.floor(Math.random() * 3) + 1,
      unitPrice: p.price,
      subtotal: 0,
    }));

    // Calculate totals
    let totalAmount = 0;
    for (const item of items) {
      item.subtotal = item.quantity * item.unitPrice;
      totalAmount += item.subtotal;
    }

    // Build order timestamps
    const paidAt = status !== 'PENDING' && status !== 'CANCELLED' ? new Date(orderDate.getTime() + 3600000) : null;
    const shippedAt = (status === 'SHIPPED' || status === 'COMPLETED') ? new Date(orderDate.getTime() + 7200000) : null;
    const completedAt = status === 'COMPLETED' ? new Date(orderDate.getTime() + 86400000) : null;
    const cancelledAt = status === 'CANCELLED' ? new Date(orderDate.getTime() + 1800000) : null;
    const cancelReason = status === 'CANCELLED' ? 'Customer membatalkan pesanan' : null;

    await prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          orderNumber,
          customerId,
          createdBy,
          status,
          totalAmount,
          orderDate,
          paidAt,
          shippedAt,
          completedAt,
          cancelledAt,
          cancelReason,
          items: {
            create: items.map(item => ({
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              subtotal: item.subtotal,
            })),
          },
        },
      });

      // Update stock for non-cancelled orders
      if (status !== 'CANCELLED') {
        for (const item of items) {
          const currentStock = productStockMap.get(item.productId.toString()) ?? 0;
          const newStock = Math.max(0, currentStock - item.quantity);
          productStockMap.set(item.productId.toString(), newStock);

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
              createdBy,
            },
          });
        }
      }
    });
  }

  console.log('✅ Orders created (150)');
  console.log('🎉 Seed completed!');
  console.log('');
  console.log('Credentials:');
  console.log('  Admin:   admin@azatech.id / Password123!');
  console.log('  Cashier: cashier@azatech.id / Password123!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
