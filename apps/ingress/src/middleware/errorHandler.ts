import type { ErrorRequestHandler } from 'express';
import { ApiError } from '../lib/errors';
import { logger } from '../lib/logger';
import { captureException } from '../lib/sentry';

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof ApiError) {
    if (err.statusCode >= 500) {
      captureException(err);
      logger.error('request.error', {
        correlationId: req.correlationId,
        code: err.code,
        message: err.message,
      });
    }
    res.status(err.statusCode).json({
      error: err.code,
      message: err.message,
      ...(err.details ? { details: err.details } : {}),
      correlationId: req.correlationId,
    });
    return;
  }

  if (typeof err === 'object' && err !== null && 'type' in err) {
    const typed = err as { type: string; status?: number; message?: string };
    if (typed.type === 'entity.too.large') {
      res.status(413).json({
        error: 'payload_too_large',
        message: 'Payload exceeds 5 MB limit',
        correlationId: req.correlationId,
      });
      return;
    }
    if (typed.type === 'entity.parse.failed') {
      res.status(400).json({
        error: 'invalid_json',
        message: 'Body is not valid JSON',
        correlationId: req.correlationId,
      });
      return;
    }
  }

  captureException(err);
  logger.error('request.unhandled', {
    correlationId: req.correlationId,
    message: err?.message ?? String(err),
    stack: err?.stack,
  });

  res.status(500).json({
    error: 'internal_error',
    message: 'Internal server error',
    correlationId: req.correlationId,
  });
};