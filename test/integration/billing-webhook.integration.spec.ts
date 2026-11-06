import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../apps/api/src/app.module';
import { PrismaService } from '../../apps/api/src/modules/prisma/prisma.service';
import { MongoService } from '../../apps/api/src/modules/mongo/mongo.service';
import { StripeService } from '../../apps/api/src/modules/billing/stripe.service';
import { HttpExceptionFilter } from '../../apps/api/src/common/filters/http-exception.filter';

describe('Billing webhook integration', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tenantId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(MongoService)
      .useValue({
        onModuleInit: async () => {},
        onModuleDestroy: async () => {},
        eventModel: {} as never,
        deliveryModel: {} as never,
      })
      .overrideProvider(StripeService)
      .useValue({
        isEnabled: () => true,
        isTestMode: () => true,
        constructWebhookEvent: (body: Buffer, _sig: string) => JSON.parse(body.toString()),
        createCustomer: async () => ({ id: 'cus_mock' }),
        createCheckoutSession: async () => ({ url: 'https://x' }),
        createBillingPortal: async () => ({ url: 'https://y' }),
        reportUsage: async () => undefined,
      })
      .compile();

    app = moduleRef.createNestApplication({ rawBody: true });
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
    prisma = app.get(PrismaService);
  }, 60_000);

  afterAll(async () => {
    if (prisma) {
      await prisma.withoutTenant(async (c) => {
        await c.tenant.deleteMany({
          where: { users: { some: { email: { contains: 'wh-billing-' } } } },
        });
      });
    }
    if (app) await app.close();
  });

  beforeEach(async () => {
    await prisma.withoutTenant(async (c) => {
      await c.tenant.deleteMany({
        where: { users: { some: { email: { contains: 'wh-billing-' } } } },
      });
    });

    const signup = await request(app.getHttpServer())
      .post('/api/auth/signup')
      .send({
        name: 'WH Billing',
        tenantName: `WH ${Date.now()}`,
        email: `wh-billing-${Date.now()}@example.com`,
        password: 'Password123!',
      })
      .expect(201);

    tenantId = signup.body.user.tenantId;
  });

  it('checkout.session.completed → subscription active', async () => {
    const event = {
      id: 'evt_checkout_1',
      type: 'checkout.session.completed',
      data: {
        object: {
          subscription: 'sub_new_123',
          metadata: { tenantId },
        },
      },
    };

    await request(app.getHttpServer())
      .post('/api/billing/webhook')
      .set('Stripe-Signature', 'test_sig')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify(event))
      .expect(200);

    const tenant = await prisma.withoutTenant((c) =>
      c.tenant.findUnique({ where: { id: tenantId } }),
    );
    expect(tenant!.stripeSubscriptionId).toBe('sub_new_123');
    expect(tenant!.subscriptionStatus).toBe('active');
  });

  it('subscription.deleted → downgrades to free', async () => {
    await prisma.withoutTenant((c) =>
      c.tenant.update({
        where: { id: tenantId },
        data: { subscriptionStatus: 'active', plan: 'pro' },
      }),
    );

    const event = {
      id: 'evt_del_1',
      type: 'customer.subscription.deleted',
      data: { object: { metadata: { tenantId } } },
    };

    await request(app.getHttpServer())
      .post('/api/billing/webhook')
      .set('Stripe-Signature', 'test_sig')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify(event))
      .expect(200);

    const tenant = await prisma.withoutTenant((c) =>
      c.tenant.findUnique({ where: { id: tenantId } }),
    );
    expect(tenant!.subscriptionStatus).toBe('canceled');
    expect(tenant!.plan).toBe('free');
  });
});