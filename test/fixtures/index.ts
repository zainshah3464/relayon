import { randomUUID, createHmac } from 'node:crypto';

export function makeTenant(
  overrides: Partial<{
    id: string;
    name: string;
    slug: string;
    plan: 'free' | 'pro' | 'enterprise';
    quotaEventsPerMonth: number;
    quotaAiTokensPerMonth: number;
    quotaMode: 'hard' | 'soft';
  }> = {},
) {
  const id = overrides.id ?? randomUUID();
  return {
    id,
    name: overrides.name ?? 'Test Tenant',
    slug: overrides.slug ?? `test-${id.slice(0, 8)}`,
    plan: overrides.plan ?? ('free' as const),
    quotaEventsPerMonth: overrides.quotaEventsPerMonth ?? 10000,
    quotaAiTokensPerMonth: overrides.quotaAiTokensPerMonth ?? 100000,
    quotaMode: overrides.quotaMode ?? ('hard' as const),
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    stripePriceId: null,
    subscriptionStatus: 'none',
    currentPeriodEnd: null,
    currentPeriodStart: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

// ═══════════════════════════════════════════════════════════════
// ⚠️ v3.7 FIX — makeUser now includes ALL v2.1+ fields
//    (emailVerified, googleId, githubId, locale, isSuperAdmin,
//    lastLoginAt). Without these in the type signature, TS silently
//    drops overrides → tests see undefined → wrong branch.
// ═══════════════════════════════════════════════════════════════
export function makeUser(
  overrides: Partial<{
    id: string;
    tenantId: string;
    email: string;
    name: string;
    role: 'owner' | 'admin' | 'viewer';
    passwordHash: string | null;
    // ⚠️ v2.1 — verification + OAuth
    emailVerified: boolean;
    googleId: string | null;
    githubId: string | null;
    // ⚠️ v2.2 — preferred locale
    locale: string;
    // ⚠️ v2.4 — platform admin
    isSuperAdmin: boolean;
    lastLoginAt: Date | null;
  }> = {},
) {
  const id = overrides.id ?? randomUUID();
  return {
    id,
    tenantId: overrides.tenantId ?? randomUUID(),
    email: overrides.email ?? `user-${id.slice(0, 8)}@example.com`,
    name: overrides.name ?? 'Test User',
    passwordHash:
      overrides.passwordHash ?? '$2a$12$dummy.hash.not.real.for.fixtures',
    role: overrides.role ?? ('owner' as const),
    // ⚠️ Default false — mirrors production signup behavior
    emailVerified: overrides.emailVerified ?? false,
    googleId: overrides.googleId ?? null,
    githubId: overrides.githubId ?? null,
    locale: overrides.locale ?? 'en',
    isSuperAdmin: overrides.isSuperAdmin ?? false,
    lastLoginAt: overrides.lastLoginAt ?? null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

export function makeWorkflow(
  overrides: Partial<{
    id: string;
    tenantId: string;
    name: string;
    sourceType: 'stripe' | 'github' | 'shopify' | 'slack' | 'generic';
    sourceConfig: Record<string, unknown>;
    transformExpression: string | null;
    enrichmentEnabled: boolean;
    routingRules: Array<{ when: string; destinationIds: string[] }>;
  }> = {},
) {
  const id = overrides.id ?? randomUUID();
  return {
    id,
    tenantId: overrides.tenantId ?? randomUUID(),
    name: overrides.name ?? 'Test Workflow',
    sourceType: overrides.sourceType ?? ('stripe' as const),
    sourceConfig: overrides.sourceConfig ?? { secret: 'whsec_test123' },
    enrichmentEnabled: overrides.enrichmentEnabled ?? false,
    enrichmentPrompt: null,
    transformExpression: overrides.transformExpression ?? null,
    routingRules: overrides.routingRules ?? [],
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

export function makeDestination(
  overrides: Partial<{
    id: string;
    workflowId: string;
    type: string;
    name: string;
    config: Record<string, unknown>;
  }> = {},
) {
  const id = overrides.id ?? randomUUID();
  return {
    id,
    workflowId: overrides.workflowId ?? randomUUID(),
    type: overrides.type ?? 'http',
    name: overrides.name ?? 'Test Destination',
    config: overrides.config ?? { url: 'https://httpbin.org/post' },
    enabled: true,
    retryPolicy: {
      max_attempts: 5,
      backoff_ms: [10000, 30000, 60000, 300000, 900000],
    },
    lastValidatedAt: null,
    lastValidationOk: null,
    lastValidationError: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

export function makeQueuedEvent(
  overrides: Partial<{
    correlationId: string;
    tenantId: string;
    workflowId: string;
    sourceType: string;
    rawPayload: Record<string, unknown>;
  }> = {},
) {
  return {
    correlationId: overrides.correlationId ?? randomUUID(),
    tenantId: overrides.tenantId ?? randomUUID(),
    workflowId: overrides.workflowId ?? randomUUID(),
    sourceType: overrides.sourceType ?? 'stripe',
    receivedAt: new Date().toISOString(),
    rawPayload: overrides.rawPayload ?? {
      type: 'checkout.session.completed',
      data: { amount: 5000, currency: 'usd' },
    },
    headers: { 'x-test': 'true' },
    ipHash: null,
    userAgent: 'vitest',
    idempotencyKey: null,
  };
}

export function makeStripeSignature(
  secret: string,
  body: string,
  timestamp = Math.floor(Date.now() / 1000),
): string {
  const signed = `${timestamp}.${body}`;
  const sig = createHmac('sha256', secret).update(signed).digest('hex');
  return `t=${timestamp},v1=${sig}`;
}