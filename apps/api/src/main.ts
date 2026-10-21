import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { initSentry } from './lib/sentry';

initSentry('relayon-api');

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: (process.env['CORS_ORIGIN'] ?? 'http://localhost:4200').split(','),
    credentials: true,
  });

  app.setGlobalPrefix('api');

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