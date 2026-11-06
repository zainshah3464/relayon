import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';

const API = process.env['API_URL'] ?? 'http://localhost:3001';

test.describe('Quota UI', () => {
  test('dashboard shows usage bars', async ({ page, request }) => {
    test.setTimeout(120_000);
    const email = `e2e-quota-${randomUUID().slice(0, 8)}@example.com`;

    const signup = await request.post(`${API}/api/auth/signup`, {
      data: {
        name: 'Quota UI',
        tenantName: `Q ${Date.now()}`,
        email,
        password: 'Password123!',
      },
    });
    expect(signup.status()).toBe(201);
    const { accessToken, refreshToken, user } = await signup.json();

    await page.goto('/login');
    await page.evaluate(
      ({ accessToken, refreshToken, user }) => {
        localStorage.setItem('relayon_access_token', accessToken);
        localStorage.setItem('relayon_refresh_token', refreshToken);
        localStorage.setItem('relayon_user', JSON.stringify(user));
      },
      { accessToken, refreshToken, user },
    );

    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 20_000 });

    // Monthly usage section visible (case-insensitive match)
    await expect(
      page.locator('text=/Monthly usage|Usage/i').first(),
    ).toBeVisible({ timeout: 15_000 });
  });

  test('analytics page shows usage card', async ({ page, request }) => {
    test.setTimeout(120_000);
    const email = `e2e-analytics-${randomUUID().slice(0, 8)}@example.com`;

    const signup = await request.post(`${API}/api/auth/signup`, {
      data: {
        name: 'Analytics UI',
        tenantName: `A ${Date.now()}`,
        email,
        password: 'Password123!',
      },
    });
    expect(signup.status()).toBe(201);
    const { accessToken, refreshToken, user } = await signup.json();

    await page.goto('/login');
    await page.evaluate(
      ({ accessToken, refreshToken, user }) => {
        localStorage.setItem('relayon_access_token', accessToken);
        localStorage.setItem('relayon_refresh_token', refreshToken);
        localStorage.setItem('relayon_user', JSON.stringify(user));
      },
      { accessToken, refreshToken, user },
    );

    // Navigate directly (avoid sidebar link dependency)
    await page.goto('/analytics');
    await expect(page).toHaveURL(/\/analytics$/, { timeout: 20_000 });

    // Events card visible
    await expect(
      page.locator('text=/Events/i').first(),
    ).toBeVisible({ timeout: 15_000 });
  });
});