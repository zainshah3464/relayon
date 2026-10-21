import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { AnalyticsService, Overview } from '../../core/api/analytics.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="space-y-8">
      <div>
        <p class="text-xs font-medium uppercase tracking-widest text-relay-cyan">
          {{ auth.user()?.tenantName }}
        </p>
        <h1 class="mt-1 text-3xl font-bold tracking-tightest text-white">
          Welcome, {{ auth.displayName() }}
        </h1>
        <p class="mt-1 text-sm text-muted">
          Here's what's happening with your webhook pipelines today.
        </p>
      </div>

      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div class="card">
          <p class="text-xs font-medium uppercase tracking-wider text-muted">Events (24h)</p>
          <p class="mt-2 text-2xl font-bold text-white">{{ stats()?.events24h ?? '—' }}</p>
        </div>
        <div class="card">
          <p class="text-xs font-medium uppercase tracking-wider text-muted">Success rate</p>
          <p class="mt-2 text-2xl font-bold text-signal-green">
            {{ stats()?.deliveries?.successRate !== null && stats()?.deliveries?.successRate !== undefined ? stats()!.deliveries.successRate + '%' : '—' }}
          </p>
        </div>
        <div class="card">
          <p class="text-xs font-medium uppercase tracking-wider text-muted">Pending deliveries</p>
          <p class="mt-2 text-2xl font-bold text-white">{{ stats()?.deliveries?.pending ?? 0 }}</p>
        </div>
        <div class="card">
          <p class="text-xs font-medium uppercase tracking-wider text-muted">DLQ entries</p>
          <p class="mt-2 text-2xl font-bold" [class.text-signal-rose]="(stats()?.deliveries?.dlq ?? 0) > 0" [class.text-white]="(stats()?.deliveries?.dlq ?? 0) === 0">
            {{ stats()?.deliveries?.dlq ?? 0 }}
          </p>
        </div>
      </div>

      <div class="grid gap-4 md:grid-cols-2">
        <a routerLink="/workflows" class="card block hover:bg-surface-2 transition">
          <div class="flex items-center gap-3">
            <div class="text-2xl">🔄</div>
            <div>
              <h3 class="text-white font-medium">Workflows</h3>
              <p class="text-xs text-muted">Create and manage webhook pipelines</p>
            </div>
          </div>
        </a>
        <a routerLink="/events" class="card block hover:bg-surface-2 transition">
          <div class="flex items-center gap-3">
            <div class="text-2xl">📨</div>
            <div>
              <h3 class="text-white font-medium">Event explorer</h3>
              <p class="text-xs text-muted">Inspect any webhook's full lifecycle</p>
            </div>
          </div>
        </a>
      </div>

      @if (stats(); as s) {
        @if (s.deliveries.dlq > 0) {
          <a routerLink="/dlq" class="block rounded-xl border border-signal-rose/30 bg-signal-rose/5 p-4 hover:bg-signal-rose/10">
            <p class="text-sm text-signal-rose">
              <strong>{{ s.deliveries.dlq }} deliveries</strong> in Dead Letter Queue — click to review and replay.
            </p>
          </a>
        }
      }
    </div>
  `,
})
export class DashboardComponent implements OnInit {
  auth = inject(AuthService);
  private analytics = inject(AnalyticsService);

  stats = signal<Overview | null>(null);

  readonly hasData = computed(() => (this.stats()?.events24h ?? 0) > 0);

  ngOnInit(): void {
    this.analytics.overview().subscribe({
      next: (o) => this.stats.set(o),
      error: () => this.stats.set(null),
    });
  }
}