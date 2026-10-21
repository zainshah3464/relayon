import { createApp } from './app';
import { config } from './config';
import { logger } from './lib/logger';
import { prisma } from './lib/prisma';
import { redis, closeRedis } from './lib/redis';
import { initSentry } from './lib/sentry';

initSentry('relayon-ingress');

const app = createApp();

// Vercel serverless export — MUST be before bootstrap()
export default app;

async function bootstrap(): Promise<void> {
  await prisma.$queryRaw`SELECT 1`;
  logger.info('db.connected');

  await redis.ping();
  logger.info('redis.ping.ok');

  const port = Number(process.env['PORT'] ?? config.INGRESS_PORT);

  // Vercel serverless sets VERCEL=1 — skip app.listen() there
  if (!process.env['VERCEL']) {
    const server = app.listen(port, () => {
      logger.info('server.listening', {
        port,
        env: config.NODE_ENV,
      });
    });

    const shutdown = async (signal: string): Promise<void> => {
      logger.info('shutdown.received', { signal });

      server.close((err) => {
        if (err) {
          logger.error('shutdown.server_close_error', {
            message: err.message,
          });
        }
      });

      await Promise.allSettled([prisma.$disconnect(), closeRedis()]);
      logger.info('shutdown.complete');
      process.exit(0);
    };

    process.on('SIGTERM', () => void shutdown('SIGTERM'));
    process.on('SIGINT', () => void shutdown('SIGINT'));
  }

  process.on('unhandledRejection', (reason) => {
    logger.error('unhandled_rejection', { reason: String(reason) });
  });
  process.on('uncaughtException', (err) => {
    logger.error('uncaught_exception', {
      message: err.message,
      stack: err.stack,
    });
    process.exit(1);
  });
}

bootstrap().catch((err) => {
  logger.error('bootstrap.failed', {
    message: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
  });
  process.exit(1);
});