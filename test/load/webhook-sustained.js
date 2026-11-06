import http from 'k6/http';
import { check } from 'k6';
import crypto from 'k6/crypto';
import { Rate, Trend } from 'k6/metrics';

const failureRate = new Rate('failures');
const enqueueLatency = new Trend('enqueue_latency', true);

export const options = {
  scenarios: {
    sustained: {
      executor: 'ramping-arrival-rate',
      startRate: 10,
      timeUnit: '1s',
      preAllocatedVUs: 50,
      maxVUs: 200,
      stages: [
        { duration: '1m', target: 100 },
        { duration: '3m', target: 500 },
        { duration: '1m', target: 100 },
      ],
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<300', 'p(99)<800'],
    http_req_failed: ['rate<0.01'],
    failures: ['rate<0.02'],
    enqueue_latency: ['p(95)<200'],
  },
};

const INGRESS = __ENV.INGRESS_URL || 'http://localhost:3002';
const TENANT_ID = __ENV.TENANT_ID;
const WORKFLOW_ID = __ENV.WORKFLOW_ID;
const SECRET = __ENV.SECRET;

export function setup() {
  if (!TENANT_ID || !WORKFLOW_ID || !SECRET) {
    throw new Error('TENANT_ID, WORKFLOW_ID, SECRET env vars required');
  }
}

export default function () {
  const body = JSON.stringify({
    type: 'load.sustained',
    data: { amount: Math.floor(Math.random() * 100000), ts: Date.now() },
  });
  const signature = crypto.hmac('sha256', SECRET, body, 'hex');

  const res = http.post(
    `${INGRESS}/webhook/${TENANT_ID}/${WORKFLOW_ID}`,
    body,
    {
      headers: {
        'Content-Type': 'application/json',
        'x-webhook-signature': signature,
        'x-event-id': `load-s-${__VU}-${__ITER}-${Date.now()}`,
      },
      tags: { name: 'ingress' },
    },
  );

  enqueueLatency.add(res.timings.duration);

  const ok = check(res, {
    '202 or 200': (r) => r.status === 202 || r.status === 200,
    'has correlationId': (r) => {
      try { return JSON.parse(r.body).correlationId !== undefined; } catch { return false; }
    },
    'responds < 500ms': (r) => r.timings.duration < 500,
  });
  failureRate.add(!ok);
}