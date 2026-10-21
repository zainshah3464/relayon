import { z } from 'zod';

export const EnvSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  WORKERS_PORT: z.coerce.number().int().positive().default(3003),

  DATABASE_URL: z.string().min(1),
  MONGODB_URI: z.string().min(1).regex(/^mongodb(\+srv)?:\/\//, 'MONGODB_URI must start with mongodb:// or mongodb+srv://'),
  MONGODB_DB_NAME: z.string().min(1).default('relayon'),

  UPSTASH_REDIS_TCP_URL: z
    .string()
    .regex(/^rediss?:\/\//, 'UPSTASH_REDIS_TCP_URL must start with rediss://'),

  GROQ_API_KEY: z.string().min(1),
  GROQ_MODEL: z.string().default('llama-3.3-70b-versatile'),
  GROQ_MAX_TOKENS: z.coerce.number().int().positive().default(1024),
  GROQ_TEMPERATURE: z.coerce.number().min(0).max(2).default(0.2),

  BATCH_SIZE: z.coerce.number().int().positive().max(50).default(5),
  TIME_BUDGET_MS: z.coerce.number().int().positive().default(8000),

  CRON_SECRET: z.string().min(16),
});

export type Env = z.infer<typeof EnvSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  const parsed = EnvSchema.safeParse(config);
  if (!parsed.success) {
    const errs = parsed.error.flatten().fieldErrors;
    throw new Error(`Invalid environment configuration:\n${JSON.stringify(errs, null, 2)}`);
  }
  return parsed.data;
}