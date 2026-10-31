#!/usr/bin/env node
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import yaml from 'js-yaml';

const API = process.env.RELAYON_API_URL;
const TOKEN = process.env.RELAYON_API_TOKEN;
const DIR = process.env.RELAYON_WORKFLOWS_DIR ?? './workflows';

function die(msg) {
  console.error(`❌ ${msg}`);
  process.exit(1);
}

function assertEnv(needToken) {
  if (!API) die('RELAYON_API_URL is required');
  if (needToken && !TOKEN) die('RELAYON_API_TOKEN is required');
}

async function listYamlFiles() {
  try {
    const entries = await readdir(DIR);
    return entries.filter((f) => f.endsWith('.yaml') || f.endsWith('.yml'));
  } catch {
    return [];
  }
}

async function pull() {
  assertEnv(true);
  const res = await fetch(`${API}/api/workflows/export-all`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  if (!res.ok) die(`Export failed: ${res.status} ${await res.text()}`);

  const { workflows } = await res.json();
  await mkdir(DIR, { recursive: true });

  for (const wf of workflows) {
    await writeFile(join(DIR, wf.filename), wf.yaml, 'utf8');
    console.log(`  ⬇ ${wf.filename}`);
  }
  console.log(`✅ Pulled ${workflows.length} workflow(s)`);
}

async function validate() {
  const files = await listYamlFiles();
  if (files.length === 0) {
    console.log('No workflow YAML files found — nothing to validate');
    return;
  }

  let failures = 0;
  for (const file of files) {
    const path = join(DIR, file);
    const content = await readFile(path, 'utf8');

    let doc;
    try {
      doc = yaml.load(content);
    } catch (err) {
      console.error(`❌ ${file}: invalid YAML — ${err.message}`);
      failures++;
      continue;
    }

    const errors = [];

    if (!doc || typeof doc !== 'object') {
      errors.push('document must be an object');
    } else {
      if (doc.apiVersion !== 'relayon/v1')
        errors.push(`apiVersion must be "relayon/v1", got "${doc.apiVersion}"`);
      if (doc.kind !== 'Workflow')
        errors.push(`kind must be "Workflow", got "${doc.kind}"`);
      if (!doc.metadata?.name) errors.push('metadata.name is required');
      if (!doc.spec?.sourceType) errors.push('spec.sourceType is required');
      if (doc.spec?.destinations && !Array.isArray(doc.spec.destinations)) {
        errors.push('spec.destinations must be an array');
      }

      const placeholders = [];
      const walk = (v, path) => {
        if (typeof v === 'string' && v.startsWith('${')) placeholders.push(path);
        else if (v && typeof v === 'object') {
          for (const [k, val] of Object.entries(v)) walk(val, `${path}.${k}`);
        }
      };
      walk(doc, '');
      if (placeholders.length > 0) {
        errors.push(`unresolved placeholders: ${placeholders.join(', ')}`);
      }
    }

    if (errors.length > 0) {
      console.error(`❌ ${file}:`);
      for (const e of errors) console.error(`   · ${e}`);
      failures++;
    } else {
      console.log(`✓ ${file}`);
    }
  }

  if (failures > 0) die(`${failures} file(s) failed validation`);
  console.log(`✅ ${files.length} workflow(s) validated`);
}

async function push() {
  assertEnv(true);
  const files = await listYamlFiles();
  if (files.length === 0) {
    console.log('No workflow YAML files found');
    return;
  }

  let failures = 0;
  for (const file of files) {
    const content = await readFile(join(DIR, file), 'utf8');
    const res = await fetch(`${API}/api/workflows/import`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ yaml: content, mode: 'upsert' }),
    });

    if (res.ok) {
      const body = await res.json();
      console.log(
        `  ✓ ${file} → ${body.id.slice(0, 8)} (${body.updated ? 'updated' : 'created'})`,
      );
    } else {
      console.error(`  ❌ ${file}: ${res.status} ${await res.text()}`);
      failures++;
    }
  }

  if (failures > 0) die(`${failures} file(s) failed to push`);
  console.log(`✅ Pushed ${files.length} workflow(s)`);
}

const cmd = process.argv[2];

switch (cmd) {
  case 'pull':
    await pull();
    break;
  case 'validate':
    await validate();
    break;
  case 'push':
    await push();
    break;
  default:
    console.error('Usage: relayon-sync.mjs <pull|validate|push>');
    process.exit(1);
}