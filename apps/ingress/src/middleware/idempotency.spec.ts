import { describe, it, expect, beforeEach, vi } from 'vitest';
import { enforceIdempotency } from './idempotency';
import { redis } from '../lib/redis';

vi.mock('../lib/redis', () => ({ redis: { set: vi.fn() } }));

describe('enforceIdempotency', () => {
  let req: any;
  let res: any;
  let next: any;

  beforeEach(() => {
    vi.clearAllMocks();
    req = {
      workflow: { id: 'wf-1', tenantId: 't-1' },
      correlationId: 'corr-1',
      rawBody: Buffer.from('{"id":"evt_1"}'),
      headers: {},
    };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    next = vi.fn();
  });

  it('first call: sets key, calls next', async () => {
    (redis.set as any).mockResolvedValue('OK');
    await enforceIdempotency(req, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(req.idempotencyKey).toBeDefined();
    expect(redis.set).toHaveBeenCalledWith(
      expect.stringContaining('idempotency:wf-1:'),
      '1',
      'EX',
      86400,
      'NX',
    );
  });

  it('duplicate call: 200 without next', async () => {
    (redis.set as any).mockResolvedValue(null);
    await enforceIdempotency(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'duplicate' }),
    );
  });

  it('prefers Idempotency-Key header', async () => {
    req.headers['idempotency-key'] = 'source-key-123';
    (redis.set as any).mockResolvedValue('OK');
    await enforceIdempotency(req, res, next);
    expect(redis.set).toHaveBeenCalledWith(
      'idempotency:wf-1:source-key-123',
      '1',
      'EX',
      86400,
      'NX',
    );
  });

  it('uses x-github-delivery header', async () => {
    req.headers['x-github-delivery'] = 'delivery-abc';
    (redis.set as any).mockResolvedValue('OK');
    await enforceIdempotency(req, res, next);
    expect(redis.set).toHaveBeenCalledWith(
      'idempotency:wf-1:delivery-abc',
      '1',
      'EX',
      86400,
      'NX',
    );
  });

  it('falls back to body hash', async () => {
    (redis.set as any).mockResolvedValue('OK');
    await enforceIdempotency(req, res, next);
    const key = (redis.set as any).mock.calls[0][0] as string;
    expect(key).toMatch(/^idempotency:wf-1:body:[a-f0-9]{32}$/);
  });

  it('skips when body empty', async () => {
    req.rawBody = Buffer.alloc(0);
    await enforceIdempotency(req, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(redis.set).not.toHaveBeenCalled();
  });
});