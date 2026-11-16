import express, { type Express } from 'express';
import { webhookRouter } from './routes/webhook';
import { healthRouter } from './routes/health';
import { playRouter } from './routes/play';
import { tunnelRouter } from './routes/tunnel';
import { errorHandler } from './middleware/errorHandler';
import { config } from './config';
import { logger } from './lib/logger';

export function createApp(): Express {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1);

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

  app.use(
    express.json({
      limit: '5mb',
      verify: (req: any, _res, buf: Buffer) => {
        req.rawBody = buf;
      },
    }),
  );

  app.use((req, _res, next) => {
    logger.info('request.in', {
      correlationId: (req as any).correlationId,
      method: req.method,
      path: req.path,
    });
    next();
  });

  app.use('/health', healthRouter);
  // ⚠️ v3.0 Wave 4 — playground capture (any method, any path after /play)
  app.use('/play', playRouter);
  // ⚠️ v3.1 — CLI tunnel capture (any method, any path after /t)
  app.use('/t', tunnelRouter);
  app.use('/webhook', webhookRouter);

  app.use((_req, res) => {
    res.status(404).json({
      error: 'not_found',
      message: 'Endpoint not found',
    });
  });

  app.use(errorHandler);

  return app;
}