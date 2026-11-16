interface ForwardOptions {
  port: number;
  pathOverride?: string;
  method: string;
  path: string;
  headers: Record<string, string>;
  body: string;
}

interface ForwardResult {
  status: number;
  latencyMs: number;
  error: string | null;
}

const TIMEOUT_MS = 10_000;

export async function forwardWebhook(
  opts: ForwardOptions,
): Promise<ForwardResult> {
  const started = Date.now();
  const path = opts.pathOverride || opts.path || '/';
  const url = `http://localhost:${opts.port}${path.startsWith('/') ? path : '/' + path}`;

  const headers = { ...opts.headers };
  delete headers['host'];
  delete headers['content-length'];
  delete headers['connection'];
  delete headers['accept-encoding'];
  delete headers['transfer-encoding'];

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: opts.method,
      headers,
      body:
        opts.method === 'GET' || opts.method === 'HEAD' ? undefined : opts.body,
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return { status: res.status, latencyMs: Date.now() - started, error: null };
  } catch (err) {
    clearTimeout(timeout);
    const message = err instanceof Error ? err.message : String(err);
    return {
      status: 0,
      latencyMs: Date.now() - started,
      error: message.includes('aborted')
        ? 'timeout'
        : message.includes('ECONNREFUSED') || message.includes('fetch failed')
          ? `localhost:${opts.port} not running`
          : message.slice(0, 80),
    };
  }
}