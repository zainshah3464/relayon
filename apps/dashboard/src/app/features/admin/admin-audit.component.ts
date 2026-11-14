import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

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
  imports: [CommonModule],
  template: `
    <div class="space-y-6">
      <div>
        <h1 class="text-2xl font-bold text-white">Audit log</h1>
        <p class="text-sm text-muted mt-1">All admin actions across the platform</p>
      </div>

      @if (loading()) {
        <div class="card text-sm text-muted">Loading...</div>
      } @else if (entries().length === 0) {
        <div class="card text-center py-8 text-sm text-muted">No audit entries yet</div>
      } @else {
        <div class="card p-0 overflow-hidden">
          <table class="w-full text-sm">
            <thead class="bg-surface-2 text-xs uppercase text-muted">
              <tr>
                <th class="text-left p-3">Time</th>
                <th class="text-left p-3">Action</th>
                <th class="text-left p-3">Target</th>
                <th class="text-left p-3">Metadata</th>
              </tr>
            </thead>
            <tbody>
              @for (e of entries(); track e.id) {
                <tr class="border-t border-hairline hover:bg-surface-2">
                  <td class="p-3 text-xs text-muted whitespace-nowrap">{{ e.createdAt | date: 'short' }}</td>
                  <td class="p-3">
                    <span
                      class="text-xs px-2 py-0.5 rounded font-mono"
                      [ngClass]="{
                        'bg-signal-rose/20 text-signal-rose': isDangerous(e.action),
                        'bg-signal-amber/20 text-signal-amber': isImpersonation(e.action),
                        'bg-surface-2 text-white': !isDangerous(e.action) && !isImpersonation(e.action)
                      }"
                    >{{ e.action }}</span>
                  </td>
                  <td class="p-3 text-xs text-muted font-mono">
                    @if (e.targetType) { {{ e.targetType }}:{{ e.targetId?.slice(0, 8) ?? '—' }} }
                  </td>
                  <td class="p-3 text-xs text-muted truncate max-w-xs">{{ formatMeta(e.metadata) }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </div>
  `,
})
export class AdminAuditComponent implements OnInit {
  private http = inject(HttpClient);
  entries = signal<AuditEntry[]>([]);
  loading = signal(true);

  ngOnInit(): void {
    this.http
      .get<AuditEntry[]>(`${environment.apiUrl}/api/admin/audit?limit=200`)
      .subscribe({
        next: (r) => {
          this.entries.set(r);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
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