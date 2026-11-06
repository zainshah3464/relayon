import { vi } from 'vitest';

/**
 * Stripe SDK mock. Simple object approach — no vi.hoisted needed for
 * our use case. Tests reset via resetStripeMock() between cases.
 */
export const stripeMock = {
  customers: {
    create: vi.fn(),
  },
  checkout: {
    sessions: {
      create: vi.fn(),
    },
  },
  billingPortal: {
    sessions: {
      create: vi.fn(),
    },
  },
  subscriptions: {
    list: vi.fn(),
  },
  subscriptionItems: {
    createUsageRecord: vi.fn(),
  },
  billing: {
    meterEvents: {
      create: vi.fn(),
    },
  },
  webhooks: {
    constructEvent: vi.fn(),
  },
};

export const StripeConstructorMock = vi.fn(() => stripeMock);

export function resetStripeMock(): void {
  for (const section of Object.values(stripeMock)) {
    if (typeof section !== 'object' || section === null) continue;
    for (const fn of Object.values(section)) {
      if (typeof fn === 'function' && 'mockReset' in fn) {
        (fn as { mockReset: () => void }).mockReset();
      } else if (typeof fn === 'object' && fn !== null) {
        for (const sub of Object.values(fn)) {
          if (typeof sub === 'function' && 'mockReset' in sub) {
            (sub as { mockReset: () => void }).mockReset();
          }
        }
      }
    }
  }
}