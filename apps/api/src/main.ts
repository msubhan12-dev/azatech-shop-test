import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { WinstonModule } from 'nest-winston';
import helmet from 'helmet';
import compression from 'compression';
import { AppModule } from './app.module';
import { createWinstonLogger } from './config/logger.config';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { RequestIdInterceptor } from './common/interceptors/request-id.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: WinstonModule.createLogger(createWinstonLogger()),
  });

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 3001);
  const isProduction = configService.get<string>('NODE_ENV') === 'production';

  // Security
  app.use(helmet());
  app.use(compression());

  // CORS - explicit origins only
  const allowedOrigins = configService.get<string>('CORS_ORIGINS', 'http://localhost:3000').split(',');
  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id', 'Idempotency-Key'],
    exposedHeaders: ['X-Request-Id'],
  });

  // Global prefix & versioning
  app.setGlobalPrefix('api');

  // Global pipes
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Global filters & interceptors
  app.useGlobalFilters(new HttpExceptionFilter(isProduction));
  app.useGlobalInterceptors(
    new RequestIdInterceptor(),
    new TransformInterceptor(),
  );

  // Swagger docs (non-production or controlled)
  if (!isProduction || configService.get<string>('SWAGGER_ENABLED') === 'true') {
    const config = new DocumentBuilder()
      .setTitle('Azatech Shop API')
      .setDescription('Production-grade Online Shop Order Management API')
      .setVersion('1.0')
      .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' })
      .addTag('Auth', 'Authentication endpoints')
      .addTag('Products', 'Product management')
      .addTag('Customers', 'Customer management')
      .addTag('Orders', 'Order management')
      .addTag('Reports', 'Sales reports (admin only)')
      .addTag('Dashboard', 'Dashboard summary')
      .addTag('Health', 'Health check')
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: { persistAuthorization: true },
    });
  }

  await app.listen(port);
  console.log(`🚀 API running on http://localhost:${port}/api`);
  console.log(`📚 Swagger: http://localhost:${port}/api/docs`);
}

bootstrap();
