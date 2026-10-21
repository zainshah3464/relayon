import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { initSentry } from './lib/sentry';

initSentry('relayon-workers');

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  app.setGlobalPrefix('internal');
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());

  app.enableShutdownHooks();

  const port = Number(
    process.env['PORT'] ?? process.env['WORKERS_PORT'] ?? 3003,
  );
  await app.listen(port);

  Logger.log(
    `🚀 Relayon Workers → http://localhost:${port}/internal`,
    'Bootstrap',
  );
}

bootstrap();