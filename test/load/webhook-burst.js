import http from 'k6/http';
import { check } from 'k6';
import crypto from 'k6/crypto';
import { Rate } from 'k6/metrics';

const throttledRate = new Rate('throttled_429');

export const options = {
  scenarios: {
    burst: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '10s', target: 500 },
        { duration: '30s', target: 500 },
        { duration: '10s', target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<1000'],
    throttled_429: ['rate<0.5'],
  },
};

const INGRESS = __ENV.INGRESS_URL || 'http://localhost:3002';
const TENANT_ID = __ENV.TENANT_ID;
const WORKFLOW_ID = __ENV.WORKFLOW_ID;
const SECRET = __ENV.SECRET;

export function setup() {
  if (!TENANT_ID || !WORKFLOW_ID || !SECRET) {
    throw new Error('TENANT_ID, WORKFLOW_ID, SECRET required');
  }
}

export default function () {
  const body = JSON.stringify({ type: 'load.burst', ts: Date.now(), vu: __VU });
  const signature = crypto.hmac('sha256', SECRET, body, 'hex');

  const res = http.post(
    `${INGRESS}/webhook/${TENANT_ID}/${WORKFLOW_ID}`,
    body,
    {
      headers: {
        'Content-Type': 'application/json',
        'x-webhook-signature': signature,
        'x-event-id': `burst-${__VU}-${Date.now()}`,
      },
    },
  );

  throttledRate.add(res.status === 429);
  check(res, {
    '200/202/429': (r) => [200, 202, 429].includes(r.status),
  });
}