import { Injectable } from '@nestjs/common';
import { DestinationAdapter } from './plugin.decorator';
import type { AdapterResult, DeliveryAdapter, DeliveryContext } from './types';

const TIMEOUT_MS = 15_000;
const PAGES_ENDPOINT = 'https://api.notion.com/v1/pages';
const DEFAULT_NOTION_VERSION = '2026-03-11';
const RICH_TEXT_LIMIT = 2000;

@Injectable()
@DestinationAdapter({
  type: 'notion',
  displayName: 'Notion',
  configSchema: {
    required: ['apiKey', 'dataSourceId', 'titleProperty'],
    optional: ['payloadProperty', 'notionVersion'],
  },
})
export class NotionAdapter implements DeliveryAdapter {
  readonly type = 'notion';

  async send(ctx: DeliveryContext): Promise<AdapterResult> {
    const started = Date.now();

    const apiKey = ctx.config['apiKey'];
    const dataSourceId = ctx.config['dataSourceId'];
    const titleProperty = ctx.config['titleProperty'];

    if (typeof apiKey !== 'string' || apiKey.length === 0) {
      return this.error("missing 'apiKey'", started);
    }
    if (typeof dataSourceId !== 'string' || dataSourceId.length === 0) {
      return this.error("missing 'dataSourceId'", started);
    }
    if (typeof titleProperty !== 'string' || titleProperty.length === 0) {
      return this.error("missing 'titleProperty'", started);
    }

    const notionVersion =
      typeof ctx.config['notionVersion'] === 'string'
        ? ctx.config['notionVersion']
        : DEFAULT_NOTION_VERSION;

    const properties: Record<string, unknown> = {
      [titleProperty]: {
        title: [{ text: { content: this.titleFor(ctx.payload, ctx.eventId) } }],
      },
    };

    const payloadProperty = ctx.config['payloadProperty'];
    if (typeof payloadProperty === 'string' && payloadProperty.length > 0) {
      properties[payloadProperty] = {
        rich_text: [
          {
            text: {
              content: JSON.stringify(ctx.payload, null, 2).slice(
                0,
                RICH_TEXT_LIMIT,
              ),
            },
          },
        ],
      };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const res = await fetch(PAGES_ENDPOINT, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'Notion-Version': notionVersion,
        },
        body: JSON.stringify({
          parent: { data_source_id: dataSourceId },
          properties,
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
        error: ok ? null : `Notion: ${res.status}`,
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

  private titleFor(payload: unknown, eventId: string): string {
    if (payload && typeof payload === 'object') {
      const obj = payload as Record<string, unknown>;
      for (const key of ['summary', 'subject', 'title', 'name', 'type']) {
        const v = obj[key];
        if (typeof v === 'string' && v.trim().length > 0) {
          return v.slice(0, 2000);
        }
      }
    }
    return `Relayon event ${eventId}`;
  }

  private error(msg: string, started: number): AdapterResult {
    return {
      success: false,
      statusCode: 0,
      latencyMs: Date.now() - started,
      responseBody: '',
      error: `notion adapter: ${msg}`,
      retryable: false,
    };
  }
}