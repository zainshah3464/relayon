import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

// Load .env.test from project root (overridable by real env vars)
const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../../.env.test') });

process.env['NODE_ENV'] = 'test';

// Fail loudly if TEST_DATABASE_URL points at a production endpoint
const testDbUrl = process.env['TEST_DATABASE_URL'];
if (!testDbUrl) {
  throw new Error(
    'TEST_DATABASE_URL is required. Create .env.test (gitignored) with your dedicated test DB.',
  );
}

process.env['DATABASE_URL'] = testDbUrl;
process.env['UPSTASH_REDIS_TCP_URL'] =
  process.env['TEST_REDIS_URL'] ?? 'redis://localhost:6379';
process.env['MONGODB_URI'] =
  process.env['TEST_MONGODB_URI'] ?? 'mongodb://localhost:27017/relayon_ci';
process.env['MONGODB_DB_NAME'] = 'relayon_ci';

process.env['JWT_SECRET'] = 'test-jwt-secret-min-32-chars-long-xx';
process.env['JWT_REFRESH_SECRET'] = 'test-refresh-secret-min-32-char-xx';
process.env['JWT_EXPIRES_IN'] = '15m';
process.env['JWT_REFRESH_EXPIRES_IN'] = '7d';
process.env['CRON_SECRET'] = 'test-cron-secret-min-32-chars-xxxxx';
process.env['IP_HASH_SALT'] = 'test-salt-min-16-chars';
process.env['WEBHOOK_SIGNATURE_TOLERANCE_SECONDS'] = '300';
process.env['CONNECTOR_ENCRYPTION_KEYS'] =
  'test-kid:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
process.env['GROQ_API_KEY'] = 'gsk_test_key';
process.env['GROQ_MODEL'] = 'llama-3.3-70b-versatile';
process.env['GROQ_TIMEOUT_MS'] = '5000';
process.env['BATCH_SIZE'] = '5';
process.env['TIME_BUDGET_MS'] = '8000';
process.env['API_KEY_PEPPER'] = 'test-pepper-min-32-chars-long-xxxx';
process.env['INTERNAL_SECRET'] = 'test-internal-secret-min-32-char-x';

// For test-run endpoint in webhook-flow integration test.
// Points to a locally running workers instance. If workers isn't running,
// the test gracefully degrades to schema-only mode (which is what's happening now).
process.env['WORKERS_URL'] = process.env['WORKERS_URL'] ?? 'http://localhost:3003';