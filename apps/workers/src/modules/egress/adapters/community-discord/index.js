export default {
  async send(config, payload, context) {
    const started = Date.now();
    const webhookUrl = config.webhookUrl;
    if (typeof webhookUrl !== 'string' || !webhookUrl.startsWith('https://discord.com/api/webhooks/')) {
      return {
        success: false, statusCode: 0,
        latencyMs: Date.now() - started,
        responseBody: '', error: 'invalid webhookUrl', retryable: false,
      };
    }

    const summary =
      (payload && typeof payload === 'object' && payload.summary) ||
      `Relayon event ${context.eventId}`;
    const username = config.username || 'Relayon';

    try {
      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: String(summary).slice(0, 2000), username }),
      });
      const body = await res.text();
      return {
        success: res.ok, statusCode: res.status,
        latencyMs: Date.now() - started,
        responseBody: body.slice(0, 500),
        error: res.ok ? null : `Discord: ${res.status}`,
        retryable: !res.ok && (res.status >= 500 || res.status === 429),
      };
    } catch (err) {
      return {
        success: false, statusCode: 0,
        latencyMs: Date.now() - started,
        responseBody: '', error: err.message || String(err),
        retryable: true,
      };
    }
  },
};