import { Component, inject, signal, input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import {
  AdminApiService,
  type AdminTenantDetail,
} from '../../core/admin/admin.service';
import { ImpersonationClientService } from '../../core/admin/impersonation.service';
import { TimeTravelPanelComponent } from './time-travel-panel.component';
import { IconComponent } from '../../shared/ui/icon/icon.component';
import { ConfirmDialogService } from '../../shared/ui/confirm/confirm-dialog.service';

@Component({
  selector: 'app-admin-tenant-detail',
  standalone: true,
  imports: [CommonModule, RouterLink, TimeTravelPanelComponent, IconComponent],
  template: `
    <div class="space-y-4">
      <a routerLink="/admin/tenants" class="inline-flex items-center gap-1 text-xs text-muted transition-colors hover:text-foreground">
        <app-icon name="arrow-left" [size]="11" [strokeWidth]="2.5" />
        <span>All tenants</span>
      </a>

      @if (loading()) {
        <div class="space-y-3">
          <div class="card"><div class="skeleton h-6 w-48"></div><div class="skeleton mt-2 h-3 w-64"></div></div>
          <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            @for (i of [1, 2, 3, 4]; track i) {
              <div class="card"><div class="skeleton h-3 w-16"></div><div class="skeleton mt-2 h-7 w-14"></div></div>
            }
          </div>
        </div>
      } @else if (error()) {
        <div class="card flex items-center gap-3 border-signal-rose/30 bg-signal-rose/[0.06]">
          <app-icon name="x-circle" [size]="18" [strokeWidth]="2" class="text-signal-rose" />
          <p class="flex-1 text-sm text-signal-rose">{{ error() }}</p>
        </div>
      } @else if (data()) {
        @if (data(); as d) {
          <!-- Header -->
          <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div class="min-w-0">
              <h1 class="text-2xl font-bold tracking-tighter text-foreground">{{ d.name }}</h1>
              <p class="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                <code class="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] text-foreground">{{ d.slug }}</code>
                <span class="text-muted-2">·</span>
                <span class="capitalize">{{ d.plan }}</span>
                <span class="text-muted-2">·</span>
                <span>Created {{ d.createdAt | date: 'short' }}</span>
              </p>
            </div>
            <button type="button" (click)="impersonate(d)" class="btn-primary self-start">
              <app-icon name="user-check" [size]="13" [strokeWidth]="2" />
              <span>Impersonate</span>
            </button>
          </div>

          <!-- Stat grid -->
          <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div class="card">
              <p class="text-[10px] font-medium uppercase tracking-wider text-muted-2">Live users</p>
              <p class="mt-1 font-mono text-2xl font-bold tabular-nums text-signal-green">{{ d.liveUsers }}</p>
            </div>
            <div class="card">
              <p class="text-[10px] font-medium uppercase tracking-wider text-muted-2">Events (24h)</p>
              <p class="mt-1 font-mono text-2xl font-bold tabular-nums text-foreground">{{ d.events24h.toLocaleString() }}</p>
              <p class="mt-0.5 text-[11px] text-muted-2">{{ d.events7d.toLocaleString() }} in 7d</p>
            </div>
            <div class="card">
              <p class="text-[10px] font-medium uppercase tracking-wider text-muted-2">Deliveries (7d)</p>
              <p class="mt-1 font-mono text-2xl font-bold tabular-nums text-foreground">{{ d.deliveries7d.toLocaleString() }}</p>
            </div>
            <div class="card">
              <p class="text-[10px] font-medium uppercase tracking-wider text-muted-2">DLQ</p>
              <p
                class="mt-1 font-mono text-2xl font-bold tabular-nums"
                [class.text-signal-rose]="d.dlqCount > 0"
                [class.text-foreground]="d.dlqCount === 0"
              >{{ d.dlqCount }}</p>
            </div>
          </div>

          <!-- Usage -->
          <div class="card">
            <h2 class="flex items-center gap-2 text-sm font-semibold text-foreground">
              <app-icon name="gauge" [size]="14" [strokeWidth]="2" class="text-muted" />
              Quota usage
            </h2>
            <div class="mt-3 grid gap-4 sm:grid-cols-2">
              <div>
                <div class="flex justify-between text-xs">
                  <span class="text-muted">Events</span>
                  <span class="font-mono tabular-nums text-foreground">
                    {{ d.usage.events.used.toLocaleString() }} / {{ d.usage.events.limit.toLocaleString() }}
                  </span>
                </div>
                <div class="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-3">
                  <div
                    class="h-full rounded-full transition-all"
                    [ngClass]="barColor(usagePct(d.usage.events))"
                    [style.width.%]="Math.min(100, usagePct(d.usage.events))"
                  ></div>
                </div>
                <p class="mt-1 text-[11px] text-muted-2">{{ usagePct(d.usage.events) }}% used</p>
              </div>
              <div>
                <div class="flex justify-between text-xs">
                  <span class="text-muted">AI tokens</span>
                  <span class="font-mono tabular-nums text-foreground">
                    {{ d.usage.aiTokens.used.toLocaleString() }} / {{ d.usage.aiTokens.limit.toLocaleString() }}
                  </span>
                </div>
                <div class="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-3">
                  <div
                    class="h-full rounded-full transition-all"
                    [ngClass]="barColor(usagePct(d.usage.aiTokens))"
                    [style.width.%]="Math.min(100, usagePct(d.usage.aiTokens))"
                  ></div>
                </div>
                <p class="mt-1 text-[11px] text-muted-2">{{ usagePct(d.usage.aiTokens) }}% used</p>
              </div>
            </div>
          </div>

          <!-- Chart -->
          <div class="card">
            <h2 class="flex items-center gap-2 text-sm font-semibold text-foreground">
              <app-icon name="trending-up" [size]="14" [strokeWidth]="2" class="text-muted" />
              Events (last 30 days)
            </h2>
            <div class="mt-3 flex h-24 items-end gap-[2px]">
              @for (bar of d.dailyEventChart; track bar.day) {
                <div
                  class="flex-1 rounded-t bg-relay-violet transition-colors hover:bg-relay-cyan"
                  [style.height.%]="barHeight(bar.count, d)"
                  [title]="bar.day + ': ' + bar.count + ' events'"
                ></div>
              }
            </div>
            <div class="mt-2 flex justify-between text-[11px] text-muted-2">
              <span>{{ d.dailyEventChart[0].day }}</span>
              <span>{{ d.dailyEventChart[d.dailyEventChart.length - 1].day }}</span>
            </div>
          </div>

          <!-- Users -->
          <div class="card">
            <h2 class="flex items-center gap-2 text-sm font-semibold text-foreground">
              <app-icon name="users" [size]="14" [strokeWidth]="2" class="text-muted" />
              Users
              <span class="badge">{{ d.users.length }}</span>
            </h2>
            <div class="mt-3 space-y-1.5">
              @for (u of d.users; track u.id) {
                <div class="flex flex-col gap-1 rounded-md border border-hairline bg-surface-2/50 p-2 text-xs sm:flex-row sm:items-center sm:justify-between">
                  <div class="min-w-0">
                    <p class="truncate text-foreground">
                      {{ u.name }}
                      <span class="font-mono text-[10px] text-muted">({{ u.email }})</span>
                    </p>
                    <div class="mt-0.5 flex flex-wrap items-center gap-1">
                      <span class="badge capitalize">{{ u.role }}</span>
                      @if (!u.emailVerified) { <span class="badge badge-warning">Unverified</span> }
                      @if (u.isSuperAdmin) { <span class="badge badge-danger">Super</span> }
                    </div>
                  </div>
                  <p class="text-[11px] text-muted-2">
                    {{ u.lastLoginAt ? ('Last seen ' + (u.lastLoginAt | date: 'short')) : 'Never logged in' }}
                  </p>
                </div>
              }
            </div>
          </div>

          <!-- Workflows -->
          <div class="card">
            <h2 class="flex items-center gap-2 text-sm font-semibold text-foreground">
              <app-icon name="workflow" [size]="14" [strokeWidth]="2" class="text-muted" />
              Recent workflows
              <span class="badge">{{ d.recentWorkflows.length }}</span>
            </h2>
            @if (d.recentWorkflows.length === 0) {
              <p class="mt-3 rounded-md bg-surface-2/50 p-3 text-xs text-muted">No workflows yet</p>
            } @else {
              <div class="mt-3 space-y-1.5">
                @for (w of d.recentWorkflows; track w.id) {
                  <div class="flex items-center justify-between gap-2 rounded-md border border-hairline bg-surface-2/50 p-2 text-xs">
                    <div class="min-w-0">
                      <p class="truncate text-foreground">{{ w.name }}</p>
                      <p class="font-mono text-[10px] text-muted">{{ w.sourceType }} · {{ w._count.destinations }} destinations</p>
                    </div>
                    <span
                      [ngClass]="w.isActive ? 'badge-success' : 'badge'"
                      class="badge shrink-0"
                    >{{ w.isActive ? 'Active' : 'Paused' }}</span>
                  </div>
                }
              </div>
            }
          </div>

          <!-- API keys -->
          @if (d.recentApiKeys.length > 0) {
            <div class="card">
              <h2 class="flex items-center gap-2 text-sm font-semibold text-foreground">
                <app-icon name="key" [size]="14" [strokeWidth]="2" class="text-muted" />
                Recent API keys
              </h2>
              <div class="mt-3 space-y-1.5">
                @for (k of d.recentApiKeys; track k.id) {
                  <div class="flex items-center justify-between gap-2 rounded-md border border-hairline bg-surface-2/50 p-2 text-xs">
                    <div class="min-w-0">
                      <p class="truncate text-foreground">{{ k.name }}</p>
                      <p class="font-mono text-[10px] text-muted">{{ k.prefix }}…</p>
                    </div>
                    <span
                      [ngClass]="k.revokedAt ? 'badge-danger' : 'badge-success'"
                      class="badge shrink-0"
                    >{{ k.revokedAt ? 'Revoked' : 'Active' }}</span>
                  </div>
                }
              </div>
            </div>
          }

          <!-- Time travel -->
          <app-time-travel-panel [tenantId]="id()" />
        }
      }
    </div>
  `,
})
export class AdminTenantDetailComponent implements OnInit {
  readonly id = input.required<string>();

  private readonly api = inject(AdminApiService);
  private readonly imp = inject(ImpersonationClientService);
  private readonly confirm = inject(ConfirmDialogService);

  readonly data = signal<AdminTenantDetail | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  readonly Math = Math;

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

  barColor(pct: number): string {
    if (pct >= 90) return 'bg-signal-rose';
    if (pct >= 70) return 'bg-signal-amber';
    return 'bg-signal-green';
  }

  barHeight(count: number, d: AdminTenantDetail): number {
    const max = Math.max(...d.dailyEventChart.map((x) => x.count), 1);
    return Math.max(2, (count / max) * 100);
  }

  async impersonate(d: AdminTenantDetail): Promise<void> {
    const ok = await this.confirm.confirm({
      title: `Impersonate "${d.name}"`,
      message:
        `You will get full owner access to this tenant's workspace.\n\nThis action is logged in the audit trail and auto-expires in 15 minutes.`,
      confirmText: 'Impersonate',
      variant: 'default',
      icon: 'info',
    });
    if (!ok) return;
    this.imp.start(d.id);
  }
}