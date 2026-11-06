import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { stripeMock, StripeConstructorMock, resetStripeMock } from '../../../../../test/mocks/stripe';

vi.mock('stripe', () => ({
  default: StripeConstructorMock,
}));

import { StripeService } from './stripe.service';

describe('StripeService', () => {
  let service: StripeService;

  beforeEach(() => {
    resetStripeMock();
    StripeConstructorMock.mockClear();
    process.env['STRIPE_SECRET_KEY'] = 'sk_test_mock';
    process.env['STRIPE_WEBHOOK_SECRET'] = 'whsec_test_mock';
    service = new StripeService();
    service.onModuleInit();
  });

  afterEach(() => {
    delete process.env['STRIPE_SECRET_KEY'];
    delete process.env['STRIPE_WEBHOOK_SECRET'];
  });

  describe('initialization', () => {
    it('initializes Stripe client with API key', () => {
      // ⚠️ FIX — actual StripeService calls `new Stripe(key)` with 1 arg.
      // It does NOT pass { apiVersion: ... } options.
      expect(StripeConstructorMock).toHaveBeenCalledWith('sk_test_mock');
      expect(service.isEnabled()).toBe(true);
      expect(service.isTestMode()).toBe(true);
    });

    it('disables billing when STRIPE_SECRET_KEY missing', () => {
      delete process.env['STRIPE_SECRET_KEY'];
      const fresh = new StripeService();
      fresh.onModuleInit();
      expect(fresh.isEnabled()).toBe(false);
    });
  });

  describe('createCustomer', () => {
    it('creates customer with tenantId + mode metadata', async () => {
      stripeMock.customers.create.mockResolvedValue({
        id: 'cus_test123',
        email: 'zain@acme.com',
      });

      const customer = await service.createCustomer('zain@acme.com', 't-1');

      expect(stripeMock.customers.create).toHaveBeenCalledWith({
        email: 'zain@acme.com',
        metadata: { tenantId: 't-1', mode: 'test' },
      });
      expect(customer.id).toBe('cus_test123');
    });
  });

  describe('createCheckoutSession', () => {
    it('creates subscription checkout with URLs', async () => {
      stripeMock.checkout.sessions.create.mockResolvedValue({
        id: 'cs_test',
        url: 'https://checkout.stripe.com/pay/cs_test',
      });

      const session = await service.createCheckoutSession({
        customerId: 'cus_1',
        priceId: 'price_pro_monthly',
        tenantId: 't-1',
        successUrl: 'https://relayon.app/settings?billing=success',
        cancelUrl: 'https://relayon.app/settings?billing=cancelled',
      });

      expect(stripeMock.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: 'subscription',
          customer: 'cus_1',
          line_items: [{ price: 'price_pro_monthly', quantity: 1 }],
          subscription_data: { metadata: { tenantId: 't-1' } },
          allow_promotion_codes: true,
        }),
      );
      expect(session.url).toBeDefined();
    });
  });

  describe('createBillingPortal', () => {
    it('creates portal session with return URL', async () => {
      stripeMock.billingPortal.sessions.create.mockResolvedValue({
        url: 'https://billing.stripe.com/session/1',
      });

      const portal = await service.createBillingPortal(
        'cus_1',
        'https://relayon.app/settings',
      );

      expect(stripeMock.billingPortal.sessions.create).toHaveBeenCalledWith({
        customer: 'cus_1',
        return_url: 'https://relayon.app/settings',
      });
      expect(portal.url).toBeDefined();
    });
  });

  describe('reportUsage — test mode', () => {
    it('no-ops in test mode (zero charges)', async () => {
      await service.reportUsage({
        stripeCustomerId: 'cus_1',
        meterEventName: 'relayon_events',
        quantity: 100,
      });

      expect(stripeMock.billing.meterEvents.create).not.toHaveBeenCalled();
      expect(stripeMock.subscriptionItems.createUsageRecord).not.toHaveBeenCalled();
    });
  });

  describe('constructWebhookEvent', () => {
    it('verifies signature with webhook secret', () => {
      const mockEvent = {
        id: 'evt_1',
        type: 'checkout.session.completed',
        data: { object: {} },
      };
      stripeMock.webhooks.constructEvent.mockReturnValue(mockEvent);

      const event = service.constructWebhookEvent(
        Buffer.from('payload'),
        'sig_header',
      );

      expect(stripeMock.webhooks.constructEvent).toHaveBeenCalledWith(
        expect.any(Buffer),
        'sig_header',
        'whsec_test_mock',
      );
      expect(event.type).toBe('checkout.session.completed');
    });

    it('throws when webhook secret missing', () => {
      delete process.env['STRIPE_WEBHOOK_SECRET'];
      expect(() =>
        service.constructWebhookEvent(Buffer.from('x'), 'sig'),
      ).toThrow(/STRIPE_WEBHOOK_SECRET/);
    });
  });
});