import http from 'k6/http';
import { check, sleep } from 'k6';
import crypto from 'k6/crypto';
import { Rate } from 'k6/metrics';

const failureRate = new Rate('failures');

export const options = {
  scenarios: {
    sustained: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 10 },
        { duration: '3m', target: 50 },
        { duration: '30s', target: 100 },
        { duration: '30s', target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<300', 'p(99)<800'],
    http_req_failed: ['rate<0.01'],
    failures: ['rate<0.02'],
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
    type: 'load.test',
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
        'x-event-id': `load-${__VU}-${__ITER}-${Date.now()}`,
      },
      tags: { name: 'ingress' },
    },
  );

  const ok = check(res, {
    'status 202': (r) => r.status === 202,
    'fast enough': (r) => r.timings.duration < 500,
  });
  failureRate.add(!ok);
  sleep(0.1);
}