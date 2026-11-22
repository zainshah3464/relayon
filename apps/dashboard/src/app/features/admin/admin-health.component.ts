import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AdminApiService, type AdminHealth } from '../../core/admin/admin.service';
import { IconComponent } from '../../shared/ui/icon/icon.component';

interface ServiceCard {
  name: string;
  status: string;
  icon: 'database' | 'server' | 'layers';
}

@Component({
  selector: 'app-admin-health',
  standalone: true,
  imports: [CommonModule, IconComponent],
  template: `
    <div class="space-y-4">
      <div class="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 class="text-2xl font-bold tracking-tighter text-foreground">System health</h1>
          <p class="mt-1 text-sm text-muted">Services and queues — auto-refreshes every 10s</p>
        </div>
        <div class="flex items-center gap-2">
          <span class="flex items-center gap-1.5 rounded-full border border-hairline bg-surface px-2.5 py-1">
            <span class="relative flex h-1.5 w-1.5">
              <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-signal-green opacity-75"></span>
              <span class="relative inline-flex h-1.5 w-1.5 rounded-full bg-signal-green"></span>
            </span>
            <span class="text-[11px] font-medium text-signal-green">Live</span>
          </span>
        </div>
      </div>

      @if (loading() && !data()) {
        <div class="grid gap-3 sm:grid-cols-3">
          @for (i of [1, 2, 3]; track i) {
            <div class="card"><div class="skeleton h-4 w-20"></div><div class="skeleton mt-3 h-7 w-16"></div></div>
          }
        </div>
      } @else if (data()) {
        @if (data(); as d) {
          <!-- Services -->
          <div class="grid gap-3 sm:grid-cols-3">
            @for (s of services(d); track s.name) {
              <div class="card">
                <div class="flex items-center gap-2">
                  <div [ngClass]="statusIconBg(s.status)" class="flex h-8 w-8 items-center justify-center rounded-lg">
                    <app-icon [name]="s.icon" [size]="15" [strokeWidth]="2" />
                  </div>
                  <p class="text-[11px] font-medium uppercase tracking-wider text-muted">{{ s.name }}</p>
                </div>
                <p
                  class="mt-2 flex items-center gap-1.5 text-xl font-bold tracking-tight capitalize"
                  [class.text-signal-green]="s.status === 'up'"
                  [class.text-signal-rose]="s.status !== 'up'"
                >
                  <span
                    class="inline-block h-2 w-2 rounded-full"
                    [class.bg-signal-green]="s.status === 'up'"
                    [class.bg-signal-rose]="s.status !== 'up'"
                    [class.animate-pulse]="s.status !== 'up'"
                  ></span>
                  {{ s.status }}
                </p>
              </div>
            }
          </div>

          <!-- Queues -->
          <div class="card">
            <div class="flex items-center gap-2">
              <app-icon name="layers" [size]="14" [strokeWidth]="2" class="text-muted" />
              <h2 class="text-sm font-semibold text-foreground">Queue depth</h2>
            </div>

            <div class="mt-3 grid grid-cols-3 gap-3">
              <div class="rounded-lg border border-hairline bg-surface-2/50 p-3">
                <p class="text-[10px] font-medium uppercase tracking-wider text-muted-2">Incoming</p>
                <p class="mt-1 font-mono text-2xl font-bold tabular-nums text-foreground">{{ d.queues.incoming.toLocaleString() }}</p>
              </div>
              <div class="rounded-lg border border-hairline bg-surface-2/50 p-3">
                <p class="text-[10px] font-medium uppercase tracking-wider text-muted-2">Processing</p>
                <p class="mt-1 font-mono text-2xl font-bold tabular-nums text-foreground">{{ d.queues.processing.toLocaleString() }}</p>
              </div>
              <div class="rounded-lg border border-hairline bg-surface-2/50 p-3">
                <p class="text-[10px] font-medium uppercase tracking-wider text-muted-2">Egress</p>
                <p class="mt-1 font-mono text-2xl font-bold tabular-nums text-foreground">{{ d.queues.egress.toLocaleString() }}</p>
              </div>
            </div>
          </div>

          <p class="text-center text-[11px] text-muted-2">
            <app-icon name="clock" [size]="10" [strokeWidth]="2" class="mr-1 inline" />
            Last checked {{ d.timestamp | date: 'medium' }}
          </p>
        }
      } @else {
        <div class="card flex items-center gap-3 border-signal-rose/30 bg-signal-rose/[0.06]">
          <app-icon name="x-circle" [size]="18" [strokeWidth]="2" class="text-signal-rose" />
          <p class="flex-1 text-sm text-signal-rose">Could not reach health endpoint</p>
        </div>
      }
    </div>
  `,
})
export class AdminHealthComponent implements OnInit, OnDestroy {
  private readonly api = inject(AdminApiService);

  readonly data = signal<AdminHealth | null>(null);
  readonly loading = signal(true);

  private timer: ReturnType<typeof setInterval> | null = null;

  ngOnInit(): void {
    this.load();
    this.timer = setInterval(() => this.load(), 10_000);
  }

  ngOnDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  load(): void {
    this.api.health().subscribe({
      next: (d) => {
        this.data.set(d);
        this.loading.set(false);
      },
      error: () => {
        this.data.set(null);
        this.loading.set(false);
      },
    });
  }

  services(d: AdminHealth): ServiceCard[] {
    return [
      { name: 'Postgres', status: d.services.postgres, icon: 'database' },
      { name: 'MongoDB', status: d.services.mongo, icon: 'database' },
      { name: 'Redis', status: d.services.redis, icon: 'server' },
    ];
  }

  statusIconBg(status: string): string {
    return status === 'up'
      ? 'bg-signal-green/12 text-signal-green'
      : 'bg-signal-rose/12 text-signal-rose';
  }
}