import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AdminApiService, type AdminOverview } from '../../core/admin/admin.service';
import { IconComponent, type IconName } from '../../shared/ui/icon/icon.component';

interface StatCard {
  label: string;
  icon: IconName;
  color: 'violet' | 'cyan' | 'green' | 'amber' | 'rose';
  value: number | string;
  hint?: string;
}

interface TrafficRow {
  path: string;
  views: number;
  visitors: number;
}

@Component({
  selector: 'app-admin-overview',
  standalone: true,
  imports: [CommonModule, IconComponent],
  template: `
    <div class="space-y-5">
      <!-- Header -->
      <div class="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 class="text-2xl font-bold tracking-tighter text-foreground">Platform overview</h1>
          <p class="mt-1 text-sm text-muted">Live snapshot · refreshes every 30s</p>
        </div>
        <button type="button" (click)="load()" [disabled]="loading()" class="btn-secondary self-start">
          <app-icon name="refresh" [size]="12" [strokeWidth]="2.5" [class.animate-spin]="loading()" />
          <span>Refresh</span>
        </button>
      </div>

      @if (loading() && !data()) {
        <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          @for (i of [1, 2, 3, 4, 5, 6, 7, 8]; track i) {
            <div class="card"><div class="skeleton h-4 w-20"></div><div class="skeleton mt-3 h-8 w-16"></div></div>
          }
        </div>
      } @else if (error()) {
        <div class="card flex items-center gap-3 border-signal-rose/30 bg-signal-rose/[0.06]">
          <app-icon name="x-circle" [size]="18" [strokeWidth]="2" class="text-signal-rose" />
          <p class="flex-1 text-sm text-signal-rose">{{ error() }}</p>
          <button type="button" (click)="load()" class="btn-secondary text-xs">Retry</button>
        </div>
      } @else if (data()) {
        @if (data(); as d) {
          <!-- Stat grid -->
          <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            @for (s of statCards(d); track s.label) {
              <div class="card">
                <div class="flex items-center gap-2">
                  <div [ngClass]="statIconBg(s.color)" class="flex h-7 w-7 items-center justify-center rounded-md">
                    <app-icon [name]="s.icon" [size]="12" [strokeWidth]="2" />
                  </div>
                  <p class="text-[11px] font-medium uppercase tracking-wider text-muted">{{ s.label }}</p>
                </div>
                <p class="mt-2 text-2xl font-bold tabular-nums tracking-tight text-foreground">{{ s.value }}</p>
                @if (s.hint) {
                  <p class="mt-0.5 text-[11px] text-muted-2">{{ s.hint }}</p>
                }
              </div>
            }
          </div>

          <!-- Traffic table -->
          <div class="card">
            <div class="flex items-center justify-between">
              <h2 class="flex items-center gap-2 text-sm font-semibold text-foreground">
                <app-icon name="activity" [size]="14" [strokeWidth]="2" class="text-muted" />
                Top pages (7d)
              </h2>
            </div>

            @if (traffic()?.topPages?.length) {
              <div class="mt-3 -mx-4 overflow-x-auto sm:mx-0">
                <table class="w-full min-w-[480px] text-sm">
                  <thead class="border-b border-hairline">
                    <tr>
                      <th class="px-3 py-2 text-left text-[10px] font-medium uppercase tracking-wider text-muted-2">Path</th>
                      <th class="px-3 py-2 text-right text-[10px] font-medium uppercase tracking-wider text-muted-2">Views</th>
                      <th class="px-3 py-2 text-right text-[10px] font-medium uppercase tracking-wider text-muted-2">Visitors</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (row of traffic()!.topPages; track row.path) {
                      <tr class="border-b border-hairline last:border-b-0 hover:bg-surface-2/50">
                        <td class="px-3 py-2 font-mono text-xs text-foreground">{{ row.path }}</td>
                        <td class="px-3 py-2 text-right tabular-nums text-foreground">{{ row.views.toLocaleString() }}</td>
                        <td class="px-3 py-2 text-right tabular-nums text-muted">{{ row.visitors.toLocaleString() }}</td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            } @else {
              <p class="mt-3 rounded-md border border-hairline bg-surface-2/50 px-3 py-6 text-center text-xs text-muted">
                No traffic data yet. Events will appear as users browse.
              </p>
            }
          </div>
        }
      }
    </div>
  `,
})
export class AdminOverviewComponent implements OnInit, OnDestroy {
  private readonly api = inject(AdminApiService);

  readonly data = signal<AdminOverview | null>(null);
  readonly traffic = signal<{ topPages: TrafficRow[] } | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

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
    this.error.set(null);

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

  statCards(d: AdminOverview): StatCard[] {
    return [
      { label: 'Live users', icon: 'activity', color: 'green', value: d.liveUsers, hint: 'Active in last 45s' },
      { label: 'Tenants', icon: 'users', color: 'violet', value: d.tenants.total, hint: `+${d.tenants.new24h} in 24h` },
      { label: 'Users', icon: 'user', color: 'cyan', value: d.users.total, hint: `+${d.users.new24h} in 24h` },
      { label: 'Workflows', icon: 'workflow', color: 'cyan', value: d.workflows.total, hint: `${d.workflows.active} active` },
      { label: 'Events (24h)', icon: 'inbox', color: 'violet', value: d.events.last24h.toLocaleString(), hint: `${d.events.last7d.toLocaleString()} in 7d` },
      { label: 'Deliveries (7d)', icon: 'send', color: 'green', value: d.deliveries.last7d.toLocaleString() },
      { label: 'DLQ total', icon: 'alert-triangle', color: d.deliveries.dlqTotal > 0 ? 'rose' : 'green', value: d.deliveries.dlqTotal },
      { label: 'Snapshot', icon: 'clock', color: 'amber', value: new Date(d.timestamp).toLocaleString() },
    ];
  }

  statIconBg(color: StatCard['color']): string {
    switch (color) {
      case 'violet': return 'bg-relay-violet/15 text-relay-violet';
      case 'cyan': return 'bg-relay-cyan/15 text-relay-cyan';
      case 'green': return 'bg-signal-green/15 text-signal-green';
      case 'amber': return 'bg-signal-amber/15 text-signal-amber';
      case 'rose': return 'bg-signal-rose/15 text-signal-rose';
    }
  }
}