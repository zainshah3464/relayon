import { config as loadEnv } from 'dotenv';
import { resolve } from 'path';
import { z } from 'zod';

// Load .env.local explicitly — tsx does NOT auto-load env files.
// Path resolves to apps/ingress/.env.local in both dev (src/) and
// prod (dist/) because of the '../' relative step.
loadEnv({ path: resolve(__dirname, '../.env.local') });

const EnvSchema = z.object({
 NODE_ENV: z
  .string()
  .transform((v) => v.trim())
  .pipe(z.enum(['development', 'production', 'test']))
  .default('development'),
  INGRESS_PORT: z.coerce.number().int().positive().default(3002),
  CORS_ORIGIN: z.string().default('http://localhost:4200'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  UPSTASH_REDIS_TCP_URL: z
    .string()
    .regex(
      /^rediss?:\/\//,
      'UPSTASH_REDIS_TCP_URL must start with redis:// or rediss://',
    ),
  IP_HASH_SALT: z.string().min(8, 'IP_HASH_SALT must be at least 8 characters'),
  WEBHOOK_SIGNATURE_TOLERANCE_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .default(300),
});

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment configuration:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = parsed.data;
export type Config = typeof config;