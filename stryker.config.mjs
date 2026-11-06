/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
  testRunner: 'vitest',
  plugins: ['@stryker-mutator/vitest-runner'],
  checkers: [],
  tsconfigFile: 'tsconfig.base.json',

  vitest: {
    configFile: 'vitest.config.ts',
  },

  mutate: [
    'apps/api/src/lib/crypto-box.ts',
    'apps/api/src/modules/auth/auth.service.ts',
    'apps/api/src/modules/quota/quota.service.ts',
    'apps/api/src/modules/api-keys/api-keys.service.ts',
    'apps/ingress/src/services/verifiers.ts',
    'apps/ingress/src/middleware/idempotency.ts',
    'apps/workers/src/modules/egress/retry-policy.ts',
    'apps/workers/src/modules/egress/circuit-breaker.service.ts',
    'apps/workers/src/modules/processing/routing.service.ts',
    '!**/*.spec.ts',
    '!**/*.dto.ts',
    '!**/*.module.ts',
    '!**/*.controller.ts',
    '!**/main.ts',
  ],

  thresholds: {
    high: 90,
    low: 70,
    break: null,
  },

  reporters: ['clear-text', 'progress', 'html'],
  htmlReporter: { fileName: 'reports/mutation/index.html' },
  tempDirName: '.stryker-tmp',
  cleanTempDir: true,
  timeoutMS: 30_000,
  concurrency: 2,
};