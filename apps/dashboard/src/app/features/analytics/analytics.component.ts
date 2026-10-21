import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  AnalyticsService,
  Overview,
  DeliveryStats,
} from '../../core/api/analytics.service';

@Component({
  selector: 'app-analytics',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="space-y-6">
      <div>
        <h1 class="text-2xl font-bold tracking-tightest text-white">Analytics</h1>
        <p class="text-sm text-muted mt-1">Event volume, delivery health, and latency.</p>
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

        @if (delivery(); as d) {
          <div class="card">
            <h2 class="text-lg font-semibold text-white mb-4">Deliveries by destination (24h)</h2>
            @if (d.byDestination.length === 0) {
              <p class="text-sm text-muted">No deliveries in the last 24 hours.</p>
            } @else {
              <table class="w-full text-sm">
                <thead class="text-xs uppercase text-muted">
                  <tr>
                    <th class="text-left pb-2">Destination</th>
                    <th class="text-right pb-2">Total</th>
                    <th class="text-right pb-2">Delivered</th>
                    <th class="text-right pb-2">DLQ</th>
                    <th class="text-right pb-2">Avg latency</th>
                  </tr>
                </thead>
                <tbody>
                  @for (row of d.byDestination; track row._id) {
                    <tr class="border-t border-hairline">
                      <td class="py-2 font-mono text-xs text-white">{{ row.destinationType }} · {{ row._id.slice(0, 8) }}</td>
                      <td class="py-2 text-right text-white">{{ row.total }}</td>
                      <td class="py-2 text-right text-signal-green">{{ row.delivered }}</td>
                      <td class="py-2 text-right" [class.text-signal-rose]="row.dlq > 0" [class.text-muted]="row.dlq === 0">{{ row.dlq }}</td>
                      <td class="py-2 text-right text-muted">{{ row.avgLatencyMs ? (row.avgLatencyMs | number: '1.0-0') + 'ms' : '—' }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            }
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
            this.loading.set(false);
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