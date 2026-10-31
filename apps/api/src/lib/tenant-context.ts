import { AsyncLocalStorage } from 'node:async_hooks';

export interface TenantContextStore {
  tenantId: string | null;
  userId: string | null;
  requestId: string | null;
}

export const tenantContext = new AsyncLocalStorage<TenantContextStore>();

export function getTenantId(): string | null {
  return tenantContext.getStore()?.tenantId ?? null;
}