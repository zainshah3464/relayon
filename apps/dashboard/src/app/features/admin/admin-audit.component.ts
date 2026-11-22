import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { IconComponent } from '../../shared/ui/icon/icon.component';

interface AuditEntry {
  id: string;
  adminId: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  metadata: Record<string, unknown>;
  ipHash: string | null;
  impersonatedTenantId: string | null;
  createdAt: string;
}

@Component({
  selector: 'app-admin-audit',
  standalone: true,
  imports: [CommonModule, IconComponent],
  template: `
    <div class="space-y-4">
      <div class="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 class="text-2xl font-bold tracking-tighter text-foreground">Audit log</h1>
          <p class="mt-1 text-sm text-muted">All admin actions across the platform</p>
        </div>
        <button type="button" (click)="load()" [disabled]="loading()" class="btn-secondary self-start">
          <app-icon name="refresh" [size]="12" [strokeWidth]="2.5" [class.animate-spin]="loading()" />
          <span>Refresh</span>
        </button>
      </div>

      @if (loading() && entries().length === 0) {
        <div class="card p-0 overflow-hidden">
          @for (i of [1, 2, 3, 4, 5]; track i) {
            <div class="flex items-center gap-3 border-b border-hairline p-3 last:border-b-0">
              <div class="skeleton h-3 w-24"></div>
              <div class="skeleton h-5 w-32"></div>
              <div class="ml-auto skeleton h-3 w-40"></div>
            </div>
          }
        </div>
      } @else if (entries().length === 0) {
        <div class="card flex flex-col items-center justify-center py-12 text-center">
          <div class="flex h-12 w-12 items-center justify-center rounded-xl border border-hairline bg-surface-2 text-muted">
            <app-icon name="file-text" [size]="22" [strokeWidth]="1.75" />
          </div>
          <p class="mt-3 text-sm font-medium text-foreground">No audit entries yet</p>
          <p class="mt-1 text-xs text-muted">Admin actions will appear here.</p>
        </div>
      } @else {
        <!-- Desktop table -->
        <div class="card hidden overflow-hidden p-0 sm:block">
          <table class="w-full text-sm">
            <thead class="bg-surface-2/50">
              <tr class="border-b border-hairline">
                <th class="px-3 py-2.5 text-left text-[10px] font-medium uppercase tracking-wider text-muted-2">Time</th>
                <th class="px-3 py-2.5 text-left text-[10px] font-medium uppercase tracking-wider text-muted-2">Action</th>
                <th class="px-3 py-2.5 text-left text-[10px] font-medium uppercase tracking-wider text-muted-2">Target</th>
                <th class="px-3 py-2.5 text-left text-[10px] font-medium uppercase tracking-wider text-muted-2">Metadata</th>
              </tr>
            </thead>
            <tbody>
              @for (e of entries(); track e.id) {
                <tr class="border-b border-hairline last:border-b-0 hover:bg-surface-2/40">
                  <td class="px-3 py-2.5 whitespace-nowrap text-[11px] text-muted">{{ e.createdAt | date: 'short' }}</td>
                  <td class="px-3 py-2.5">
                    <span [ngClass]="actionClass(e.action)" class="rounded px-1.5 py-0.5 font-mono text-[10px]">
                      {{ e.action }}
                    </span>
                  </td>
                  <td class="px-3 py-2.5 font-mono text-[11px] text-muted">
                    @if (e.targetType) {
                      {{ e.targetType }}:{{ e.targetId?.slice(0, 8) ?? '—' }}
                    } @else {
                      <span class="text-muted-2">—</span>
                    }
                  </td>
                  <td class="max-w-xs truncate px-3 py-2.5 text-[11px] text-muted">{{ formatMeta(e.metadata) }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        <!-- Mobile cards -->
        <div class="space-y-2 sm:hidden">
          @for (e of entries(); track e.id) {
            <div class="card">
              <div class="flex items-start justify-between gap-2">
                <span [ngClass]="actionClass(e.action)" class="rounded px-1.5 py-0.5 font-mono text-[10px]">
                  {{ e.action }}
                </span>
                <span class="text-[10px] text-muted-2 whitespace-nowrap">{{ e.createdAt | date: 'short' }}</span>
              </div>
              @if (e.targetType) {
                <p class="mt-1.5 font-mono text-[11px] text-muted">
                  {{ e.targetType }}:{{ e.targetId?.slice(0, 8) ?? '—' }}
                </p>
              }
              @if (formatMeta(e.metadata) !== '—') {
                <p class="mt-1 truncate text-[11px] text-muted-2">{{ formatMeta(e.metadata) }}</p>
              }
            </div>
          }
        </div>
      }
    </div>
  `,
})
export class AdminAuditComponent implements OnInit {
  private readonly http = inject(HttpClient);

  readonly entries = signal<AuditEntry[]>([]);
  readonly loading = signal(true);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.http.get<AuditEntry[]>(`${environment.apiUrl}/api/admin/audit?limit=200`).subscribe({
      next: (r) => {
        this.entries.set(r);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  actionClass(action: string): string {
    if (this.isDangerous(action)) return 'bg-signal-rose/12 text-signal-rose';
    if (this.isImpersonation(action)) return 'bg-signal-amber/12 text-signal-amber';
    return 'bg-surface-3 text-muted';
  }

  isDangerous(action: string): boolean {
    return (
      action.includes('remove') ||
      action.includes('delete') ||
      action.includes('actioned')
    );
  }

  isImpersonation(action: string): boolean {
    return action.includes('impersonate');
  }

  formatMeta(meta: Record<string, unknown>): string {
    const keys = Object.keys(meta);
    if (keys.length === 0) return '—';
    return keys.map((k) => `${k}=${String(meta[k]).slice(0, 30)}`).join(', ');
  }
}