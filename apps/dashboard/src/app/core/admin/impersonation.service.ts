import { Injectable, inject, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { AdminApiService } from './admin.service';
import { AuthService } from '../auth/auth.service';

@Injectable({ providedIn: 'root' })
export class ImpersonationClientService {
  private readonly adminApi = inject(AdminApiService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  private readonly STORAGE_KEY = 'relayon_impersonation';

  readonly isActive = signal(false);
  readonly target = signal<{ id: string; name: string; slug: string } | null>(
    null,
  );
  readonly expiresAt = signal<string | null>(null);
  readonly auditLogId = signal<string | null>(null);

  readonly minutesRemaining = computed(() => {
    const exp = this.expiresAt();
    if (!exp) return 0;
    const diff = new Date(exp).getTime() - Date.now();
    return Math.max(0, Math.floor(diff / 60_000));
  });

  constructor() {
    this.restoreFromStorage();
  }

  start(tenantId: string): void {
    const originalAccess = this.auth.token();
    const originalUser = this.auth.user();

    this.adminApi.startImpersonation(tenantId).subscribe({
      next: (session) => {
        sessionStorage.setItem(
          this.STORAGE_KEY,
          JSON.stringify({
            originalAccess,
            originalUser,
            auditLogId: session.auditLogId,
            tenant: session.tenant,
            expiresAt: session.expiresAt,
          }),
        );

        this.auth.setSessionFromImpersonation({
          accessToken: session.accessToken,
          user: {
            id: originalUser?.id ?? '',
            email: originalUser?.email ?? '',
            name: `${originalUser?.name ?? 'Admin'} (as ${session.tenant.name})`,
            role: 'owner',
            tenantId: session.tenant.id,
            tenantName: session.tenant.name,
            tenantSlug: session.tenant.slug,
            emailVerified: true,
            hasPassword: false,
            provider: 'local',
            locale: originalUser?.locale ?? 'en',
            isSuperAdmin: true,
          },
        });

        this.target.set(session.tenant);
        this.expiresAt.set(session.expiresAt);
        this.auditLogId.set(session.auditLogId);
        this.isActive.set(true);

        this.router.navigate(['/dashboard']);
      },
      error: () => {
        alert('Failed to start impersonation');
      },
    });
  }

  exit(): void {
    const stored = sessionStorage.getItem(this.STORAGE_KEY);
    if (!stored) {
      this.clear();
      return;
    }

    try {
      const data = JSON.parse(stored) as {
        originalAccess: string | null;
        originalUser: unknown;
        auditLogId: string;
        tenant: { id: string; name: string; slug: string };
        expiresAt: string;
      };

      this.adminApi
        .endImpersonation(data.auditLogId)
        .subscribe({ error: () => undefined });

      if (data.originalAccess && data.originalUser) {
        this.auth.setSessionFromImpersonation({
          accessToken: data.originalAccess,
          user: data.originalUser as never,
        });
      }

      sessionStorage.removeItem(this.STORAGE_KEY);
      this.clear();
      this.router.navigate(['/admin/tenants']);
    } catch {
      sessionStorage.removeItem(this.STORAGE_KEY);
      this.clear();
    }
  }

  private restoreFromStorage(): void {
    const stored = sessionStorage.getItem(this.STORAGE_KEY);
    if (!stored) return;
    try {
      const data = JSON.parse(stored) as {
        tenant: { id: string; name: string; slug: string };
        expiresAt: string;
        auditLogId: string;
      };

      if (new Date(data.expiresAt) < new Date()) {
        sessionStorage.removeItem(this.STORAGE_KEY);
        return;
      }

      this.target.set(data.tenant);
      this.expiresAt.set(data.expiresAt);
      this.auditLogId.set(data.auditLogId);
      this.isActive.set(true);
    } catch {
      sessionStorage.removeItem(this.STORAGE_KEY);
    }
  }

  private clear(): void {
    this.isActive.set(false);
    this.target.set(null);
    this.expiresAt.set(null);
    this.auditLogId.set(null);
  }
}