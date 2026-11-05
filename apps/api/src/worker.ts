/**
 * Background Worker Entry Point
 * Runs BullMQ processors for invoice generation and notifications.
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrapWorker() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['log', 'error', 'warn'],
  });

  console.log('🔧 Background worker started');
  console.log('   - Invoice processor: active');
  console.log('   - Notifications processor: active');

  // Keep the process alive
  await app.init();

  // Handle graceful shutdown
  process.on('SIGTERM', async () => {
    console.log('SIGTERM received, shutting down worker...');
    await app.close();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    console.log('SIGINT received, shutting down worker...');
    await app.close();
    process.exit(0);
  });
}

bootstrapWorker().catch((err) => {
  console.error('Failed to start worker:', err);
  process.exit(1);
});
