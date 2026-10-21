#!/usr/bin/env node
import { createHmac, randomBytes } from 'node:crypto';

const API = process.env.API_URL ?? 'https://relayon-api.vercel.app';
const INGRESS =
  process.env.INGRESS_URL ?? 'https://relayon-ingress.vercel.app';
const WORKERS =
  process.env.WORKERS_URL ?? 'https://relayon-workers.vercel.app';
const CRON_SECRET = process.env.CRON_SECRET;

if (!CRON_SECRET) {
  console.error('❌ CRON_SECRET environment variable required');
  process.exit(1);
}

const results = [];

function record(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ` — ${detail}` : ''}`);
}

async function req(url, opts = {}) {
  const res = await fetch(url, opts);
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { status: res.status, body };
}

function summary() {
  const failed = results.filter((r) => !r.ok).length;
  const passed = results.length - failed;
  console.log(
    `\n${failed === 0 ? '🟢 SMOKE PASS' : '🔴 SMOKE FAIL'} — ${passed}/${results.length} checks passed`,
  );
  process.exit(failed === 0 ? 0 : 1);
}

(async () => {
  console.log(`\n🔎 Relayon smoke test`);
  console.log(`   API:     ${API}`);
  console.log(`   Ingress: ${INGRESS}`);
  console.log(`   Workers: ${WORKERS}\n`);

  const apiHealth = await req(`${API}/api/health`);
  record(
    'API health',
    apiHealth.status === 200 && apiHealth.body?.status === 'ok',
    JSON.stringify(apiHealth.body),
  );

  const ingHealth = await req(`${INGRESS}/health`);
  record('Ingress health', ingHealth.status === 200, JSON.stringify(ingHealth.body));

  const wkHealth = await req(`${WORKERS}/internal/health`, {
    headers: { 'X-Cron-Secret': CRON_SECRET },
  });
  record(
    'Workers health',
    wkHealth.status === 200 && wkHealth.body?.status === 'ok',
    JSON.stringify(wkHealth.body),
  );

  const email = `smoke-${Date.now()}-${randomBytes(3).toString('hex')}@example.com`;
  const signup = await req(`${API}/api/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Smoke Test',
      tenantName: `Smoke ${Date.now()}`,
      email,
      password: 'SmokePass123!',
    }),
  });

  if (signup.status >= 400) {
    record('Signup', false, JSON.stringify(signup.body).slice(0, 300));
    summary();
    return;
  }
  record('Signup', true);

  const token = signup.body.accessToken;
  const tenantId = signup.body.user.tenantId;

  const secret = randomBytes(16).toString('hex');
  const workflow = await req(`${API}/api/workflows`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      name: 'Smoke workflow',
      sourceType: 'generic',
      sourceConfig: { secret },
      enrichmentEnabled: false,
    }),
  });

  record(
    'Create workflow',
    workflow.status === 200 || workflow.status === 201,
    JSON.stringify(workflow.body).slice(0, 200),
  );
  if (workflow.status >= 400) {
    summary();
    return;
  }
  const workflowId = workflow.body.id;

  const destination = await req(
    `${API}/api/workflows/${workflowId}/destinations`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        type: 'http',
        name: 'Smoke HTTP',
        config: {
          url: 'https://httpbin.org/post',
          method: 'POST',
        },
      }),
    },
  );
  record(
    'Create destination',
    destination.status === 200 || destination.status === 201,
  );

  const payload = JSON.stringify({
    event: 'smoke.test',
    ts: Date.now(),
  });
  const signature = createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  const hook = await req(
    `${INGRESS}/webhook/${tenantId}/${workflowId}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-webhook-signature': signature,
        'x-event-id': `smoke-${Date.now()}`,
      },
      body: payload,
    },
  );
  record(
    'Send webhook',
    hook.status === 202,
    JSON.stringify(hook.body),
  );

  const processBatch = await req(`${WORKERS}/internal/process`, {
    method: 'POST',
    headers: { 'X-Cron-Secret': CRON_SECRET },
  });
  record(
    'Process batch',
    processBatch.status === 200,
    JSON.stringify(processBatch.body),
  );

  const deliverBatch = await req(`${WORKERS}/internal/deliver`, {
    method: 'POST',
    headers: { 'X-Cron-Secret': CRON_SECRET },
  });
  record(
    'Deliver batch',
    deliverBatch.status === 200,
    JSON.stringify(deliverBatch.body),
  );

  await new Promise((resolve) => setTimeout(resolve, 1500));

  const events = await req(
    `${API}/api/events?workflowId=${workflowId}&limit=5`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  const count = events.body?.items?.length ?? 0;
  record('Event visible in API', events.status === 200 && count > 0, `count=${count}`);

  const analytics = await req(`${API}/api/analytics/overview`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  record(
    'Analytics endpoint',
    analytics.status === 200,
    JSON.stringify(analytics.body).slice(0, 200),
  );

  summary();
})().catch((err) => {
  console.error('❌ Smoke test crashed:', err);
  process.exit(1);
});