import * as Sentry from '@sentry/node';

let initialized = false;

export function initSentry(service: string): void {
  const dsn = process.env['SENTRY_DSN'];
  if (!dsn) {
    return;
  }

  Sentry.init({
    dsn,
    environment: process.env['NODE_ENV'] ?? 'production',
    tracesSampleRate: 0.1,
    initialScope: {
      tags: { service },
    },
  });

  initialized = true;
}

export function captureException(error: unknown): void {
  if (!initialized) return;
  Sentry.captureException(error);
}