import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const compression = require('compression');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const cookieParser = require('cookie-parser');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const express = require('express');
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create(AppModule, {
    // Suppress NestJS startup logs in test env
    logger: process.env.NODE_ENV === 'test' ? false : undefined,
  });

  const config = app.get(ConfigService);
  const port = config.get<number>('app.port') ?? 3000;
  const frontendUrl = config.get<string>('app.frontendUrl') ?? 'http://localhost:5173';
  const nodeEnv = config.get<string>('app.nodeEnv') ?? 'development';

  // ─── Graceful shutdown ────────────────────────────────────────────────────
  // Enables NestJS to call onApplicationShutdown() hooks on SIGTERM/SIGINT
  // Required for Prisma disconnect, BullMQ queue drain, etc.
  app.enableShutdownHooks();

  // ─── Security ─────────────────────────────────────────────────────────────
  app.use(helmet());
  app.use(compression());

  // cookie-parser — needed to read httpOnly refresh token cookie on /auth/refresh
  app.use(cookieParser());

  // Stripe webhook requires the RAW request body for HMAC signature verification.
  // Applied BEFORE the global JSON parser so Stripe's signature check works.
  // Scoped to just the webhook path — everything else gets normal JSON parsing.
  app.use('/api/v1/billing/webhook', express.raw({ type: 'application/json' }));

  // ─── CORS ──────────────────────────────────────────────────────────────────
  // Dynamic origin validation — supports multiple allowed origins from env
  // e.g. FRONTEND_URL=http://localhost:5173,https://app.agencypulse.com
  const allowedOrigins = frontendUrl
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  app.enableCors({
    origin: (origin, callback) => {
      // No-origin requests (Postman, curl, server-to-server, mobile apps) are
      // allowed deliberately — these never send an Origin header and cannot
      // be forged by browser-based attackers. CSRF protection handles the rest.
      // In production, if you want to lock this down, add:
      //   if (!origin) return callback(new Error('CORS: origin required'));
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS: Origin "${origin}" not allowed`));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // ─── Global Prefix ─────────────────────────────────────────────────────────
  app.setGlobalPrefix('api/v1');

  // ─── Global Validation ─────────────────────────────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,           // Strip unknown fields
      forbidNonWhitelisted: true, // Throw if unknown fields sent
      transform: true,           // Auto-convert types (string → number etc.)
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // ─── Global Exception Filter ───────────────────────────────────────────────
  app.useGlobalFilters(new AllExceptionsFilter());

  // ─── Swagger (dev only) ────────────────────────────────────────────────────
  if (nodeEnv !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('AgencyPulse API')
      .setDescription('Multi-tenant marketing analytics platform API')
      .setVersion('1.0')
      .addBearerAuth(
        { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        'access-token',
      )
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: { persistAuthorization: true },
    });

    logger.log(`Swagger docs → http://localhost:${port}/api/docs`);
  }

  await app.listen(port);
  logger.log(`Server running → http://localhost:${port}/api/v1`);
  logger.log(`Environment: ${nodeEnv}`);
}

bootstrap();
