import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StripeService } from './stripe.service';

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stripe: StripeService,
  ) {}

  async getStatus(tenantId: string) {
    return this.prisma.withTenant(tenantId, async (tx) => {
      const tenant = await tx.tenant.findUnique({
        where: { id: tenantId },
        select: {
          stripeCustomerId: true,
          stripeSubscriptionId: true,
          stripePriceId: true,
          subscriptionStatus: true,
          currentPeriodEnd: true,
          plan: true,
        },
      });
      if (!tenant) throw new NotFoundException('Tenant not found');
      return {
        ...tenant,
        billingEnabled: this.stripe.isEnabled(),
        testMode: this.stripe.isTestMode(),
      };
    });
  }

  async createCheckout(
    tenantId: string,
    email: string,
    priceId: string,
    origin: string,
  ): Promise<{ url: string }> {
    if (!this.stripe.isEnabled()) {
      throw new NotFoundException('Billing is not configured on this instance');
    }

    let customerId = await this.prisma.withTenant(tenantId, async (tx) => {
      const t = await tx.tenant.findUnique({
        where: { id: tenantId },
        select: { stripeCustomerId: true },
      });
      return t?.stripeCustomerId ?? null;
    });

    if (!customerId) {
      const customer = await this.stripe.createCustomer(email, tenantId);
      customerId = customer.id;
      await this.prisma.withTenant(tenantId, (tx) =>
        tx.tenant.update({
          where: { id: tenantId },
          data: { stripeCustomerId: customerId },
        }),
      );
    }

    const session = await this.stripe.createCheckoutSession({
      customerId,
      priceId,
      tenantId,
      successUrl: `${origin}/settings?billing=success`,
      cancelUrl: `${origin}/settings?billing=cancelled`,
    });

    if (!session.url) throw new Error('Stripe did not return a checkout URL');
    return { url: session.url };
  }

  async createPortal(tenantId: string, origin: string): Promise<{ url: string }> {
    const customerId = await this.prisma.withTenant(tenantId, async (tx) => {
      const t = await tx.tenant.findUnique({
        where: { id: tenantId },
        select: { stripeCustomerId: true },
      });
      return t?.stripeCustomerId ?? null;
    });
    if (!customerId) throw new NotFoundException('No Stripe customer for tenant');
    const portal = await this.stripe.createBillingPortal(
      customerId,
      `${origin}/settings`,
    );
    return { url: portal.url };
  }

  async reportUsageForQuota(
    tenantId: string,
    metric: 'events' | 'ai_tokens',
    quantity: number,
  ): Promise<void> {
    if (!this.stripe.isEnabled() || quantity <= 0) return;

    const tenant = await this.prisma.withoutTenant((c) =>
      c.tenant.findUnique({
        where: { id: tenantId },
        select: { stripeCustomerId: true, subscriptionStatus: true },
      }),
    );
    if (!tenant?.stripeCustomerId) return;
    if (
      tenant.subscriptionStatus !== 'active' &&
      tenant.subscriptionStatus !== 'trialing'
    ) {
      return;
    }

    const meterEventName =
      metric === 'ai_tokens' ? 'relayon_ai_tokens' : 'relayon_events';

    try {
      await this.stripe.reportUsage({
        stripeCustomerId: tenant.stripeCustomerId,
        meterEventName,
        quantity,
      });
    } catch (err) {
      this.logger.error(
        `Stripe usage report failed for ${tenantId}/${metric}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  async handleWebhook(event: {
    type: string;
    data: { object: Record<string, unknown> };
  }): Promise<void> {
    const obj = event.data.object as Record<string, unknown>;
    const subMeta = (obj['subscription_data'] as { metadata?: { tenantId?: string } } | undefined)
      ?.metadata;

    switch (event.type) {
      case 'checkout.session.completed': {
        const tenantId =
          subMeta?.tenantId ??
          (obj['metadata'] as { tenantId?: string } | undefined)?.tenantId;
        if (!tenantId) return;
        await this.prisma.withTenant(tenantId, (tx) =>
          tx.tenant.update({
            where: { id: tenantId },
            data: {
              stripeSubscriptionId: obj['subscription'] as string | undefined,
              subscriptionStatus: 'active',
            },
          }),
        );
        break;
      }
      case 'customer.subscription.updated':
      case 'customer.subscription.created': {
        const tenantId = (obj['metadata'] as { tenantId?: string } | undefined)
          ?.tenantId;
        if (!tenantId) return;
        const items = obj['items'] as
          | { data?: Array<{ price?: { id?: string } }> }
          | undefined;
        await this.prisma.withTenant(tenantId, (tx) =>
          tx.tenant.update({
            where: { id: tenantId },
            data: {
              stripeSubscriptionId: obj['id'] as string,
              stripePriceId: items?.data?.[0]?.price?.id ?? null,
              subscriptionStatus: obj['status'] as string,
              currentPeriodEnd: obj['current_period_end']
                ? new Date((obj['current_period_end'] as number) * 1000)
                : null,
            },
          }),
        );
        break;
      }
      case 'customer.subscription.deleted': {
        const tenantId = (obj['metadata'] as { tenantId?: string } | undefined)
          ?.tenantId;
        if (!tenantId) return;
        await this.prisma.withTenant(tenantId, (tx) =>
          tx.tenant.update({
            where: { id: tenantId },
            data: { subscriptionStatus: 'canceled', plan: 'free' },
          }),
        );
        break;
      }
      default:
        this.logger.debug(`Unhandled Stripe event: ${event.type}`);
    }
  }
}