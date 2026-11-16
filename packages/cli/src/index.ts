#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import { listenCommand } from './commands/listen.js';

const program = new Command();

program
  .name('relayon')
  .description('Relayon CLI — forward webhooks to your localhost')
  .version('3.1.0');

program
  .command('listen')
  .description('Create a tunnel and forward incoming webhooks to localhost')
  .requiredOption('-p, --port <port>', 'Local port to forward to', '3000')
  .option(
    '-k, --api-key <key>',
    'Relayon API key (or set RELAYON_API_KEY env)',
    process.env['RELAYON_API_KEY'] ?? '',
  )
  .option(
    '-t, --token <jwt>',
    'Relayon JWT (alternative to --api-key)',
    process.env['RELAYON_TOKEN'] ?? '',
  )
  .option('-l, --label <label>', 'Label for this tunnel (reuses URL across restarts)', '')
  .option(
    '-u, --api-url <url>',
    'Relayon API base URL',
    process.env['RELAYON_API_URL'] ?? 'https://relayon-api.vercel.app',
  )
  .option('-P, --path <path>', 'Local path to forward to (default: keep incoming path)', '')
  .action(listenCommand);

program.parseAsync(process.argv).catch((err) => {
  console.error(
    chalk.red('✖'),
    err instanceof Error ? err.message : String(err),
  );
  process.exit(1);
});