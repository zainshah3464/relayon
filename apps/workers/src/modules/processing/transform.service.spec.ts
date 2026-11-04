import { describe, it, expect } from 'vitest';
import { TransformService } from './transform.service';

describe('TransformService', () => {
  const svc = new TransformService();

  it('extracts fields', async () => {
    const out = await svc.apply(`{ 'type': type, 'amount': data.amount }`, {
      type: 'checkout',
      data: { amount: 5000 },
    });
    expect(out).toEqual({ type: 'checkout', amount: 5000 });
  });

  it('arithmetic', async () => {
    const out = await svc.apply(`data.amount / 100`, {
      data: { amount: 5000 },
    });
    expect(out).toBe(50);
  });

  it('string concat', async () => {
    const out = await svc.apply(`'Hi ' & customer.name`, {
      customer: { name: 'Zain' },
    });
    expect(out).toBe('Hi Zain');
  });

  it('missing field → null', async () => {
    const out = await svc.apply(`missing.field`, {});
    expect(out).toBeNull();
  });

  it('throws on invalid expression', async () => {
    await expect(svc.apply(`{{ bad jsonata`, {})).rejects.toThrow(/compile/i);
  });
});