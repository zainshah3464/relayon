import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../apps/api/src/app.module';
import { PrismaService } from '../../apps/api/src/modules/prisma/prisma.service';
import { MongoService } from '../../apps/api/src/modules/mongo/mongo.service';
import { HttpExceptionFilter } from '../../apps/api/src/common/filters/http-exception.filter';

describe('Auth integration', () => {
  let app: INestApplication;
  let prisma: PrismaService;

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
  }, 60_000);

  afterAll(async () => {
    if (prisma) {
      await prisma.withoutTenant(async (c) => {
        await c.tenant.deleteMany({
          where: {
            OR: [
              { users: { some: { email: { contains: 'integration-test-' } } } },
              { slug: { startsWith: 'integration-test-' } },
            ],
          },
        });
      });
    }
    if (app) await app.close();
  });

  // ⚠️ CRITICAL — broader delete + unique names
  async function cleanTestTenants() {
    await prisma.withoutTenant(async (c) => {
      await c.tenant.deleteMany({
        where: {
          OR: [
            { users: { some: { email: { contains: 'integration-test-' } } } },
            { slug: { startsWith: 'integration-test-tenant' } },
            { slug: { startsWith: 'tenant-x' } },
          ],
        },
      });
    });
  }

  beforeEach(cleanTestTenants);

  it('signup → login → me flow', async () => {
    const email = `integration-test-${Date.now()}@example.com`;
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const signup = await request(app.getHttpServer())
      .post('/api/auth/signup')
      .send({
        name: 'Test User',
        tenantName: `Integration Test Tenant ${suffix}`, // ← unique
        email,
        password: 'Password123!',
      })
      .expect(201);

    expect(signup.body.accessToken).toBeDefined();
    expect(signup.body.user.email).toBe(email);
    expect(signup.body.user.role).toBe('owner');

    const me = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${signup.body.accessToken}`)
      .expect(200);
    expect(me.body.email).toBe(email);
  });

  it('rejects duplicate email', async () => {
    const email = `integration-test-dup-${Date.now()}@example.com`;
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const payload = {
      name: 'Duplicate Test User', // ← CHANGED: was 'X' (1 char, invalid)
      tenantName: `Tenant X ${suffix}`, // ← unique
      email,
      password: 'Password123!',
    };
    await request(app.getHttpServer()).post('/api/auth/signup').send(payload).expect(201);
    await request(app.getHttpServer()).post('/api/auth/signup').send(payload).expect(409);
  });

  it('rejects unauthenticated /me', async () => {
    await request(app.getHttpServer()).get('/api/auth/me').expect(401);
  });
});