import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';

const API = process.env['API_URL'] ?? 'http://localhost:3001';

test.describe('Tenant isolation (E2E)', () => {
  test('user B cannot access user A workflows', async ({ request }) => {
    test.setTimeout(90_000);

    // Tenant A
    const signupA = await request.post(`${API}/api/auth/signup`, {
      data: {
        name: 'Isolation A',
        tenantName: `A ${Date.now()}`,
        email: `iso-a-${randomUUID().slice(0, 8)}@example.com`,
        password: 'Password123!',
      },
    });
    expect(signupA.status()).toBe(201);
    const { accessToken: tokenA } = await signupA.json();

    const wfA = await request.post(`${API}/api/workflows`, {
      headers: { Authorization: `Bearer ${tokenA}` },
      data: {
        name: 'A Private',
        sourceType: 'stripe',
        sourceConfig: { secret: 'whsec_a12345' },
      },
    });
    expect(wfA.status()).toBe(201);
    const workflowA = await wfA.json();

    // Tenant B
    const signupB = await request.post(`${API}/api/auth/signup`, {
      data: {
        name: 'Isolation B',
        tenantName: `B ${Date.now()}`,
        email: `iso-b-${randomUUID().slice(0, 8)}@example.com`,
        password: 'Password123!',
      },
    });
    const { accessToken: tokenB } = await signupB.json();

    // B cannot GET A's workflow
    const getRes = await request.get(`${API}/api/workflows/${workflowA.id}`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    expect(getRes.status()).toBe(404);

    // B cannot PATCH A's workflow
    const patchRes = await request.patch(`${API}/api/workflows/${workflowA.id}`, {
      headers: { Authorization: `Bearer ${tokenB}` },
      data: { name: 'Hijacked' },
    });
    expect(patchRes.status()).toBe(404);

    // B cannot DELETE A's workflow
    const deleteRes = await request.delete(`${API}/api/workflows/${workflowA.id}`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    expect(deleteRes.status()).toBe(404);

    // B's list does NOT contain A's workflow
    const listRes = await request.get(`${API}/api/workflows`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    const list = await listRes.json();
    expect(list.find((w: { id: string }) => w.id === workflowA.id)).toBeUndefined();
  });

  test('cross-tenant API key rejection', async ({ request }) => {
    test.setTimeout(90_000);

    const signupA = await request.post(`${API}/api/auth/signup`, {
      data: {
        name: 'Key A',
        tenantName: `KeyA ${Date.now()}`,
        email: `iso-key-a-${randomUUID().slice(0, 8)}@example.com`,
        password: 'Password123!',
      },
    });
    const { accessToken: tokenA } = await signupA.json();

    const keyRes = await request.post(`${API}/api/api-keys`, {
      headers: { Authorization: `Bearer ${tokenA}` },
      data: { name: 'A Key', scopes: ['events:read'] },
    });
    expect(keyRes.status()).toBe(201);
    const { rawKey } = await keyRes.json();

    const signupB = await request.post(`${API}/api/auth/signup`, {
      data: {
        name: 'Key B',
        tenantName: `KeyB ${Date.now()}`,
        email: `iso-key-b-${randomUUID().slice(0, 8)}@example.com`,
        password: 'Password123!',
      },
    });
    const { accessToken: tokenB } = await signupB.json();

    const listRes = await request.get(`${API}/api/api-keys`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    const keys = await listRes.json();
    expect(keys.length).toBe(0);
    expect(JSON.stringify(keys)).not.toContain(rawKey);
  });
});