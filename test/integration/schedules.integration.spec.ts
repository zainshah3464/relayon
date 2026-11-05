import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../apps/api/src/app.module';
import { PrismaService } from '../../apps/api/src/modules/prisma/prisma.service';
import { HttpExceptionFilter } from '../../apps/api/src/common/filters/http-exception.filter';

describe('Schedules (integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let token: string;
  let workflowId: string;

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
        where: { users: { some: { email: { contains: 'sched-test-' } } } },
      });
    });
    await app.close();
  });

  beforeEach(async () => {
    await prisma.withoutTenant(async (c) => {
      await c.tenant.deleteMany({
        where: { users: { some: { email: { contains: 'sched-test-' } } } },
      });
    });

    const signup = await request(app.getHttpServer())
      .post('/api/auth/signup')
      .send({
        name: 'Sched User',
        tenantName: `Sched Test ${Date.now()}`,
        email: `sched-test-${Date.now()}@example.com`,
        password: 'Password123!',
      })
      .expect(201);

    token = signup.body.accessToken;

    const wf = await request(app.getHttpServer())
      .post('/api/workflows')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Scheduled Flow',
        sourceType: 'generic',
        sourceConfig: { secret: 'test-secret' },
      })
      .expect(201);

    workflowId = wf.body.id;
  });

  it('upsert schedule → nextRunAt computed', async () => {
    const res = await request(app.getHttpServer())
      .put(`/api/workflows/${workflowId}/schedule`)
      .set('Authorization', `Bearer ${token}`)
      .send({ cronExpression: '0 9 * * *', timezone: 'UTC' })
      .expect(200);

    expect(res.body.cronExpression).toBe('0 9 * * *');
    expect(res.body.nextRunAt).toBeDefined();
    expect(new Date(res.body.nextRunAt).getTime()).toBeGreaterThan(Date.now());
  });

  it('rejects invalid cron expression', async () => {
    await request(app.getHttpServer())
      .put(`/api/workflows/${workflowId}/schedule`)
      .set('Authorization', `Bearer ${token}`)
      .send({ cronExpression: 'not-a-cron' })
      .expect(400);
  });

  it('bulk pause/resume affects all schedules', async () => {
    await request(app.getHttpServer())
      .put(`/api/workflows/${workflowId}/schedule`)
      .set('Authorization', `Bearer ${token}`)
      .send({ cronExpression: '*/15 * * * *' })
      .expect(200);

    const paused = await request(app.getHttpServer())
      .post('/api/schedules/bulk/pause-all')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(paused.body.updated).toBe(1);

    const sched = await request(app.getHttpServer())
      .get(`/api/workflows/${workflowId}/schedule`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(sched.body.isActive).toBe(false);

    await request(app.getHttpServer())
      .post('/api/schedules/bulk/resume-all')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const resumed = await request(app.getHttpServer())
      .get(`/api/workflows/${workflowId}/schedule`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(resumed.body.isActive).toBe(true);
    expect(new Date(resumed.body.nextRunAt).getTime()).toBeGreaterThan(Date.now());
  });

  it('bulk delete removes all schedules', async () => {
    await request(app.getHttpServer())
      .put(`/api/workflows/${workflowId}/schedule`)
      .set('Authorization', `Bearer ${token}`)
      .send({ cronExpression: '0 9 * * *' })
      .expect(200);

    const res = await request(app.getHttpServer())
      .post('/api/schedules/bulk/delete')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.deleted).toBe(1);

    // ⚠️ FIX — controller returns {} (not null) when no schedule exists
    await request(app.getHttpServer())
      .get(`/api/workflows/${workflowId}/schedule`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect((r) => {
        expect(r.body).toBeDefined();
        expect(r.body.id).toBeUndefined();
        expect(r.body.cronExpression).toBeUndefined();
        expect(r.body.isActive).toBeUndefined();
      });
  });

  it('cross-tenant isolation: other tenant cannot see schedule', async () => {
    await request(app.getHttpServer())
      .put(`/api/workflows/${workflowId}/schedule`)
      .set('Authorization', `Bearer ${token}`)
      .send({ cronExpression: '0 9 * * *' })
      .expect(200);

    const signupB = await request(app.getHttpServer())
      .post('/api/auth/signup')
      .send({
        name: 'Tenant B User',
        tenantName: `Tenant B ${Date.now()}`,
        email: `sched-test-b-${Date.now()}@example.com`,
        password: 'Password123!',
      })
      .expect(201);

    await request(app.getHttpServer())
      .get(`/api/workflows/${workflowId}/schedule`)
      .set('Authorization', `Bearer ${signupB.body.accessToken}`)
      .expect(404);
  });
});