//  MUST be the very first import — OTel auto-instrumentation
import './tracing';

import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { initSentry } from './lib/sentry';

initSentry('relayon-api');

async function bootstrap(): Promise<void> {
  //  rawBody: true — required for Stripe webhook signature verification
  // (Stripe sends raw bytes; re-serializing breaks HMAC validation)
  const app = await NestFactory.create(AppModule, { rawBody: true });

  app.enableCors({
    origin: (process.env['CORS_ORIGIN'] ?? 'http://localhost:4200').split(','),
    credentials: true,
  });

  app.setGlobalPrefix('api');

  // ═══════════════════════════════════════════════════════════════
  // OpenAPI 3.1 — auto-generated spec + Swagger UI
  // Set DISABLE_OPENAPI=true to skip in production
  // ═══════════════════════════════════════════════════════════════
  if (process.env['DISABLE_OPENAPI'] !== 'true') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Relayon API')
      .setDescription(
        'Serverless-native webhook relay platform. Receive, enrich with AI, transform, and route events to any destination.',
      )
      .setVersion('3.0.0')
      .setContact('Relayon', 'https://relayon.vercel.app', 'hello@relayon.dev')
      .setLicense('MIT', 'https://opensource.org/licenses/MIT')
      .addBearerAuth(
        { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        'bearer',
      )
      .addApiKey(
        { type: 'apiKey', name: 'X-API-Key', in: 'header' },
        'api-key',
      )
      .addServer('https://relayon-api.vercel.app', 'Production')
      .addServer('http://localhost:3001', 'Local')
      .addTag('workflows', 'Manage webhook workflows')
      .addTag('destinations', 'Configure delivery targets')
      .addTag('events', 'Event history and replay')
      .addTag('dlq', 'Dead-letter queue management')
      .addTag('analytics', 'Usage and delivery analytics')
      .addTag('community', 'Community posts and templates')
      .addTag('auth', 'Authentication and sessions')
      .addTag('quota', 'Usage quotas')
      .build();

    const swaggerDoc = SwaggerModule.createDocument(app, swaggerConfig, {
      operationIdFactory: (controllerKey: string, methodKey: string) =>
        `${controllerKey.replace(/Controller$/, '')}_${methodKey}`,
    });

    SwaggerModule.setup('api/docs', app, swaggerDoc, {
      jsonDocumentUrl: 'api/openapi.json',
      swaggerOptions: {
        persistAuthorization: true,
        displayRequestDuration: true,
        docExpansion: 'none',
        filter: true,
      },
      customSiteTitle: 'Relayon API Reference',
    });

    Logger.log(
      '📖 Swagger UI → /api/docs  ·  Spec → /api/openapi.json',
      'Bootstrap',
    );
  }

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter());

  const port = Number(
    process.env['PORT'] ?? process.env['API_PORT'] ?? 3001,
  );
  await app.listen(port);

  Logger.log(`🚀 Relayon API → http://localhost:${port}/api`, 'Bootstrap');
}

bootstrap();