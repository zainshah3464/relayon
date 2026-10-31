#!/usr/bin/env node
import { execSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = resolve(__dirname, '..');

const sqlPath = resolve(root, 'packages/db/prisma/rls/policies.sql');
const schemaPath = resolve(root, 'packages/db/prisma/schema.prisma');
const dbDir = resolve(root, 'packages/db');   // ← .env yahan hai

execSync(
  `npx prisma db execute --file "${sqlPath}" --schema "${schemaPath}"`,
  {
    stdio: 'inherit',
    cwd: dbDir,   // ← root se packages/db
    env: process.env,
  },
);

console.log('✅ RLS policies applied');