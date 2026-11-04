import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../apps/api/src/app.module';
import { PrismaService } from '../../apps/api/src/modules/prisma/prisma.service';
import { MongoService } from '../../apps/api/src/modules/mongo/mongo.service';
import { HttpExceptionFilter } from '../../apps/api/src/common/filters/http-exception.filter';
import { QuotaService } from '../../apps/api/src/modules/quota/quota.service';

describe('Quota (integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let quota: QuotaService;
  let tenantId: string;
  let token: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(MongoService)
      .useValue({
        onModuleInit: async () => {},
        onModuleDestroy: async () => {},
        eventModel: {} as never,
        deliveryModel: {} as never,
      })
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
    prisma = app.get(PrismaService);
    quota = app.get(QuotaService);
  }, 60_000);

  afterAll(async () => {
    if (prisma) {
      await prisma.withoutTenant(async (c) => {
        await c.tenant.deleteMany({
          where: { users: { some: { email: { contains: 'quota-test-' } } } },
        });
      });
    }
    if (app) await app.close();
  });

  beforeEach(async () => {
    await prisma.withoutTenant(async (c) => {
      await c.tenant.deleteMany({
        where: { users: { some: { email: { contains: 'quota-test-' } } } },
      });
    });

    const signup = await request(app.getHttpServer())
      .post('/api/auth/signup')
      .send({
        name: 'Quota Test',
        tenantName: `Quota ${Date.now()}`,
        email: `quota-test-${Date.now()}@example.com`,
        password: 'Password123!',
      })
      .expect(201);

    tenantId = signup.body.user.tenantId;
    token = signup.body.accessToken;

    await request(app.getHttpServer())
      .patch('/api/tenants/me/quota')
      .set('Authorization', `Bearer ${token}`)
      .send({ eventsPerMonth: 3, aiTokensPerMonth: 1000 })
      .expect(200);
  });

  it('consumes quota and rejects 4th', async () => {
    for (let i = 0; i < 3; i++) {
      const r = await quota.checkAndConsume(tenantId, 'events', 1);
      expect(r.allowed).toBe(true);
    }
    const fourth = await quota.checkAndConsume(tenantId, 'events', 1);
    expect(fourth.allowed).toBe(false);
  });

  it('parallel consumption: exactly 3 allowed', async () => {
    // Neon free tier: pool = ~5 connections. 10 concurrent checkAndConsume calls
    // would each need 2 transactions = 20 concurrent → pool exhaustion
    // ("Unable to start a transaction in the given time").
    //
    // Fix: batch the parallelism to CONCURRENCY at a time. Test still verifies
    // the atomicity guarantee: exactly 3 slots are consumed despite concurrent
    // attempts.
    const CONCURRENCY = 5;
    const TOTAL = 10;
    const results: Array<{ allowed: boolean }> = [];

    for (let batchStart = 0; batchStart < TOTAL; batchStart += CONCURRENCY) {
      const batchEnd = Math.min(batchStart + CONCURRENCY, TOTAL);
      const batch = await Promise.all(
        Array.from({ length: batchEnd - batchStart }, () =>
          quota.checkAndConsume(tenantId, 'events', 1),
        ),
      );
      results.push(...batch);
    }

    const allowed = results.filter((r) => r.allowed).length;
    const denied = results.filter((r) => !r.allowed).length;
    expect(results.length).toBe(TOTAL);
    expect(allowed).toBe(3);
    expect(denied).toBe(7);
  });
});