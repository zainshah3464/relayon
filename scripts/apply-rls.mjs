#!/usr/bin/env node
import { execSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadEnv } from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = resolve(__dirname, '..');

// Load both env files (root)
loadEnv({ path: resolve(root, '.env') });
loadEnv({ path: resolve(root, '.env.test') });

const sqlPath = resolve(root, 'packages/db/prisma/rls/policies.sql');
const schemaPath = resolve(root, 'packages/db/prisma/schema.prisma');
const dbDir = resolve(root, 'packages/db');

// ⚠️ Prefer TEST_DATABASE_URL when set — that's what integration tests hit.
// For prod deploys, unset TEST_DATABASE_URL before running `npm run db:rls`.
const url = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;

if (!url) {
  console.error('❌ Neither TEST_DATABASE_URL nor DATABASE_URL is set');
  process.exit(1);
}

const isTest = url === process.env.TEST_DATABASE_URL;
const maskedUrl = url.replace(/:[^:@]*@/, ':****@').replace(/\/\/([^:]+):/, '//$1:');
console.log(`🔧 Applying RLS policies to ${isTest ? 'TEST' : 'PROD'} DB`);
console.log(`   ${maskedUrl.split('?')[0]}`);

try {
  execSync(
    `npx prisma db execute --file "${sqlPath}" --schema "${schemaPath}"`,
    {
      stdio: 'inherit',
      cwd: dbDir,
      env: { ...process.env, DATABASE_URL: url },
    },
  );
  console.log(`✅ RLS policies applied to ${isTest ? 'TEST' : 'PROD'} DB`);
} catch (err) {
  console.error('❌ RLS apply failed:', err.message);
  process.exit(1);
}