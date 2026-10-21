import { createSign } from 'crypto';
import { base64url } from './helpers';
import type { AdapterResult, DeliveryAdapter, DeliveryContext } from './types';

const TIMEOUT_MS = 15_000;
const SHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets';
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';

export class SheetsAdapter implements DeliveryAdapter {
  readonly type = 'sheets';

  async send(ctx: DeliveryContext): Promise<AdapterResult> {
    const started = Date.now();

    const saEmail = ctx.config['serviceAccountEmail'];
    const privateKey = ctx.config['privateKey'];
    const spreadsheetId = ctx.config['spreadsheetId'];
    const range = ctx.config['range'];

    if (
      typeof saEmail !== 'string' ||
      typeof privateKey !== 'string' ||
      typeof spreadsheetId !== 'string' ||
      typeof range !== 'string'
    ) {
      return this.error(
        "requires 'serviceAccountEmail', 'privateKey', 'spreadsheetId', and 'range'",
        started,
      );
    }

    try {
      const token = await this.getAccessToken(saEmail, privateKey);

      const url =
        `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}` +
        `/values/${encodeURIComponent(range)}:append` +
        `?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;

      const serialized = JSON.stringify(ctx.payload);
      const row = [serialized.slice(0, 50_000)]; // Google cell limit

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ values: [row] }),
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
          error: ok ? null : `Sheets: ${res.status}`,
          retryable: !ok && (res.status >= 500 || res.status === 429),
        };
      } finally {
        clearTimeout(timer);
      }
    } catch (err) {
      return {
        success: false,
        statusCode: 0,
        latencyMs: Date.now() - started,
        responseBody: '',
        error: err instanceof Error ? err.message : String(err),
        retryable: false, // auth/signing failures don't retry
      };
    }
  }

  private async getAccessToken(
    saEmail: string,
    privateKeyRaw: string,
  ): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      iss: saEmail,
      scope: SHEETS_SCOPE,
      aud: TOKEN_ENDPOINT,
      iat: now,
      exp: now + 3600,
    };

    const signedJwt = this.signJwt(payload, privateKeyRaw);

    const res = await fetch(TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: signedJwt,
      }).toString(),
    });

    if (!res.ok) {
      const detail = await res.text();
      throw new Error(`Token exchange failed (${res.status}): ${detail.slice(0, 200)}`);
    }

    const json = (await res.json()) as { access_token?: string };
    if (!json.access_token) throw new Error('No access_token in token response');
    return json.access_token;
  }

  private signJwt(
    payload: Record<string, unknown>,
    privateKeyRaw: string,
  ): string {
    // Service account keys often contain literal "\n" in JSON — normalize.
    const pem = privateKeyRaw.includes('\\n')
      ? privateKeyRaw.replace(/\\n/g, '\n')
      : privateKeyRaw;

    const encHeader = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
    const encPayload = base64url(JSON.stringify(payload));
    const data = `${encHeader}.${encPayload}`;

    const signer = createSign('RSA-SHA256');
    signer.update(data);
    signer.end();
    const signature = signer.sign(pem);

    return `${data}.${base64url(signature)}`;
  }

  private error(msg: string, started: number): AdapterResult {
    return {
      success: false,
      statusCode: 0,
      latencyMs: Date.now() - started,
      responseBody: '',
      error: `sheets adapter: ${msg}`,
      retryable: false,
    };
  }
}