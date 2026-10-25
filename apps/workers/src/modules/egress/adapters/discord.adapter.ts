import { Injectable } from '@nestjs/common';
import { DestinationAdapter } from './plugin.decorator';
import type { AdapterResult, DeliveryAdapter, DeliveryContext } from './types';

const TIMEOUT_MS = 10_000;
const DISCORD_MAX_CONTENT = 2000;

@Injectable()
@DestinationAdapter({
  type: 'discord',
  displayName: 'Discord',
  configSchema: {
    required: ['webhookUrl'],
    optional: ['username'],
  },
})
export class DiscordAdapter implements DeliveryAdapter {
  readonly type = 'discord';

  async send(ctx: DeliveryContext): Promise<AdapterResult> {
    const started = Date.now();
    const webhookUrl = ctx.config['webhookUrl'];
    if (
      typeof webhookUrl !== 'string' ||
      !webhookUrl.startsWith('https://discord.com/api/webhooks/')
    ) {
      return this.error("missing or invalid 'webhookUrl'", started);
    }

    if (ctx.config['__dryRun'] === true) {
      return {
        success: true,
        statusCode: 200,
        latencyMs: Date.now() - started,
        responseBody: 'config valid — Discord webhooks cannot be tested without sending a message',
        error: null,
        retryable: false,
      };
    }

    const content = this.formatContent(ctx);
    const username =
      typeof ctx.config['username'] === 'string'
        ? ctx.config['username']
        : 'Relayon';

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, username }),
        signal: controller.signal,
      });

      const bodyText = await res.text();
      const latencyMs = Date.now() - started;
      const ok = res.ok;

      return {
        success: ok,
        statusCode: res.status,
        latencyMs,
        responseBody: bodyText.slice(0, 500),
        error: ok ? null : `Discord: ${res.status}`,
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

  private formatContent(ctx: DeliveryContext): string {
    const p = ctx.payload;
    if (p && typeof p === 'object' && 'summary' in p) {
      const summary = (p as Record<string, unknown>)['summary'];
      if (typeof summary === 'string') {
        return summary.slice(0, DISCORD_MAX_CONTENT);
      }
    }
    return `Relayon event \`${ctx.eventId}\` (correlation: \`${ctx.correlationId}\`)`.slice(
      0,
      DISCORD_MAX_CONTENT,
    );
  }

  private error(msg: string, started: number): AdapterResult {
    return {
      success: false,
      statusCode: 0,
      latencyMs: Date.now() - started,
      responseBody: '',
      error: `discord adapter: ${msg}`,
      retryable: false,
    };
  }
}