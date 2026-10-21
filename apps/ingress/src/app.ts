import express, { type Express } from 'express';
import { webhookRouter } from './routes/webhook';
import { healthRouter } from './routes/health';
import { errorHandler } from './middleware/errorHandler';
import { config } from './config';
import { logger } from './lib/logger';

export function createApp(): Express {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  // CORS — ingress is public, but admin tools may call from dashboard
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', config.CORS_ORIGIN);
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization, X-Correlation-Id',
    );
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    if (req.method === 'OPTIONS') {
      res.sendStatus(204);
      return;
    }
    next();
  });

  // Body parsing — capture raw bytes for signature verification.
  // 5 MB limit per README spec.
  app.use(
    express.json({
      limit: '5mb',
      verify: (req: any, _res, buf: Buffer) => {
        req.rawBody = buf;
      },
    }),
  );

  // Baseline request logging
  app.use((req, _res, next) => {
    logger.info('request.in', {
      correlationId: (req as any).correlationId,
      method: req.method,
      path: req.path,
    });
    next();
  });

  app.use('/health', healthRouter);
  app.use('/webhook', webhookRouter);

  // 404 fallback
  app.use((_req, res) => {
    res.status(404).json({
      error: 'not_found',
      message: 'Endpoint not found',
    });
  });

  // Global error handler — MUST be last
  app.use(errorHandler);

  return app;
}