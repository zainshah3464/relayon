import chalk from 'chalk';
import ora from 'ora';
import { createSseClient } from '../lib/sse-client.js';
import { forwardWebhook } from '../lib/forwarder.js';

export interface ListenOptions {
  port: string;
  apiKey: string;
  token: string;
  label: string;
  apiUrl: string;
  path: string;
}

interface TunnelSession {
  sessionId: string;
  url: string;
  targetPort: number;
  label: string | null;
  expiresAt: string;
}

interface CapturedWebhook {
  id: string;
  receivedAt: string;
  method: string;
  path: string;
  headers: Record<string, string>;
  body: string;
  contentType: string;
  sizeBytes: number;
}

export async function listenCommand(opts: ListenOptions): Promise<void> {
  const port = Number(opts.port);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid port: ${opts.port}`);
  }
  if (!opts.apiKey && !opts.token) {
    throw new Error(
      'Missing credentials. Pass --api-key (or set RELAYON_API_KEY), or --token (or set RELAYON_TOKEN).\n' +
        `Get one at Settings → API Keys in your Relayon dashboard.`,
    );
  }

  // ⚠️ v3.7 — proprietary license notice at the start of every listen session
  console.log('');
  console.log(chalk.gray('  © 2026 Zain Shah · Relayon Proprietary License'));
  console.log(chalk.gray('  relayon.vercel.app/license\n'));

  const authHeaders: Record<string, string> = {};
  if (opts.apiKey) authHeaders['X-API-Key'] = opts.apiKey;
  else if (opts.token) authHeaders['Authorization'] = `Bearer ${opts.token}`;

  const spinner = ora('Creating tunnel session...').start();

  let sessionRes: Response;
  try {
    sessionRes = await fetch(`${opts.apiUrl}/api/tunnel/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
      body: JSON.stringify({
        targetPort: port,
        label: opts.label || undefined,
      }),
    });
  } catch (err) {
    spinner.fail('Could not reach Relayon API');
    throw new Error(
      `Network error: ${err instanceof Error ? err.message : String(err)}\n` +
        `Check API URL: ${opts.apiUrl}`,
    );
  }

  if (!sessionRes.ok) {
    spinner.fail(`Failed (${sessionRes.status})`);
    const body = await sessionRes.text().catch(() => '');
    throw new Error(body.slice(0, 300) || `HTTP ${sessionRes.status}`);
  }

  const session = (await sessionRes.json()) as TunnelSession;
  spinner.succeed('Session ready');

  // Banner
  console.log('');
  console.log(chalk.bgHex('#7C3AED').white.bold('  RELAYON TUNNEL  '));
  console.log('');
  console.log(`  ${chalk.gray('Webhook URL:')}  ${chalk.cyan.underline(session.url)}`);
  console.log(
    `  ${chalk.gray('Forwarding →')}  ${chalk.green(
      `http://localhost:${port}${opts.path || '/'}`,
    )}`,
  );
  console.log(
    `  ${chalk.gray('Expires:    ')}  ${new Date(session.expiresAt).toLocaleString()}`,
  );
  console.log('');
  console.log(chalk.gray('  Paste the URL into Stripe / GitHub / Shopify settings.'));
  console.log(chalk.gray('  Press Ctrl+C to stop.'));
  console.log('');

  // Graceful shutdown
  const controller = new AbortController();
  process.on('SIGINT', () => {
    console.log('\n' + chalk.gray('Shutting down tunnel...'));
    controller.abort();
    process.exit(0);
  });

  // Stream + forward
  await createSseClient({
    url: `${opts.apiUrl}/api/tunnel/sessions/${session.sessionId}/stream`,
    authHeaders,
    signal: controller.signal,
    onEvent: async (data: unknown) => {
      const webhook = data as CapturedWebhook;
      if (!webhook.id || !webhook.method) return;

      const time = new Date(webhook.receivedAt).toLocaleTimeString();
      const method = chalk.yellow(webhook.method.padEnd(6));
      const path = webhook.path.slice(0, 40);
      const size = chalk.gray(`${webhook.sizeBytes}B`);

      process.stdout.write(`  ${chalk.gray(time)}  ${method}  ${path}  ${size}  `);

      try {
        const result = await forwardWebhook({
          port,
          pathOverride: opts.path || undefined,
          method: webhook.method,
          path: webhook.path,
          headers: webhook.headers,
          body: webhook.body,
        });

        const statusColor =
          result.status >= 200 && result.status < 300
            ? chalk.green
            : result.status >= 400
              ? chalk.red
              : chalk.yellow;
        console.log(
          statusColor(`${result.status || 'ERR'}`) +
            '  ' +
            chalk.gray(`${result.latencyMs}ms`) +
            (result.error ? '  ' + chalk.red(result.error.slice(0, 60)) : ''),
        );
      } catch (err) {
        console.log(
          chalk.red('ERR') +
            '  ' +
            (err instanceof Error ? err.message : String(err)).slice(0, 80),
        );
      }
    },
    onError: () => {
      console.log(chalk.yellow('⟳'), chalk.gray('reconnecting...'));
    },
  });
}