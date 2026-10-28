import { Injectable } from '@nestjs/common';
import { DestinationAdapter } from './plugin.decorator';
import type { AdapterResult, DeliveryAdapter, DeliveryContext } from './types';

const TIMEOUT_MS = 10_000;

@Injectable()
@DestinationAdapter({
  type: 'http',
  displayName: 'HTTP Webhook',
  fields: [
    {
      key: 'url',
      label: 'URL',
      type: 'url',
      required: true,
      placeholder: 'https://api.example.com/webhook',
    },
    {
      key: 'method',
      label: 'Method',
      type: 'select',
      required: false,
      defaultValue: 'POST',
      options: [
        { value: 'POST', label: 'POST' },
        { value: 'PUT', label: 'PUT' },
        { value: 'PATCH', label: 'PATCH' },
        { value: 'GET', label: 'GET' },
        { value: 'DELETE', label: 'DELETE' },
      ],
    },
    {
      key: 'headers',
      label: 'Custom headers (JSON)',
      type: 'json',
      required: false,
      placeholder: '{"X-Api-Version":"2026-01"}',
    },
  ],
  testPayload: {
    type: 'checkout.session.completed',
    data: { amount: 5000, currency: 'usd', customer: { email: 'test@example.com' } },
  },
  supportsIdempotency: true,
})
export class HttpAdapter implements DeliveryAdapter {
  readonly type = 'http';

  async send(ctx: DeliveryContext): Promise<AdapterResult> {
    const started = Date.now();
    const url = ctx.config['url'];
    if (typeof url !== 'string' || !url.startsWith('http')) {
      return this.error("missing or invalid 'url' in config", started);
    }

    if (ctx.config['__dryRun'] === true) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
      try {
        const res = await fetch(url, {
          method: 'HEAD',
          headers: { 'X-Relayon-Dry-Run': 'true' },
          signal: controller.signal,
        });
        return {
          success: res.status < 500,
          statusCode: res.status,
          latencyMs: Date.now() - started,
          responseBody: '',
          error: res.status >= 500 ? `Reachable but returned ${res.status}` : null,
          retryable: false,
        };
      } catch (err) {
        return {
          success: false,
          statusCode: 0,
          latencyMs: Date.now() - started,
          responseBody: '',
          error: err instanceof Error ? err.message : String(err),
          retryable: false,
        };
      } finally {
        clearTimeout(timer);
      }
    }

    const method = this.parseMethod(ctx.config['method']);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Relayon-Event-Id': ctx.eventId,
      'X-Relayon-Correlation-Id': ctx.correlationId,
      'X-Relayon-Attempt': String(ctx.attemptNumber),
      'Idempotency-Key': `${ctx.eventId}:${ctx.destinationId}`,
    };

    const cfgHeaders = ctx.config['headers'];
    if (cfgHeaders && typeof cfgHeaders === 'object') {
      for (const [k, v] of Object.entries(cfgHeaders as Record<string, unknown>)) {
        if (typeof v === 'string') headers[k] = v;
      }
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const res = await fetch(url, {
        method,
        headers,
        body:
          method === 'GET' || method === 'DELETE'
            ? undefined
            : JSON.stringify(ctx.payload),
        signal: controller.signal,
      });

      const bodyText = await res.text();
      const latencyMs = Date.now() - started;
      const ok = res.status >= 200 && res.status < 300;
      const retryable = !ok && this.isRetryable(res.status);

      return {
        success: ok,
        statusCode: res.status,
        latencyMs,
        responseBody: bodyText.slice(0, 500),
        error: ok ? null : `HTTP ${res.status}`,
        retryable,
      };
    } catch (err) {
      return {
        success: false,
        statusCode: 0,
        latencyMs: Date.now() - started,
        responseBody: '',
        error: err instanceof Error ? err.message : String(err),
        retryable: true,
      };
    } finally {
      clearTimeout(timer);
    }
  }

  private parseMethod(raw: unknown): 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' {
    const m = typeof raw === 'string' ? raw.toUpperCase() : 'POST';
    if (m === 'GET' || m === 'PUT' || m === 'PATCH' || m === 'DELETE') return m;
    return 'POST';
  }

  private isRetryable(status: number): boolean {
    if (status === 408 || status === 429) return true;
    return status >= 500;
  }

  private error(msg: string, started: number): AdapterResult {
    return {
      success: false,
      statusCode: 0,
      latencyMs: Date.now() - started,
      responseBody: '',
      error: `http adapter: ${msg}`,
      retryable: false,
    };
  }
}