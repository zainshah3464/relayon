import { Component, inject, signal, input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import {
  AdminApiService,
  type AdminTenantDetail,
} from '../../core/admin/admin.service';
import { ImpersonationClientService } from '../../core/admin/impersonation.service';

@Component({
  selector: 'app-admin-tenant-detail',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="space-y-6">
      <a routerLink="/admin/tenants" class="text-xs text-muted hover:text-white">← All tenants</a>

      @if (loading()) {
        <div class="card text-sm text-muted">Loading tenant...</div>
      } @else if (error()) {
        <div class="card text-sm text-signal-rose">{{ error() }}</div>
      } @else {
        @if (data(); as d) {
          <div class="flex justify-between items-start">
            <div>
              <h1 class="text-2xl font-bold text-white">{{ d.name }}</h1>
              <p class="text-sm text-muted mt-1">
                <code class="text-xs bg-surface-2 px-1.5 py-0.5 rounded">{{ d.slug }}</code>
                · {{ d.plan }} · created {{ d.createdAt | date: 'short' }}
              </p>
            </div>
            <button (click)="impersonate(d)" class="btn-primary text-sm">
              🎭 Impersonate
            </button>
          </div>

          <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div class="card">
              <p class="text-xs uppercase text-muted">Live users</p>
              <p class="text-2xl font-bold text-signal-green mt-1">{{ d.liveUsers }}</p>
            </div>
            <div class="card">
              <p class="text-xs uppercase text-muted">Events (24h)</p>
              <p class="text-2xl font-bold text-white mt-1">{{ d.events24h }}</p>
              <p class="text-xs text-muted">{{ d.events7d }} in 7d</p>
            </div>
            <div class="card">
              <p class="text-xs uppercase text-muted">Deliveries (7d)</p>
              <p class="text-2xl font-bold text-white mt-1">{{ d.deliveries7d }}</p>
            </div>
            <div class="card">
              <p class="text-xs uppercase text-muted">DLQ</p>
              <p class="text-2xl font-bold mt-1"
                 [class.text-signal-rose]="d.dlqCount > 0"
                 [class.text-white]="d.dlqCount === 0">{{ d.dlqCount }}</p>
            </div>
          </div>

          <div class="card">
            <h2 class="text-sm font-medium text-white mb-3">Quota usage</h2>
            <div class="space-y-3">
              <div>
                <div class="flex justify-between text-xs mb-1">
                  <span class="text-muted">Events</span>
                  <span class="text-white">{{ d.usage.events.used }} / {{ d.usage.events.limit }}</span>
                </div>
                <div class="h-2 rounded-full bg-surface-2 overflow-hidden">
                  <div
                    class="h-full transition-all"
                    [class.bg-signal-green]="usagePct(d.usage.events) < 70"
                    [class.bg-signal-amber]="usagePct(d.usage.events) >= 70 && usagePct(d.usage.events) < 90"
                    [class.bg-signal-rose]="usagePct(d.usage.events) >= 90"
                    [style.width.%]="Math.min(100, usagePct(d.usage.events))"
                  ></div>
                </div>
              </div>
              <div>
                <div class="flex justify-between text-xs mb-1">
                  <span class="text-muted">AI tokens</span>
                  <span class="text-white">{{ d.usage.aiTokens.used }} / {{ d.usage.aiTokens.limit }}</span>
                </div>
                <div class="h-2 rounded-full bg-surface-2 overflow-hidden">
                  <div
                    class="h-full transition-all"
                    [class.bg-signal-green]="usagePct(d.usage.aiTokens) < 70"
                    [class.bg-signal-amber]="usagePct(d.usage.aiTokens) >= 70 && usagePct(d.usage.aiTokens) < 90"
                    [class.bg-signal-rose]="usagePct(d.usage.aiTokens) >= 90"
                    [style.width.%]="Math.min(100, usagePct(d.usage.aiTokens))"
                  ></div>
                </div>
              </div>
            </div>
          </div>

          <div class="card">
            <h2 class="text-sm font-medium text-white mb-3">Events (last 30 days)</h2>
            <div class="flex items-end gap-[2px] h-24">
              @for (bar of d.dailyEventChart; track bar.day) {
                <div class="flex-1 bg-relay-violet rounded-t hover:bg-relay-cyan transition-colors"
                     [style.height.%]="barHeight(bar.count, d)"
                     [title]="bar.day + ': ' + bar.count + ' events'">
                </div>
              }
            </div>
            <div class="flex justify-between text-xs text-muted mt-2">
              <span>{{ d.dailyEventChart[0].day }}</span>
<span>{{ d.dailyEventChart[d.dailyEventChart.length - 1].day }}</span>
            </div>
          </div>

          <div class="card">
            <h2 class="text-sm font-medium text-white mb-3">Users ({{ d.users.length }})</h2>
            <div class="space-y-2">
              @for (u of d.users; track u.id) {
                <div class="flex justify-between items-center text-sm bg-surface-2 p-2 rounded">
                  <div>
                    <p class="text-white">{{ u.name }} <span class="text-xs text-muted">({{ u.email }})</span></p>
                    <p class="text-xs text-muted">
                      {{ u.role }}
                      @if (!u.emailVerified) { · <span class="text-signal-amber">unverified</span> }
                      @if (u.isSuperAdmin) { · <span class="text-signal-rose">SUPER ADMIN</span> }
                    </p>
                  </div>
                  <p class="text-xs text-muted">
                    @if (u.lastLoginAt) { Last seen {{ u.lastLoginAt | date: 'short' }} } @else { Never logged in }
                  </p>
                </div>
              }
            </div>
          </div>

          <div class="card">
            <h2 class="text-sm font-medium text-white mb-3">Recent workflows ({{ d.recentWorkflows.length }})</h2>
            @if (d.recentWorkflows.length === 0) {
              <p class="text-sm text-muted">No workflows yet</p>
            } @else {
              <div class="space-y-1">
                @for (w of d.recentWorkflows; track w.id) {
                  <div class="flex justify-between items-center text-sm bg-surface-2 p-2 rounded">
                    <div>
                      <p class="text-white">{{ w.name }}</p>
                      <p class="text-xs text-muted font-mono">{{ w.sourceType }} · {{ w._count.destinations }} destinations</p>
                    </div>
                    <span class="text-xs" [class.text-signal-green]="w.isActive" [class.text-muted]="!w.isActive">
                      {{ w.isActive ? 'active' : 'paused' }}
                    </span>
                  </div>
                }
              </div>
            }
          </div>

          @if (d.recentApiKeys.length > 0) {
            <div class="card">
              <h2 class="text-sm font-medium text-white mb-3">Recent API keys</h2>
              <div class="space-y-1">
                @for (k of d.recentApiKeys; track k.id) {
                  <div class="flex justify-between items-center text-xs bg-surface-2 p-2 rounded">
                    <div>
                      <p class="text-white">{{ k.name }}</p>
                      <p class="text-muted font-mono">{{ k.prefix }}…</p>
                    </div>
                    <span [class.text-signal-rose]="k.revokedAt" [class.text-signal-green]="!k.revokedAt">
                      {{ k.revokedAt ? 'revoked' : 'active' }}
                    </span>
                  </div>
                }
              </div>
            </div>
          }
        }
      }
    </div>
  `,
})
export class AdminTenantDetailComponent implements OnInit {
  readonly id = input.required<string>();

  private api = inject(AdminApiService);
  private imp = inject(ImpersonationClientService);

  data = signal<AdminTenantDetail | null>(null);
  loading = signal(true);
  error = signal<string | null>(null);

  Math = Math;

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.api.tenantDetail(this.id()).subscribe({
      next: (d) => {
        this.data.set(d);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.error?.message ?? 'Failed to load tenant');
        this.loading.set(false);
      },
    });
  }

  usagePct(u: { used: number; limit: number }): number {
    if (u.limit === 0) return 0;
    return Math.round((u.used / u.limit) * 100);
  }

  barHeight(count: number, d: AdminTenantDetail): number {
    const max = Math.max(...d.dailyEventChart.map((x) => x.count), 1);
    return Math.max(2, (count / max) * 100);
  }

  impersonate(d: AdminTenantDetail): void {
    if (
      !confirm(
        `Impersonate "${d.name}"?\n\nThis will:\n• Give you full owner access to their tenant\n• Be logged in audit trail\n• Auto-expire in 15 minutes`,
      )
    ) {
      return;
    }
    this.imp.start(d.id);
  }
}