import { Injectable } from '@nestjs/common';
import { DestinationAdapter } from './plugin.decorator';
import type { AdapterResult, DeliveryAdapter, DeliveryContext } from './types';

const TIMEOUT_MS = 10_000;

@Injectable()
@DestinationAdapter({
  type: 'slack',
  displayName: 'Slack',
  configSchema: {
    required: ['webhookUrl'],
  },
})
export class SlackAdapter implements DeliveryAdapter {
  readonly type = 'slack';

  async send(ctx: DeliveryContext): Promise<AdapterResult> {
    const started = Date.now();
    const webhookUrl = ctx.config['webhookUrl'];
    if (
      typeof webhookUrl !== 'string' ||
      !webhookUrl.startsWith('https://hooks.slack.com/')
    ) {
      return this.error("missing or invalid 'webhookUrl'", started);
    }

    if (ctx.config['__dryRun'] === true) {
      return {
        success: true,
        statusCode: 200,
        latencyMs: Date.now() - started,
        responseBody: 'config valid — Slack webhooks cannot be tested without sending a message',
        error: null,
        retryable: false,
      };
    }

    const text = this.formatMessage(ctx);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
        signal: controller.signal,
      });
      const bodyText = await res.text();
      const latencyMs = Date.now() - started;
      // Slack returns 200 with body "ok" on success
      const ok = res.ok && bodyText.trim() === 'ok';

      return {
        success: ok,
        statusCode: res.status,
        latencyMs,
        responseBody: bodyText.slice(0, 500),
        error: ok ? null : `Slack: ${res.status} ${bodyText.slice(0, 100)}`,
        retryable: !ok && (res.status >= 500 || res.status === 429),
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

  private formatMessage(ctx: DeliveryContext): string {
    const p = ctx.payload;
    if (p && typeof p === 'object' && 'summary' in p) {
      const summary = (p as Record<string, unknown>)['summary'];
      if (typeof summary === 'string') return summary;
    }
    return `Relayon event ${ctx.eventId} (correlation: ${ctx.correlationId})`;
  }

  private error(msg: string, started: number): AdapterResult {
    return {
      success: false,
      statusCode: 0,
      latencyMs: Date.now() - started,
      responseBody: '',
      error: `slack adapter: ${msg}`,
      retryable: false,
    };
  }
}