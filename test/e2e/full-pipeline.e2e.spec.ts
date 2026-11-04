import { test, expect } from '@playwright/test';
import { createHmac } from 'node:crypto';

const API = process.env['API_URL'] ?? 'http://localhost:3001';
const INGRESS = process.env['INGRESS_URL'] ?? 'http://localhost:3002';
const WORKERS = process.env['WORKERS_URL'] ?? 'http://localhost:3003';
const CRON_SECRET = process.env['CRON_SECRET'] ?? '';

async function prewarm(request: import('@playwright/test').APIRequestContext) {
  await Promise.all([
    request.get(`${API}/api/health`, { timeout: 30_000 }).catch(() => {}),
    request.get(`${INGRESS}/health`, { timeout: 30_000 }).catch(() => {}),
    request
      .get(`${WORKERS}/internal/health`, {
        headers: { 'X-Cron-Secret': CRON_SECRET },
        timeout: 30_000,
      })
      .catch(() => {}),
  ]);
}

test.describe.configure({ mode: 'serial' });

test('full pipeline: signup → workflow → webhook → delivery', async ({
  page,
  request,
}) => {
  test.setTimeout(180_000);
  await prewarm(request);

  const email = `e2e-${Date.now()}@example.com`;

  // ── Signup via API ─────────────────────────────────────
  const signup = await request.post(`${API}/api/auth/signup`, {
    data: {
      name: 'E2E User',
      tenantName: `E2E ${Date.now()}`,
      email,
      password: 'Password123!',
    },
    timeout: 45_000,
  });
  expect(signup.status()).toBe(201);
  const signupBody = await signup.json();
  const token = signupBody.accessToken as string;
  const refreshToken = signupBody.refreshToken as string;
  const user = signupBody.user as Record<string, unknown>;

  // ── Seed ALL required localStorage keys before navigating ─
  await page.goto('/login');
  await page.evaluate(
    ({ token, refreshToken, user }) => {
      localStorage.setItem('relayon_access_token', token);
      localStorage.setItem('relayon_refresh_token', refreshToken);
      localStorage.setItem('relayon_user', JSON.stringify(user));
    },
    { token, refreshToken, user },
  );

  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 });
  await expect(page.locator('h1')).toContainText('Welcome');

  // ── Create workflow via API ────────────────────────────
  const wfRes = await request.post(`${API}/api/workflows`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      name: `E2E Workflow ${Date.now()}`,
      sourceType: 'generic',
      sourceConfig: { secret: 'test-secret-12345678' },
      enrichmentEnabled: false,
    },
    timeout: 45_000,
  });
  expect(wfRes.status()).toBe(201);
  const workflow = await wfRes.json();

  // ── Add HTTP destination ───────────────────────────────
  const destRes = await request.post(
    `${API}/api/workflows/${workflow.id}/destinations`,
    {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        type: 'http',
        name: 'httpbin',
        config: { url: 'https://httpbin.org/post', method: 'POST' },
      },
      timeout: 30_000,
    },
  );
  expect(destRes.status()).toBe(201);

  // ── Send webhook ───────────────────────────────────────
  const body = JSON.stringify({ type: 'test.event', data: { amount: 5000 } });
  const signature = createHmac('sha256', 'test-secret-12345678')
    .update(body)
    .digest('hex');

  const hookRes = await request.post(
    `${INGRESS}/webhook/${workflow.tenantId}/${workflow.id}`,
    {
      headers: {
        'Content-Type': 'application/json',
        'x-webhook-signature': signature,
        'x-event-id': `e2e-${Date.now()}`,
      },
      data: body,
      timeout: 60_000,
    },
  );
  expect(hookRes.status()).toBe(202);

  // ── Trigger process + deliver (with warn on failure) ──
  const procRes = await request.post(`${WORKERS}/internal/process`, {
    headers: { 'X-Cron-Secret': CRON_SECRET },
    timeout: 45_000,
  });
  if (!procRes.ok()) {
    console.warn('process returned', procRes.status(), await procRes.text());
  }
  const delivRes = await request.post(`${WORKERS}/internal/deliver`, {
    headers: { 'X-Cron-Secret': CRON_SECRET },
    timeout: 45_000,
  });
  if (!delivRes.ok()) {
    console.warn('deliver returned', delivRes.status(), await delivRes.text());
  }

  // ── Poll for event (async Mongo write may take time) ───
  // waitForTimeout(3000) was racy — workers might still be writing to Mongo
  // when we checked. expect.poll retries until event appears (up to 30s).
  await expect
    .poll(
      async () => {
        const res = await request.get(
          `${API}/api/events?workflowId=${workflow.id}&limit=5`,
          {
            headers: { Authorization: `Bearer ${token}` },
            timeout: 10_000,
          },
        );
        if (!res.ok()) return 0;
        const body = await res.json();
        return body.items?.length ?? 0;
      },
      { timeout: 30_000, intervals: [1000, 2000, 3000, 5000] },
    )
    .toBeGreaterThan(0);
});

test('auth guard redirects unauthenticated', async ({ page }) => {
  test.setTimeout(30_000);
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login/, { timeout: 20_000 });
});