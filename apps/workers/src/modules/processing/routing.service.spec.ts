import { describe, it, expect } from 'vitest';
import { RoutingService } from './routing.service';

describe('RoutingService', () => {
  const svc = new RoutingService();
  const dests = [{ id: 'dest-1' }, { id: 'dest-2' }];

  it('no rules → all', async () => {
    const out = await svc.decide([], dests, {});
    expect(out.destinationIds).toEqual(['dest-1', 'dest-2']);
    expect(out.reason).toBe('no_rules_configured');
  });

  it('first matching rule wins', async () => {
    const out = await svc.decide(
      [
        { when: `amount > 1000`, destinationIds: ['dest-1'] },
        { when: `amount > 100`, destinationIds: ['dest-2'] },
      ],
      dests,
      { amount: 5000 },
    );
    expect(out.destinationIds).toEqual(['dest-1']);
    expect(out.matchedRule).toBe(0);
  });

  it('no match → empty', async () => {
    const out = await svc.decide(
      [{ when: `amount > 1000`, destinationIds: ['dest-1'] }],
      dests,
      { amount: 5 },
    );
    expect(out.destinationIds).toEqual([]);
    expect(out.reason).toBe('no_rule_matched');
  });

  it('filters non-active destinations', async () => {
    const out = await svc.decide(
      [{ when: `true`, destinationIds: ['dest-1', 'dest-gone'] }],
      dests,
      {},
    );
    expect(out.destinationIds).toEqual(['dest-1']);
  });
});