import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { BillingService } from './billing.service';
import { makePrismaMock } from '../../../../../test/mocks/prisma';

describe('BillingService', () => {
  let service: BillingService;
  let prisma: ReturnType<typeof makePrismaMock>;
  let stripe: {
    isEnabled: Mock;
    isTestMode: Mock;
    createCustomer: Mock;
    createCheckoutSession: Mock;
    createBillingPortal: Mock;
    reportUsage: Mock;
  };

  beforeEach(() => {
    prisma = makePrismaMock();
    stripe = {
      isEnabled: vi.fn(() => true),
      isTestMode: vi.fn(() => true),
      createCustomer: vi.fn(),
      createCheckoutSession: vi.fn(),
      createBillingPortal: vi.fn(),
      reportUsage: vi.fn(),
    };
    service = new BillingService(prisma as never, stripe as never);
  });

  describe('getStatus', () => {
    it('returns billing status with Stripe state', async () => {
      prisma.tenant.findUnique.mockResolvedValue({
        stripeCustomerId: 'cus_1',
        stripeSubscriptionId: 'sub_1',
        stripePriceId: 'price_pro',
        subscriptionStatus: 'active',
        currentPeriodEnd: new Date('2026-12-01'),
        plan: 'pro',
      });

      const status = await service.getStatus('t-1');

      expect(status.plan).toBe('pro');
      expect(status.subscriptionStatus).toBe('active');
      expect(status.billingEnabled).toBe(true);
      expect(status.testMode).toBe(true);
    });

    it('throws for missing tenant', async () => {
      prisma.tenant.findUnique.mockResolvedValue(null);
      await expect(service.getStatus('missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('createCheckout', () => {
    it('creates customer on first checkout', async () => {
      prisma.tenant.findUnique.mockResolvedValue({ stripeCustomerId: null });
      stripe.createCustomer.mockResolvedValue({ id: 'cus_new' });
      prisma.tenant.update.mockResolvedValue({});
      stripe.createCheckoutSession.mockResolvedValue({
        url: 'https://checkout.stripe.com/pay/cs_1',
      });

      const result = await service.createCheckout(
        't-1',
        'user@example.com',
        'price_pro',
        'https://relayon.app',
      );

      expect(stripe.createCustomer).toHaveBeenCalledWith('user@example.com', 't-1');
      expect(prisma.tenant.update).toHaveBeenCalledWith({
        where: { id: 't-1' },
        data: { stripeCustomerId: 'cus_new' },
      });
      expect(result.url).toBeDefined();
    });

    it('reuses existing customer', async () => {
      prisma.tenant.findUnique.mockResolvedValue({ stripeCustomerId: 'cus_existing' });
      stripe.createCheckoutSession.mockResolvedValue({ url: 'https://x' });

      await service.createCheckout('t-1', 'x@y.com', 'price', 'https://app');

      expect(stripe.createCustomer).not.toHaveBeenCalled();
      expect(stripe.createCheckoutSession).toHaveBeenCalledWith(
        expect.objectContaining({ customerId: 'cus_existing' }),
      );
    });
  });

  describe('reportUsageForQuota', () => {
    it('skips when Stripe disabled', async () => {
      stripe.isEnabled.mockReturnValue(false);
      await service.reportUsageForQuota('t-1', 'events', 10);
      expect(stripe.reportUsage).not.toHaveBeenCalled();
    });

    it('skips for zero quantity', async () => {
      await service.reportUsageForQuota('t-1', 'events', 0);
      expect(stripe.reportUsage).not.toHaveBeenCalled();
    });

    it('reports for active subscription', async () => {
      prisma.tenant.findUnique.mockResolvedValue({
        stripeCustomerId: 'cus_1',
        subscriptionStatus: 'active',
      });
      stripe.reportUsage.mockResolvedValue(undefined);

      await service.reportUsageForQuota('t-1', 'ai_tokens', 5000);

      expect(stripe.reportUsage).toHaveBeenCalledWith({
        stripeCustomerId: 'cus_1',
        meterEventName: 'relayon_ai_tokens',
        quantity: 5000,
      });
    });

    it('skips for canceled subscription', async () => {
      prisma.tenant.findUnique.mockResolvedValue({
        stripeCustomerId: 'cus_1',
        subscriptionStatus: 'canceled',
      });

      await service.reportUsageForQuota('t-1', 'events', 10);
      expect(stripe.reportUsage).not.toHaveBeenCalled();
    });

    it('swallows Stripe errors (fire-and-forget)', async () => {
      prisma.tenant.findUnique.mockResolvedValue({
        stripeCustomerId: 'cus_1',
        subscriptionStatus: 'active',
      });
      stripe.reportUsage.mockRejectedValue(new Error('Stripe down'));

      await expect(
        service.reportUsageForQuota('t-1', 'events', 10),
      ).resolves.toBeUndefined();
    });
  });

  describe('handleWebhook', () => {
    it('checkout.session.completed → subscription active', async () => {
      prisma.tenant.update.mockResolvedValue({});

      await service.handleWebhook({
        type: 'checkout.session.completed',
        data: {
          object: {
            subscription: 'sub_new',
            metadata: { tenantId: 't-1' },
          },
        },
      });

      expect(prisma.tenant.update).toHaveBeenCalledWith({
        where: { id: 't-1' },
        data: { stripeSubscriptionId: 'sub_new', subscriptionStatus: 'active' },
      });
    });

    it('customer.subscription.updated → sync status', async () => {
      prisma.tenant.update.mockResolvedValue({});

      await service.handleWebhook({
        type: 'customer.subscription.updated',
        data: {
          object: {
            id: 'sub_1',
            status: 'past_due',
            metadata: { tenantId: 't-1' },
            current_period_end: 1_800_000_000,
            items: { data: [{ price: { id: 'price_pro' } }] },
          },
        },
      });

      expect(prisma.tenant.update).toHaveBeenCalledWith({
        where: { id: 't-1' },
        data: {
          stripeSubscriptionId: 'sub_1',
          stripePriceId: 'price_pro',
          subscriptionStatus: 'past_due',
          currentPeriodEnd: expect.any(Date),
        },
      });
    });

    it('customer.subscription.deleted → downgrade to free', async () => {
      prisma.tenant.update.mockResolvedValue({});

      await service.handleWebhook({
        type: 'customer.subscription.deleted',
        data: { object: { metadata: { tenantId: 't-1' } } },
      });

      expect(prisma.tenant.update).toHaveBeenCalledWith({
        where: { id: 't-1' },
        data: { subscriptionStatus: 'canceled', plan: 'free' },
      });
    });

    it('ignores unknown event type', async () => {
      await expect(
        service.handleWebhook({
          type: 'invoice.created',
          data: { object: {} },
        }),
      ).resolves.toBeUndefined();
      expect(prisma.tenant.update).not.toHaveBeenCalled();
    });

    it('ignores event without tenantId', async () => {
      await service.handleWebhook({
        type: 'checkout.session.completed',
        data: { object: {} },
      });
      expect(prisma.tenant.update).not.toHaveBeenCalled();
    });
  });
});