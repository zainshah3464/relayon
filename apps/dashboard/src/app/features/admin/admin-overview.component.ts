import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AdminApiService, type AdminOverview } from '../../core/admin/admin.service';

@Component({
  selector: 'app-admin-overview',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="space-y-6">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold text-white">Platform overview</h1>
          <p class="text-sm text-muted mt-1">Live snapshot — refreshes every 30 seconds</p>
        </div>
        <button (click)="load()" class="btn-secondary text-xs">Refresh</button>
      </div>

      @if (loading()) {
        <div class="card text-sm text-muted">Loading overview...</div>
      } @else if (error()) {
        <div class="card text-sm text-signal-rose">{{ error() }}</div>
      } @else {
        @if (data(); as d) {
          <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div class="card">
              <p class="text-xs uppercase text-muted">Live users</p>
              <p class="text-3xl font-bold text-signal-green mt-1">{{ d.liveUsers }}</p>
              <p class="text-xs text-muted mt-1">Active in last 45s</p>
            </div>
            <div class="card">
              <p class="text-xs uppercase text-muted">Tenants</p>
              <p class="text-3xl font-bold text-white mt-1">{{ d.tenants.total }}</p>
              <p class="text-xs text-signal-cyan mt-1">+{{ d.tenants.new24h }} in 24h</p>
            </div>
            <div class="card">
              <p class="text-xs uppercase text-muted">Users</p>
              <p class="text-3xl font-bold text-white mt-1">{{ d.users.total }}</p>
              <p class="text-xs text-signal-cyan mt-1">+{{ d.users.new24h }} in 24h</p>
            </div>
            <div class="card">
              <p class="text-xs uppercase text-muted">Workflows</p>
              <p class="text-3xl font-bold text-white mt-1">{{ d.workflows.total }}</p>
              <p class="text-xs text-signal-green mt-1">{{ d.workflows.active }} active</p>
            </div>

            <div class="card">
              <p class="text-xs uppercase text-muted">Events (24h)</p>
              <p class="text-2xl font-bold text-white mt-1">{{ d.events.last24h }}</p>
              <p class="text-xs text-muted mt-1">{{ d.events.last7d }} in 7d</p>
            </div>
            <div class="card">
              <p class="text-xs uppercase text-muted">Deliveries (7d)</p>
              <p class="text-2xl font-bold text-white mt-1">{{ d.deliveries.last7d }}</p>
            </div>
            <div class="card">
              <p class="text-xs uppercase text-muted">DLQ total</p>
              <p class="text-2xl font-bold mt-1" [class.text-signal-rose]="d.deliveries.dlqTotal > 0" [class.text-white]="d.deliveries.dlqTotal === 0">{{ d.deliveries.dlqTotal }}</p>
            </div>
            <div class="card">
              <p class="text-xs uppercase text-muted">Snapshot</p>
              <p class="text-sm text-white mt-2">{{ d.timestamp | date: 'medium' }}</p>
            </div>
          </div>

          <div class="card">
            <h2 class="text-lg font-semibold text-white mb-3">Top pages (7d)</h2>
            @if (traffic()?.topPages?.length) {
              <table class="w-full text-sm">
                <thead class="text-xs uppercase text-muted">
                  <tr>
                    <th class="text-left pb-2">Path</th>
                    <th class="text-right pb-2">Views</th>
                    <th class="text-right pb-2">Unique visitors</th>
                  </tr>
                </thead>
                <tbody>
                  @for (row of traffic()!.topPages; track row.path) {
                    <tr class="border-t border-hairline">
                      <td class="py-2 font-mono text-xs text-white">{{ row.path }}</td>
                      <td class="py-2 text-right text-white">{{ row.views }}</td>
                      <td class="py-2 text-right text-muted">{{ row.visitors }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            } @else {
              <p class="text-sm text-muted">No traffic data yet. Events will appear as users browse.</p>
            }
          </div>
        }
      }
    </div>
  `,
})
export class AdminOverviewComponent implements OnInit, OnDestroy {
  private api = inject(AdminApiService);

  data = signal<AdminOverview | null>(null);
  traffic = signal<{ topPages: Array<{ path: string; views: number; visitors: number }> } | null>(null);
  loading = signal(true);
  error = signal<string | null>(null);

  private pollTimer: ReturnType<typeof setInterval> | null = null;

  ngOnInit(): void {
    this.load();
    this.pollTimer = setInterval(() => this.load(), 30_000);
  }

  ngOnDestroy(): void {
    if (this.pollTimer) clearInterval(this.pollTimer);
  }

  load(): void {
    this.loading.set(true);
    this.api.overview().subscribe({
      next: (d) => {
        this.data.set(d);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.error?.message ?? 'Failed to load overview');
        this.loading.set(false);
      },
    });
    this.api.traffic(7).subscribe({
      next: (t) => this.traffic.set(t),
      error: () => this.traffic.set(null),
    });
  }
}