import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  AnalyticsService,
  Overview,
  DeliveryStats,
  CostAnalytics,
} from '../../core/api/analytics.service';

@Component({
  selector: 'app-analytics',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="space-y-6">
      <div>
        <h1 class="text-2xl font-bold tracking-tightest text-white">Analytics</h1>
        <p class="text-sm text-muted mt-1">Event volume, delivery health, latency, and estimated costs.</p>
      </div>

      @if (loading()) {
        <div class="card text-sm text-muted">Loading analytics...</div>
      } @else if (error()) {
        <div class="card text-sm text-signal-rose">{{ error() }}</div>
      } @else {
        @if (overview(); as o) {
          <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div class="card">
              <p class="text-xs uppercase text-muted">Events (24h)</p>
              <p class="text-2xl font-bold text-white mt-1">{{ o.events24h }}</p>
            </div>
            <div class="card">
              <p class="text-xs uppercase text-muted">Events (7d)</p>
              <p class="text-2xl font-bold text-white mt-1">{{ o.events7d }}</p>
            </div>
            <div class="card">
              <p class="text-xs uppercase text-muted">Success rate</p>
              <p class="text-2xl font-bold text-signal-green mt-1">
                {{ o.deliveries.successRate !== null ? o.deliveries.successRate + '%' : '—' }}
              </p>
            </div>
            <div class="card">
              <p class="text-xs uppercase text-muted">DLQ</p>
              <p class="text-2xl font-bold mt-1" [class.text-signal-rose]="o.deliveries.dlq > 0" [class.text-white]="o.deliveries.dlq === 0">
                {{ o.deliveries.dlq }}
              </p>
            </div>
          </div>
        }

        @if (cost(); as c) {
          <div class="card">
            <div class="flex justify-between items-start mb-4">
              <div>
                <h2 class="text-lg font-semibold text-white">Estimated costs ({{ c.windowDays }}d)</h2>
                <p class="text-xs text-muted mt-1">Approximation based on payload size and delivery attempts.</p>
              </div>
              <div class="text-right">
                <p class="text-2xl font-bold text-signal-green">\${{ c.cost.totalUsd }}</p>
                <p class="text-xs text-muted">Groq \${{ c.cost.groqUsd }} · Redis \${{ c.cost.redisUsd }}</p>
              </div>
            </div>

            <div class="grid grid-cols-3 gap-4 mb-4">
              <div class="bg-surface-2 p-3 rounded">
                <p class="text-xs uppercase text-muted">Events</p>
                <p class="text-xl font-bold text-white">{{ c.events.total }}</p>
              </div>
              <div class="bg-surface-2 p-3 rounded">
                <p class="text-xs uppercase text-muted">Enriched</p>
                <p class="text-xl font-bold text-white">{{ c.events.enriched }}</p>
                <p class="text-xs text-muted">{{ c.events.cacheHits }} cache hits</p>
              </div>
              <div class="bg-surface-2 p-3 rounded">
                <p class="text-xs uppercase text-muted">~Tokens</p>
                <p class="text-xl font-bold text-white">{{ c.events.estimatedTokens.toLocaleString() }}</p>
              </div>
            </div>

            @if (c.perDestination.length === 0) {
              <p class="text-sm text-muted">No deliveries in the last {{ c.windowDays }} days.</p>
            } @else {
              <table class="w-full text-sm">
                <thead class="text-xs uppercase text-muted">
                  <tr>
                    <th class="text-left pb-2">Destination</th>
                    <th class="text-right pb-2">Deliveries</th>
                    <th class="text-right pb-2">Attempts</th>
                    <th class="text-right pb-2">Retry rate</th>
                    <th class="text-right pb-2">Est. cost</th>
                  </tr>
                </thead>
                <tbody>
                  @for (row of c.perDestination; track row.destinationId) {
                    <tr class="border-t border-hairline">
                      <td class="py-2 font-mono text-xs text-white">{{ row.destinationType }} · {{ row.destinationId.slice(0, 8) }}</td>
                      <td class="py-2 text-right text-white">{{ row.totalDeliveries }}</td>
                      <td class="py-2 text-right text-white">{{ row.totalAttempts }}</td>
                      <td class="py-2 text-right" [class.text-signal-amber]="row.retryRate > 20" [class.text-muted]="row.retryRate <= 20">
                        {{ row.retryRate }}%
                      </td>
                      <td class="py-2 text-right text-muted">\${{ row.estimatedRedisCostUsd }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            }

            <div class="mt-3 text-xs text-muted space-y-1">
              @for (note of c.notes; track note) {
                <p>· {{ note }}</p>
              }
            </div>
          </div>
        }
      }
    </div>
  `,
})
export class AnalyticsComponent implements OnInit {
  private svc = inject(AnalyticsService);

  overview = signal<Overview | null>(null);
  delivery = signal<DeliveryStats | null>(null);
  cost = signal<CostAnalytics | null>(null);
  loading = signal(true);
  error = signal<string | null>(null);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.svc.overview().subscribe({
      next: (o) => {
        this.overview.set(o);
        this.svc.delivery().subscribe({
          next: (d) => {
            this.delivery.set(d);
            this.svc.cost().subscribe({
              next: (c) => {
                this.cost.set(c);
                this.loading.set(false);
              },
              error: (err) => {
                this.error.set(err?.error?.message ?? 'Failed to load cost analytics');
                this.loading.set(false);
              },
            });
          },
          error: (err) => {
            this.error.set(err?.error?.message ?? 'Failed to load delivery stats');
            this.loading.set(false);
          },
        });
      },
      error: (err) => {
        this.error.set(err?.error?.message ?? 'Failed to load overview');
        this.loading.set(false);
      },
    });
  }
}