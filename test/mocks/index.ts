import { vi } from 'vitest';

export function makeFakeRedis() {
  const data = new Map<string, string>();
  const zsets = new Map<string, Array<{ score: number; member: string }>>();
  const lists = new Map<string, string[]>();

  return {
    get: vi.fn(async (k: string) => data.get(k) ?? null),
    set: vi.fn(async (k: string, v: string) => {
      data.set(k, v);
      return 'OK';
    }),
    del: vi.fn(async (k: string) => (data.delete(k) ? 1 : 0)),
    incr: vi.fn(async (k: string) => {
      const n = parseInt(data.get(k) ?? '0', 10) + 1;
      data.set(k, String(n));
      return n;
    }),
    expire: vi.fn(async () => 1),
    ping: vi.fn(async () => 'PONG'),
    quit: vi.fn(async () => 'OK'),
    lpush: vi.fn(async (k: string, v: string) => {
      const list = lists.get(k) ?? [];
      list.unshift(v);
      lists.set(k, list);
      return list.length;
    }),
    rpush: vi.fn(async (k: string, v: string) => {
      const list = lists.get(k) ?? [];
      list.push(v);
      lists.set(k, list);
      return list.length;
    }),
    rpop: vi.fn(async (k: string) => {
      const list = lists.get(k) ?? [];
      return list.pop() ?? null;
    }),
    rpoplpush: vi.fn(async (src: string, dst: string) => {
      const srcList = lists.get(src) ?? [];
      const item = srcList.pop() ?? null;
      if (item) {
        const dstList = lists.get(dst) ?? [];
        dstList.unshift(item);
        lists.set(dst, dstList);
      }
      return item;
    }),
    lrem: vi.fn(async (k: string, _n: number, v: string) => {
      const list = lists.get(k) ?? [];
      const idx = list.indexOf(v);
      if (idx >= 0) {
        list.splice(idx, 1);
        lists.set(k, list);
        return 1;
      }
      return 0;
    }),
    llen: vi.fn(async (k: string) => (lists.get(k) ?? []).length),
    lpos: vi.fn(async (k: string, v: string) => {
      const list = lists.get(k) ?? [];
      const idx = list.indexOf(v);
      return idx >= 0 ? idx : null;
    }),
    zadd: vi.fn(async (k: string, score: number, member: string) => {
      const set = zsets.get(k) ?? [];
      const idx = set.findIndex((x) => x.member === member);
      if (idx >= 0) set[idx] = { score, member };
      else set.push({ score, member });
      zsets.set(k, set);
      return 1;
    }),
    zrem: vi.fn(async (k: string, member: string) => {
      const set = zsets.get(k) ?? [];
      const before = set.length;
      const next = set.filter((x) => x.member !== member);
      zsets.set(k, next);
      return before - next.length;
    }),
    zrangebyscore: vi.fn(
      async (k: string, min: number, max: number) => {
        const set = zsets.get(k) ?? [];
        return set
          .filter((x) => x.score >= min && x.score <= max)
          .sort((a, b) => a.score - b.score)
          .map((x) => x.member);
      },
    ),
    zcard: vi.fn(async (k: string) => (zsets.get(k) ?? []).length),
    __data: data,
    __zsets: zsets,
    __lists: lists,
    __reset: () => {
      data.clear();
      zsets.clear();
      lists.clear();
    },
  };
}

export function makeFakeGroq(response: unknown) {
  return {
    chat: {
      completions: {
        create: vi.fn(async () => ({
          choices: [{ message: { content: JSON.stringify(response) } }],
        })),
      },
    },
  };
}

export function mockFetch(
  responses: Array<{
    status: number;
    body: unknown;
    headers?: Record<string, string>;
  }>,
): { calls: Array<{ url: string; init?: RequestInit }>; restore: () => void } {
  const original = globalThis.fetch;
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  let i = 0;

  globalThis.fetch = vi.fn(
    async (input: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(input), init });
      const r = responses[i++] ?? responses[responses.length - 1]!;
      return new Response(
        typeof r.body === 'string' ? r.body : JSON.stringify(r.body),
        {
          status: r.status,
          headers: {
            'Content-Type': 'application/json',
            ...(r.headers ?? {}),
          },
        },
      );
    },
  ) as unknown as typeof fetch;

  return {
    calls,
    restore: () => {
      globalThis.fetch = original;
    },
  };
}