import { Injectable } from '@nestjs/common';
import { DestinationAdapter } from './plugin.decorator';
import type { AdapterResult, DeliveryAdapter, DeliveryContext } from './types';

const TIMEOUT_MS = 10_000;
const API_ROOT = 'https://api.airtable.com/v0';

@Injectable()
@DestinationAdapter({
  type: 'airtable',
  displayName: 'Airtable',
  configSchema: {
    required: ['apiKey', 'baseId', 'tableName'],
    optional: ['typecast'],
  },
})
export class AirtableAdapter implements DeliveryAdapter {
  readonly type = 'airtable';

  async send(ctx: DeliveryContext): Promise<AdapterResult> {
    const started = Date.now();

    const apiKey = ctx.config['apiKey'];
    const baseId = ctx.config['baseId'];
    const tableName = ctx.config['tableName'];

    if (typeof apiKey !== 'string' || apiKey.length === 0) {
      return this.error("missing 'apiKey'", started);
    }
    if (typeof baseId !== 'string' || !/^app[a-zA-Z0-9]{14,}$/.test(baseId)) {
      return this.error("invalid or missing 'baseId'", started);
    }
    if (typeof tableName !== 'string' || tableName.length === 0) {
      return this.error("missing 'tableName'", started);
    }

    const typecast = ctx.config['typecast'] === true;
    const fields = this.toFields(ctx.payload);

    const url = `${API_ROOT}/${encodeURIComponent(baseId)}/${encodeURIComponent(tableName)}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          records: [{ fields }],
          ...(typecast ? { typecast: true } : {}),
        }),
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
        error: ok ? null : `Airtable: ${res.status}`,
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

  /**
   * Airtable expects { fields: { "Column Name": value } }. If the payload is
   * already a flat object we send it as-is; otherwise we stringify into a
   * single "Payload" field so nothing is silently dropped.
   */
  private toFields(payload: unknown): Record<string, unknown> {
    if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
      const obj = payload as Record<string, unknown>;
      const allPrimitive = Object.values(obj).every(
        (v) =>
          v === null ||
          typeof v === 'string' ||
          typeof v === 'number' ||
          typeof v === 'boolean',
      );
      if (allPrimitive && Object.keys(obj).length > 0) {
        return obj;
      }
    }
    return { Payload: JSON.stringify(payload).slice(0, 100_000) };
  }

  private error(msg: string, started: number): AdapterResult {
    return {
      success: false,
      statusCode: 0,
      latencyMs: Date.now() - started,
      responseBody: '',
      error: `airtable adapter: ${msg}`,
      retryable: false,
    };
  }
}