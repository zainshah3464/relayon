const MAX_RECONNECT_DELAY_MS = 30_000;

interface SseClientOptions {
  url: string;
  authHeaders: Record<string, string>;
  signal: AbortSignal;
  onEvent: (data: unknown) => void | Promise<void>;
  onError: (err: unknown) => void;
}

export async function createSseClient(opts: SseClientOptions): Promise<void> {
  let attempt = 0;

  while (!opts.signal.aborted) {
    try {
      const res = await fetch(opts.url, {
        headers: {
          Accept: 'text/event-stream',
          'Cache-Control': 'no-cache',
          ...opts.authHeaders,
        },
        signal: opts.signal,
      });

      if (!res.ok || !res.body) {
        throw new Error(`SSE ${res.status}`);
      }

      attempt = 0;

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split('\n\n');
        buffer = events.pop() ?? '';

        for (const evt of events) {
          const dataLine = evt.split('\n').find((l) => l.startsWith('data: '));
          if (!dataLine) continue;
          try {
            const data = JSON.parse(dataLine.slice(6));
            await opts.onEvent(data);
          } catch {
            /* ignore malformed */
          }
        }
      }
    } catch (err) {
      if (opts.signal.aborted) return;
      opts.onError(err);

      attempt += 1;
      const base = Math.min(1000 * Math.pow(2, attempt), MAX_RECONNECT_DELAY_MS);
      const jitter = Math.random() * 1000;
      await new Promise((r) => setTimeout(r, base + jitter));
    }
  }
}