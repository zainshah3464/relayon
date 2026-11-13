import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AdminApiService, type AdminHealth } from '../../core/admin/admin.service';

@Component({
  selector: 'app-admin-health',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="space-y-6">
      <div>
        <h1 class="text-2xl font-bold text-white">System health</h1>
        <p class="text-sm text-muted mt-1">Services and queue depth — refreshes every 10s</p>
      </div>

      @if (data(); as d) {
        <div class="grid gap-4 sm:grid-cols-3">
          <div class="card">
            <p class="text-xs uppercase text-muted">Postgres</p>
            <p class="text-2xl font-bold mt-1" [class.text-signal-green]="d.services.postgres === 'up'" [class.text-signal-rose]="d.services.postgres !== 'up'">{{ d.services.postgres }}</p>
          </div>
          <div class="card">
            <p class="text-xs uppercase text-muted">MongoDB</p>
            <p class="text-2xl font-bold mt-1" [class.text-signal-green]="d.services.mongo === 'up'" [class.text-signal-rose]="d.services.mongo !== 'up'">{{ d.services.mongo }}</p>
          </div>
          <div class="card">
            <p class="text-xs uppercase text-muted">Redis</p>
            <p class="text-2xl font-bold mt-1" [class.text-signal-green]="d.services.redis === 'up'" [class.text-signal-rose]="d.services.redis !== 'up'">{{ d.services.redis }}</p>
          </div>
        </div>

        <div class="card">
          <h2 class="text-lg font-semibold text-white mb-3">Queue depth</h2>
          <div class="grid grid-cols-3 gap-4">
            <div>
              <p class="text-xs uppercase text-muted">Incoming</p>
              <p class="text-2xl font-bold text-white mt-1">{{ d.queues.incoming }}</p>
            </div>
            <div>
              <p class="text-xs uppercase text-muted">Processing</p>
              <p class="text-2xl font-bold text-white mt-1">{{ d.queues.processing }}</p>
            </div>
            <div>
              <p class="text-xs uppercase text-muted">Egress</p>
              <p class="text-2xl font-bold text-white mt-1">{{ d.queues.egress }}</p>
            </div>
          </div>
        </div>

        <p class="text-xs text-muted">Last checked {{ d.timestamp | date: 'medium' }}</p>
      } @else {
        <div class="card text-sm text-muted">Loading health...</div>
      }
    </div>
  `,
})
export class AdminHealthComponent implements OnInit, OnDestroy {
  private api = inject(AdminApiService);
  data = signal<AdminHealth | null>(null);
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
      next: (d) => this.data.set(d),
      error: () => this.data.set(null),
    });
  }
}