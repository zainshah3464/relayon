import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  AnalyticsService,
  Overview,
  DeliveryStats,
  CostAnalytics,
  TimeSeriesResponse,
} from '../../core/api/analytics.service';
import { QuotaService, QuotaSnapshot } from '../../core/api/quota.service';
import { TimeSeriesChartComponent } from '../../shared/charts/time-series-chart.component';

type Range = '24h' | '7d' | '30d';

@Component({
  selector: 'app-analytics',
  standalone: true,
  imports: [CommonModule, TimeSeriesChartComponent],
  template: `
    <div class="space-y-6">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold tracking-tightest text-white">Analytics</h1>
          <p class="text-sm text-muted mt-1">Event volume, delivery health, latency, and estimated costs.</p>
        </div>
        <div class="flex gap-1">
          @for (r of ranges; track r) {
            <button
              (click)="setRange(r)"
              class="px-3 py-1 rounded text-xs"
              [class.bg-relay-violet]="range() === r"
              [class.text-white]="range() === r"
              [class.text-muted]="range() !== r"
              [class.hover:bg-surface-2]="range() !== r"
            >{{ r }}</button>
          }
        </div>
      </div>

      @if (loading()) {
        <div class="card text-sm text-muted">Loading analytics...</div>
      } @else if (error()) {
        <div class="card text-sm text-signal-rose">{{ error() }}</div>
      } @else {
        @if (series(); as s) {
          <app-time-series-chart
            title="Events & deliveries"
            subtitle="Hourly / daily buckets — hover any point for details"
            [data]="s.buckets"
          />
        }

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
                <p class="text-2xl font-bold text-signal-green">&#36;{{ c.cost.totalUsd }}</p>
                <p class="text-xs text-muted">Groq &#36;{{ c.cost.groqUsd }} · Redis &#36;{{ c.cost.redisUsd }}</p>
              </div>
            </div>
            @if (c.perDestination.length > 0) {
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
                      <td class="py-2 text-right" [class.text-signal-amber]="row.retryRate > 20" [class.text-muted]="row.retryRate <= 20">{{ row.retryRate }}%</td>
                      <td class="py-2 text-right text-muted">&#36;{{ row.estimatedRedisCostUsd }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            }
          </div>
        }

        @if (quota(); as q) {
          <div class="card">
            <h2 class="text-lg font-semibold text-white mb-4">Usage — {{ q.period }}</h2>
            <div class="space-y-3">
              @for (key of quotaKeys; track key) {
                @if (q.metrics[key]; as m) {
                  <div>
                    <div class="flex justify-between text-xs mb-1">
                      <span class="text-white font-medium capitalize">{{ key.split('_').join(' ') }}</span>
                      <span class="text-muted">{{ m.used }} / {{ m.limit }}</span>
                    </div>
                    <div class="h-2 rounded-full bg-surface-2 overflow-hidden">
                      <div
                        class="h-full transition-all"
                        [class.bg-signal-green]="m.used / m.limit < 0.7"
                        [class.bg-signal-amber]="m.used / m.limit >= 0.7 && m.used / m.limit < 0.9"
                        [class.bg-signal-rose]="m.used / m.limit >= 0.9"
                        [style.width.%]="Math.min(100, (m.used / Math.max(m.limit, 1)) * 100)"
                      ></div>
                    </div>
                    <p class="text-xs text-muted mt-1">Resets {{ m.resetAt | date: 'mediumDate' }}</p>
                  </div>
                }
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
  private quotaSvc = inject(QuotaService);

  readonly Math = Math;
  readonly ranges: Range[] = ['24h', '7d', '30d'];
  readonly quotaKeys: Array<'events' | 'ai_tokens' | 'deliveries'> = [
    'events',
    'ai_tokens',
    'deliveries',
  ];

  range = signal<Range>('24h');

  overview = signal<Overview | null>(null);
  delivery = signal<DeliveryStats | null>(null);
  cost = signal<CostAnalytics | null>(null);
  series = signal<TimeSeriesResponse | null>(null);
  quota = signal<QuotaSnapshot | null>(null);
  loading = signal(true);
  error = signal<string | null>(null);

  ngOnInit(): void {
    this.load();
  }

  setRange(r: Range): void {
    this.range.set(r);
    this.loadSeries();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);

    this.svc.overview().subscribe({
      next: (o) => {
        this.overview.set(o);
        this.svc.delivery().subscribe({
          next: (d) => {
            this.delivery.set(d);
            this.svc.cost().subscribe({
              next: (c) => {
                this.cost.set(c);
                this.loadQuotaAndSeries();
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

  private loadQuotaAndSeries(): void {
    this.quotaSvc.snapshot().subscribe({
      next: (q) => {
        this.quota.set(q);
        this.loadSeries();
      },
      error: () => {
        this.quota.set(null);
        this.loadSeries();
      },
    });
  }

  private loadSeries(): void {
    this.svc.timeSeries(this.range()).subscribe({
      next: (s) => {
        this.series.set(s);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.error?.message ?? 'Failed to load time-series');
        this.loading.set(false);
      },
    });
  }
}