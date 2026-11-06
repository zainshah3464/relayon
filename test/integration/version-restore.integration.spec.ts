import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../apps/api/src/app.module';
import { PrismaService } from '../../apps/api/src/modules/prisma/prisma.service';
import { MongoService } from '../../apps/api/src/modules/mongo/mongo.service';
import { HttpExceptionFilter } from '../../apps/api/src/common/filters/http-exception.filter';

describe('Version restore (integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let token: string;

  beforeAll(async () => {
    // ⚠️ MongoService override — version-restore doesn't need Mongo,
    // but AppModule.onModuleInit would otherwise connect + fail.
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
          where: { users: { some: { email: { contains: 'ver-restore-' } } } },
        });
      });
    }
    if (app) await app.close();
  });

  beforeEach(async () => {
    await prisma.withoutTenant(async (c) => {
      await c.tenant.deleteMany({
        where: { users: { some: { email: { contains: 'ver-restore-' } } } },
      });
    });

    const signup = await request(app.getHttpServer())
      .post('/api/auth/signup')
      .send({
        name: 'Version User',
        tenantName: `Version Test ${Date.now()}`,
        email: `ver-restore-${Date.now()}@example.com`,
        password: 'Password123!',
      })
      .expect(201);

    token = signup.body.accessToken;
  });

  it('restore replaces destinations and creates new version', async () => {
    const wf = await request(app.getHttpServer())
      .post('/api/workflows')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Original Name', sourceType: 'stripe', sourceConfig: { secret: 'whsec_x' } })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/workflows/${wf.body.id}/destinations`)
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'http', name: 'Dest-A', config: { url: 'https://a.com' } })
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/api/workflows/${wf.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Updated Name' })
      .expect(200);

    const versions = await request(app.getHttpServer())
      .get(`/api/workflows/${wf.body.id}/versions`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(versions.body.length).toBe(2);

    const restored = await request(app.getHttpServer())
      .post(`/api/workflows/${wf.body.id}/versions/1/restore`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(restored.body.name).toBe('Original Name');
    expect(restored.body.destinations).toEqual([]);

    const versionsAfter = await request(app.getHttpServer())
      .get(`/api/workflows/${wf.body.id}/versions`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(versionsAfter.body.length).toBe(3);
    expect(versionsAfter.body[0].message).toContain('Restored');
  });

  it('diff returns identical for same version', async () => {
    const wf = await request(app.getHttpServer())
      .post('/api/workflows')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Test Workflow X', sourceType: 'stripe', sourceConfig: { secret: 's' } })
      .expect(201);

    const diff = await request(app.getHttpServer())
      .get(`/api/workflows/${wf.body.id}/versions/1/diff/1`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(diff.body.identical).toBe(true);
  });

  it('diff returns changes for different versions', async () => {
    const wf = await request(app.getHttpServer())
      .post('/api/workflows')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Original', sourceType: 'stripe', sourceConfig: { secret: 's' } })
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/api/workflows/${wf.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Renamed' })
      .expect(200);

    const diff = await request(app.getHttpServer())
      .get(`/api/workflows/${wf.body.id}/versions/1/diff/2`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(diff.body.identical).toBe(false);
    expect(diff.body.stats.added).toBeGreaterThan(0);
    expect(diff.body.stats.removed).toBeGreaterThan(0);
    expect(diff.body.structured.split.length).toBeGreaterThan(0);
  });
});