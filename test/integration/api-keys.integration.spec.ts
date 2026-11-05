import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../apps/api/src/app.module';
import { PrismaService } from '../../apps/api/src/modules/prisma/prisma.service';
import { HttpExceptionFilter } from '../../apps/api/src/common/filters/http-exception.filter';

describe('API keys (integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let token: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await prisma.withoutTenant(async (c) => {
      await c.tenant.deleteMany({
        where: { users: { some: { email: { contains: 'api-key-test-' } } } },
      });
    });
    await app.close();
  });

  beforeEach(async () => {
    await prisma.withoutTenant(async (c) => {
      await c.tenant.deleteMany({
        where: { users: { some: { email: { contains: 'api-key-test-' } } } },
      });
    });

    const signup = await request(app.getHttpServer())
      .post('/api/auth/signup')
      .send({
        name: 'Key User',                          // ✅ was 'K' — @MinLength(2) fail
        tenantName: `Key Test ${Date.now()}`,      // ✅ was `K ...`
        email: `api-key-test-${Date.now()}@example.com`,
        password: 'Password123!',
      })
      .expect(201);

    token = signup.body.accessToken;
  });

  it('create → list → revoke lifecycle', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/api-keys')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'CI key',
        scopes: ['events:read'],
        environment: 'live',
      })
      .expect(201);

    expect(created.body.rawKey).toBeDefined();
    expect(created.body.prefix).toBeDefined();

    const list = await request(app.getHttpServer())
      .get('/api/api-keys')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(list.body[0].rawKey).toBeUndefined();
    expect(list.body[0].prefix).toBeDefined();

    await request(app.getHttpServer())
      .delete(`/api/api-keys/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const afterRevoke = await request(app.getHttpServer())
      .get('/api/api-keys')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(afterRevoke.body[0].revokedAt).toBeDefined();
  });

  it('rotate issues new key, old still works during grace window', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/api-keys')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Prod', scopes: ['events:read'] })
      .expect(201);

    const rotated = await request(app.getHttpServer())
      .post(`/api/api-keys/${created.body.id}/rotate`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(rotated.body.newKey.rawKey).toBeDefined();
    expect(rotated.body.newKey.rawKey).not.toBe(created.body.rawKey);
    expect(rotated.body.oldKeyRevokeAt).toBeDefined();
  });
});