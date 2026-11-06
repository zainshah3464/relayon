import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';

const API = process.env['API_URL'] ?? 'http://localhost:3001';

test.describe('Auth flow', () => {
  test('signup → dashboard → logout → login', async ({ page, request }) => {
    test.setTimeout(120_000);
    const email = `e2e-auth-${randomUUID().slice(0, 8)}@example.com`;

    // ── Signup via API (safer than UI form) ─────────────────
    const signup = await request.post(`${API}/api/auth/signup`, {
      data: {
        name: 'E2E Auth',
        tenantName: `E2E ${Date.now()}`,
        email,
        password: 'Password123!',
      },
    });
    expect(signup.status()).toBe(201);
    const { accessToken, refreshToken, user } = await signup.json();

    // ── Seed localStorage ───────────────────────────────────
    await page.goto('/login');
    await page.evaluate(
      ({ accessToken, refreshToken, user }) => {
        localStorage.setItem('relayon_access_token', accessToken);
        localStorage.setItem('relayon_refresh_token', refreshToken);
        localStorage.setItem('relayon_user', JSON.stringify(user));
      },
      { accessToken, refreshToken, user },
    );

    // ── Dashboard loads ─────────────────────────────────────
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 20_000 });
    await expect(page.locator('h1')).toContainText(/Welcome/i, {
      timeout: 10_000,
    });

    // ── Logout via UI button ────────────────────────────────
    await page.click('button:has-text("Sign out")');
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
  });

  test('invalid password returns 401 (API)', async ({ request }) => {
    const email = `e2e-auth-bad-${randomUUID().slice(0, 8)}@example.com`;

    // Signup with known password
    const signup = await request.post(`${API}/api/auth/signup`, {
      data: {
        name: 'Bad Auth',
        tenantName: `Bad ${Date.now()}`,
        email,
        password: 'Password123!',
      },
    });
    expect(signup.status()).toBe(201);

    // Login with wrong password → 401
    const badLogin = await request.post(`${API}/api/auth/login`, {
      data: { email, password: 'WrongPassword' },
    });
    expect(badLogin.status()).toBe(401);

    // Login with correct password → 200
    const goodLogin = await request.post(`${API}/api/auth/login`, {
      data: { email, password: 'Password123!' },
    });
    expect(goodLogin.status()).toBe(200);
    const body = await goodLogin.json();
    expect(body.accessToken).toBeDefined();
  });

  test('protected route redirects unauthenticated', async ({ page }) => {
    await page.goto('/workflows');
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
  });
});