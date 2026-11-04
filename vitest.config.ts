import { defineConfig } from 'vitest/config';
import swc from 'unplugin-swc';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [
    swc.vite({
      module: { type: 'es6' },
      jsc: {
        parser: { syntax: 'typescript', decorators: true },
        transform: {
          legacyDecorator: true,
          decoratorMetadata: true,
        },
        target: 'es2022',
      },
    }),
  ],
  test: {
    globals: true,
    environment: 'node',
    setupFiles: [resolve(__dirname, 'test/setup/vitest-setup.ts')],
    include: ['apps/*/src/**/*.spec.ts'],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/*.e2e.spec.ts',
      '**/*.integration.spec.ts',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: [
        'apps/api/src/lib/crypto-box.ts',
        'apps/api/src/modules/auth/auth.service.ts',
        'apps/api/src/modules/quota/quota.service.ts',
        'apps/ingress/src/lib/quota.ts',
        'apps/ingress/src/middleware/idempotency.ts',
        'apps/ingress/src/services/verifiers.ts',
        'apps/workers/src/modules/egress/adapters/http.adapter.ts',
        'apps/workers/src/modules/egress/circuit-breaker.service.ts',
        'apps/workers/src/modules/egress/retry-policy.ts',
        'apps/workers/src/modules/processing/routing.service.ts',
        'apps/workers/src/modules/processing/transform.service.ts',
      ],
      exclude: [
        '**/node_modules/**',
        '**/*.spec.ts',
        '**/*.dto.ts',
        '**/*.module.ts',
        '**/*.controller.ts',
        '**/main.ts',
      ],
      thresholds: {
        lines: 55,
        functions: 55,
        branches: 50,
        statements: 55,
      },
    },
    testTimeout: 10_000,
    hookTimeout: 15_000,
  },
});