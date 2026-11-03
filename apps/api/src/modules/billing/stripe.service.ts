import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import Stripe from 'stripe';

@Injectable()
export class StripeService implements OnModuleInit {
  private readonly logger = new Logger(StripeService.name);
  private stripe: Stripe | null = null;
  private testMode = false;

  onModuleInit(): void {
    const key = process.env['STRIPE_SECRET_KEY'];
    if (!key) {
      this.logger.warn(
        'STRIPE_SECRET_KEY not set — billing UI shows "disabled" (platform still 100% free)',
      );
      return;
    }

    this.testMode = key.startsWith('sk_test_');
    if (!this.testMode) {
      this.logger.warn(
        '⚠️ LIVE Stripe key detected. This project is FREE — use sk_test_... for zero-charge demo.',
      );
    } else {
      this.logger.log('✅ Stripe TEST MODE initialized (zero charges)');
    }

    // No apiVersion → SDK uses its default (matches installed SDK version)
    this.stripe = new Stripe(key);
  }

  isEnabled(): boolean {
    return this.stripe !== null;
  }

  isTestMode(): boolean {
    return this.testMode;
  }

  private require(): Stripe {
    if (!this.stripe) throw new Error('Stripe not configured');
    return this.stripe;
  }

  async createCustomer(
    email: string,
    tenantId: string,
  ): Promise<Stripe.Customer> {
    return this.require().customers.create({
      email,
      metadata: { tenantId, mode: this.testMode ? 'test' : 'live' },
    });
  }

  async createCheckoutSession(params: {
    customerId: string;
    priceId: string;
    tenantId: string;
    successUrl: string;
    cancelUrl: string;
  }): Promise<Stripe.Checkout.Session> {
    return this.require().checkout.sessions.create({
      mode: 'subscription',
      customer: params.customerId,
      line_items: [{ price: params.priceId, quantity: 1 }],
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      subscription_data: {
        metadata: { tenantId: params.tenantId },
      },
      allow_promotion_codes: true,
    });
  }

  async createBillingPortal(
    customerId: string,
    returnUrl: string,
  ): Promise<Stripe.BillingPortal.Session> {
    return this.require().billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });
  }

  /**
   * Test mode: log only, zero Stripe calls, zero cost.
   * Live mode: never used by this project (kept for type safety).
   */
  async reportUsage(params: {
    stripeCustomerId: string;
    meterEventName: string;
    quantity: number;
  }): Promise<void> {
    if (this.testMode) {
      this.logger.debug(
        `[TEST] no-op: ${params.quantity} × ${params.meterEventName} for ${params.stripeCustomerId}`,
      );
      return;
    }
    await this.require().billing.meterEvents.create({
      event_name: params.meterEventName,
      payload: {
        value: String(params.quantity),
        stripe_customer_id: params.stripeCustomerId,
      },
    });
  }

  constructWebhookEvent(rawBody: Buffer, signature: string): Stripe.Event {
    const secret = process.env['STRIPE_WEBHOOK_SECRET'];
    if (!secret) throw new Error('STRIPE_WEBHOOK_SECRET missing');
    return this.require().webhooks.constructEvent(rawBody, signature, secret);
  }
}