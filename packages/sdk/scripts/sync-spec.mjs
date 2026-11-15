#!/usr/bin/env node
import { writeFile } from 'node:fs/promises';

const API_URL = process.env.RELAYON_API_URL ?? 'http://localhost:3001';
const OUTPUT = new URL('../openapi.json', import.meta.url);

async function main() {
  console.log(`→ Fetching OpenAPI spec from ${API_URL}/api/openapi.json`);

  let res;
  try {
    res = await fetch(`${API_URL}/api/openapi.json`);
  } catch (err) {
    console.error(`❌ Could not reach API at ${API_URL}`);
    console.error(`   Start it with: npm run dev:api`);
    console.error(`   Error: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }

  if (!res.ok) {
    console.error(`❌ API returned ${res.status} ${res.statusText}`);
    console.error(`   Is DISABLE_OPENAPI=true set? Unset it and restart.`);
    process.exit(1);
  }

  const spec = await res.json();

  if (!spec.openapi || !spec.paths) {
    console.error('❌ Response is not a valid OpenAPI document');
    process.exit(1);
  }

  const pathCount = Object.keys(spec.paths).length;
  const schemaCount = Object.keys(spec.components?.schemas ?? {}).length;

  await writeFile(OUTPUT, JSON.stringify(spec, null, 2) + '\n', 'utf8');

  console.log(`✅ Spec saved to openapi.json`);
  console.log(`   OpenAPI: ${spec.openapi}`);
  console.log(`   Paths: ${pathCount}  ·  Schemas: ${schemaCount}`);
  console.log(`   Next: npm run generate`);
}

main().catch((err) => {
  console.error('❌ Sync failed:', err);
  process.exit(1);
});