import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface AdminOverview {
  tenants: { total: number; new24h: number };
  users: { total: number; new24h: number };
  workflows: { total: number; active: number };
  events: { last24h: number; last7d: number };
  deliveries: { last7d: number; dlqTotal: number };
  liveUsers: number;
  timestamp: string;
}

export interface AdminTenant {
  id: string;
  name: string;
  slug: string;
  plan: string;
  subscriptionStatus: string;
  userCount: number;
  workflowCount: number;
  createdAt: string;
}

export interface AdminHealth {
  services: { postgres: string; mongo: string; redis: string };
  queues: { incoming: number; processing: number; egress: number };
  timestamp: string;
}

// ⚠️ v2.9 — detailed tenant
export interface AdminTenantDetail {
  id: string;
  name: string;
  slug: string;
  plan: string;
  subscriptionStatus: string;
  stripeCustomerId: string | null;
  quotaMode: string;
  currentPeriodEnd: string | null;
  createdAt: string;
  counts: { users: number; workflows: number; apiKeys: number };
  users: Array<{
    id: string;
    email: string;
    name: string;
    role: string;
    emailVerified: boolean;
    isSuperAdmin: boolean;
    lastLoginAt: string | null;
    createdAt: string;
  }>;
  recentWorkflows: Array<{
    id: string;
    name: string;
    sourceType: string;
    isActive: boolean;
    createdAt: string;
    _count: { destinations: number };
  }>;
  recentApiKeys: Array<{
    id: string;
    name: string;
    prefix: string;
    environment: string;
    lastUsedAt: string | null;
    revokedAt: string | null;
    createdAt: string;
  }>;
  usage: {
    events: { used: number; limit: number };
    aiTokens: { used: number; limit: number };
  };
  events24h: number;
  events7d: number;
  deliveries7d: number;
  dlqCount: number;
  liveUsers: number;
  dailyEventChart: Array<{ day: string; count: number }>;
}

export interface ImpersonationSession {
  accessToken: string;
  expiresAt: string;
  tenant: { id: string; name: string; slug: string };
  admin: { id: string; email: string; name: string };
  auditLogId: string;
}

@Injectable({ providedIn: 'root' })
export class AdminApiService {
  private http = inject(HttpClient);
  private base = environment.apiUrl;

  overview(): Observable<AdminOverview> {
    return this.http.get<AdminOverview>(`${this.base}/api/admin/overview`);
  }

  tenants(opts: { limit?: number; cursor?: string; search?: string } = {}): Observable<{
    items: AdminTenant[];
    nextCursor: string | null;
  }> {
    let p = new HttpParams();
    if (opts.limit) p = p.set('limit', String(opts.limit));
    if (opts.cursor) p = p.set('cursor', opts.cursor);
    if (opts.search) p = p.set('search', opts.search);
    return this.http.get<{ items: AdminTenant[]; nextCursor: string | null }>(
      `${this.base}/api/admin/tenants`,
      { params: p },
    );
  }

  // ⚠️ v2.9 — detailed tenant view
  tenantDetail(id: string): Observable<AdminTenantDetail> {
    return this.http.get<AdminTenantDetail>(
      `${this.base}/api/admin/tenants/${id}`,
    );
  }

  health(): Observable<AdminHealth> {
    return this.http.get<AdminHealth>(`${this.base}/api/admin/health`);
  }

  live(): Observable<{
    count: number;
    sessions: Array<{
      sessionId: string;
      tenantId: string | null;
      userId: string | null;
      path: string;
      lastSeenMs: number;
    }>;
  }> {
    return this.http.get<{
      count: number;
      sessions: Array<{
        sessionId: string;
        tenantId: string | null;
        userId: string | null;
        path: string;
        lastSeenMs: number;
      }>;
    }>(`${this.base}/api/admin/live`);
  }

  traffic(days = 7): Observable<{
    window: string;
    daily: Array<{ day: string; sessions: number; pageviews: number }>;
    topPages: Array<{ path: string; views: number; visitors: number }>;
  }> {
    return this.http.get<{
      window: string;
      daily: Array<{ day: string; sessions: number; pageviews: number }>;
      topPages: Array<{ path: string; views: number; visitors: number }>;
    }>(`${this.base}/api/admin/analytics/traffic?days=${days}`);
  }

  // ⚠️ v2.9 — impersonation
  startImpersonation(tenantId: string): Observable<ImpersonationSession> {
    return this.http.post<ImpersonationSession>(
      `${this.base}/api/admin/impersonate`,
      { tenantId },
    );
  }

  endImpersonation(auditLogId: string): Observable<{ ended: boolean }> {
    return this.http.post<{ ended: boolean }>(
      `${this.base}/api/admin/impersonate/end`,
      { auditLogId },
    );
  }

  listActiveImpersonations(): Observable<
    Array<{
      auditLogId: string;
      adminEmail: string;
      tenantName: string;
      startedAt: string;
      expiresAt: string;
    }>
  > {
    return this.http.get<
      Array<{
        auditLogId: string;
        adminEmail: string;
        tenantName: string;
        startedAt: string;
        expiresAt: string;
      }>
    >(`${this.base}/api/admin/impersonate/active`);
  }
}