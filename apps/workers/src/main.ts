import { NestFactory, INestApplication } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { initSentry } from './lib/sentry';

initSentry('relayon-workers');

let cachedServer: any = null;

async function createApp(): Promise<INestApplication> {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  app.setGlobalPrefix('internal');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new HttpExceptionFilter());
  app.enableShutdownHooks();
  await app.init();
  return app;
}

/**
 * Vercel serverless handler.
 * Vercel requires a default export that acts as the HTTP handler.
 * We cache the underlying Express instance so cold starts are fast.
 */
export default async function handler(req: any, res: any) {
  if (!cachedServer) {
    const app = await createApp();
    cachedServer = app.getHttpAdapter().getInstance();
    Logger.log('🚀 Relayon Workers running in serverless mode', 'Bootstrap');
  }
  return cachedServer(req, res);
}

/**
 * Local dev bootstrap — only runs outside Vercel.
 */
if (!process.env['VERCEL']) {
  (async () => {
    const app = await createApp();
    const port = Number(process.env['PORT'] ?? process.env['WORKERS_PORT'] ?? 3003);
    await app.listen(port);
    Logger.log(`🚀 Relayon Workers → http://localhost:${port}/internal`, 'Bootstrap');
  })().catch((err) => {
    Logger.error(`Bootstrap failed: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  });
}