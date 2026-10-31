import { parentPort, workerData } from 'node:worker_threads';
import type { SandboxModule } from './types';

interface WorkerInit {
  entrypointPath: string;
  config: Record<string, unknown>;
  payload: unknown;
  context: { eventId: string; correlationId: string; attemptNumber: number };
  timeoutMs: number;
}

// Lock down global scope
delete (globalThis as { require?: unknown }).require;

(globalThis as Record<string, unknown>)['fetch'] = async (
  url: string,
  init?: RequestInit,
): Promise<Response> => {
  if (!url.startsWith('https://')) {
    throw new Error('Only HTTPS allowed in sandbox');
  }

  const result = await new Promise<{
    status: number;
    body: string;
    headers: Record<string, string>;
  }>((resolve, reject) => {
    parentPort?.postMessage({
      kind: 'http.request',
      url,
      method: init?.method ?? 'GET',
      headers: (init?.headers ?? {}) as Record<string, string>,
      body: typeof init?.body === 'string' ? init.body : null,
    });
    const onMessage = (msg: {
      kind: string;
      status?: number;
      body?: string;
      error?: string;
      headers?: Record<string, string>;
    }) => {
      if (msg.kind === 'http.response') {
        parentPort?.off('message', onMessage);
        resolve({
          status: msg.status ?? 0,
          body: msg.body ?? '',
          headers: msg.headers ?? {},
        });
      } else if (msg.kind === 'http.error') {
        parentPort?.off('message', onMessage);
        reject(new Error(msg.error ?? 'HTTP failed'));
      }
    };
    parentPort?.on('message', onMessage);
  });

  return new Response(result.body, {
    status: result.status,
    headers: result.headers,
  });
};

const init = workerData as WorkerInit;

(async () => {
  try {
    const mod = (await import(init.entrypointPath)) as {
      default: SandboxModule;
    };

    if (typeof mod.default?.send !== 'function') {
      throw new Error('Sandboxed adapter must export default { send }');
    }

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error(`Sandbox timed out (${init.timeoutMs}ms)`)),
        init.timeoutMs,
      ),
    );

    const result = await Promise.race([
      mod.default.send(init.config, init.payload, init.context),
      timeoutPromise,
    ]);

    parentPort?.postMessage({ kind: 'result', result });
  } catch (err) {
    parentPort?.postMessage({
      kind: 'error',
      error: err instanceof Error ? err.message : String(err),
    });
  }
})();