import { Injectable } from '@nestjs/common';
import { DestinationAdapter } from './plugin.decorator';
import { escapeHtml } from './helpers';
import type { AdapterResult, DeliveryAdapter, DeliveryContext } from './types';

const TIMEOUT_MS = 15_000;
const RESEND_ENDPOINT = 'https://api.resend.com/emails';

@Injectable()
@DestinationAdapter({
  type: 'email',
  displayName: 'Email (Resend)',
  fields: [
    {
      key: 'apiKey',
      label: 'Resend API key',
      type: 'password',
      required: true,
      sensitive: true,
      placeholder: 're_...',
    },
    {
      key: 'to',
      label: 'To',
      type: 'string-array',
      required: true,
      placeholder: 'ops@example.com',
      help: 'Comma-separated recipients',
    },
    {
      key: 'from',
      label: 'From',
      type: 'text',
      required: true,
      placeholder: 'Relayon <noreply@yourdomain.com>',
    },
    {
      key: 'subject',
      label: 'Subject',
      type: 'text',
      required: false,
      placeholder: 'Relayon event',
    },
  ],
  testPayload: {
    summary: 'Relayon dry-run email',
    type: 'relayon.test',
  },
})
export class EmailAdapter implements DeliveryAdapter {
  readonly type = 'email';

  async send(ctx: DeliveryContext): Promise<AdapterResult> {
    const started = Date.now();

    const apiKey = ctx.config['apiKey'];
    const to = ctx.config['to'];
    const from = ctx.config['from'];

    if (typeof apiKey !== 'string' || !apiKey.startsWith('re_')) {
      return this.error("missing or invalid 'apiKey'", started);
    }
    if (!Array.isArray(to) && typeof to !== 'string') {
      return this.error("missing 'to' field (string or string[])", started);
    }
    if (typeof from !== 'string') {
      return this.error("missing 'from' field", started);
    }

    const isDryRun = ctx.config['__dryRun'] === true;

    if (isDryRun) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
      try {
        const res = await fetch('https://api.resend.com/domains', {
          method: 'GET',
          headers: { Authorization: `Bearer ${apiKey}` },
          signal: controller.signal,
        });
        const bodyText = await res.text();
        return {
          success: res.ok,
          statusCode: res.status,
          latencyMs: Date.now() - started,
          responseBody: bodyText.slice(0, 500),
          error: res.ok ? null : `Resend auth: ${res.status}`,
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

    const recipients = Array.isArray(to) ? to : [to];
    const subject =
      typeof ctx.config['subject'] === 'string'
        ? ctx.config['subject']
        : `Relayon event ${ctx.correlationId.slice(0, 8)}`;
    const html = this.renderHtml(ctx);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const res = await fetch(RESEND_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ from, to: recipients, subject, html }),
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
        error: ok ? null : `Resend: ${res.status}`,
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

  private renderHtml(ctx: DeliveryContext): string {
    const pretty = JSON.stringify(ctx.payload, null, 2);
    return `
<div style="font-family:system-ui,sans-serif;max-width:640px;margin:0 auto;padding:24px;color:#111">
  <h2 style="margin:0 0 8px">Relayon event</h2>
  <p style="color:#666;margin:0 0 24px;font-size:14px">
    Correlation <code>${escapeHtml(ctx.correlationId)}</code> · attempt ${ctx.attemptNumber}
  </p>
  <pre style="background:#f6f6f6;padding:16px;border-radius:8px;overflow:auto;font-size:12px;line-height:1.5">${escapeHtml(pretty)}</pre>
</div>`.trim();
  }

  private error(msg: string, started: number): AdapterResult {
    return {
      success: false,
      statusCode: 0,
      latencyMs: Date.now() - started,
      responseBody: '',
      error: `email adapter: ${msg}`,
      retryable: false,
    };
  }
}