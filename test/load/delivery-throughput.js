import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate } from 'k6/metrics';

const processingLatency = new Trend('processing_latency', true);
const dlqRate = new Rate('dlq_rate');

export const options = {
  scenarios: {
    delivery: {
      executor: 'shared-iterations',
      vus: 1,
      iterations: 20,
      maxDuration: '10m',
    },
  },
  thresholds: {
    processing_latency: ['p(95)<10000'],
    dlq_rate: ['rate<0.1'],
  },
};

const WORKERS = __ENV.WORKERS_URL || 'http://localhost:3003';
const CRON_SECRET = __ENV.CRON_SECRET;

export function setup() {
  if (!CRON_SECRET) throw new Error('CRON_SECRET required');
}

export default function () {
  const res = http.post(
    `${WORKERS}/internal/process`,
    {},
    { headers: { 'X-Cron-Secret': CRON_SECRET } },
  );
  processingLatency.add(res.timings.duration);

  const ok = check(res, {
    'process returns 200': (r) => r.status === 200,
    'has result body': (r) => {
      try { return typeof JSON.parse(r.body).processed === 'number'; } catch { return false; }
    },
  });

  if (ok) {
    const body = JSON.parse(res.body);
    dlqRate.add((body.failed ?? 0) / Math.max(body.processed ?? 1, 1));
  }

  http.post(
    `${WORKERS}/internal/deliver`,
    {},
    { headers: { 'X-Cron-Secret': CRON_SECRET } },
  );

  sleep(1);
}