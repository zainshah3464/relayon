import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import {
  AnalyticsService,
  Overview,
  DeliveryStats,
  CostAnalytics,
  TimeSeriesResponse,
} from '../../core/api/analytics.service';
import { QuotaService, QuotaSnapshot } from '../../core/api/quota.service';
import { TimeSeriesChartComponent } from '../../shared/charts/time-series-chart.component';
import { IconComponent, type IconName } from '../../shared/ui/icon/icon.component';

type Range = '24h' | '7d' | '30d';

interface StatCard {
  key: 'events24h' | 'events7d' | 'successRate' | 'dlq';
  labelKey: string;
  icon: IconName;
  route: string;
}

@Component({
  selector: 'app-analytics',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    TranslocoModule,
    TimeSeriesChartComponent,
    IconComponent,
  ],
  template: `
    <div class="space-y-5">
      <!-- ═══════════════ HEADER ═══════════════ -->
      <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 class="text-2xl font-bold tracking-tighter text-foreground sm:text-3xl">
            {{ 'analytics.title' | transloco }}
          </h1>
          <p class="mt-1 text-sm text-muted">
            {{ 'analytics.subtitle' | transloco }}
          </p>
        </div>

        <div class="flex shrink-0 gap-1 rounded-lg border border-hairline bg-surface p-1">
          @for (r of ranges; track r) {
            <button
              type="button"
              (click)="setRange(r)"
              [class.bg-relay-violet]="range() === r"
              [class.text-white]="range() === r"
              [class.text-muted]="range() !== r"
              [class.hover:text-foreground]="range() !== r"
              class="rounded-md px-2.5 py-1 text-xs font-medium transition-colors"
            >
              {{ r }}
            </button>
          }
        </div>
      </div>

      @if (loading()) {
        <!-- Skeleton -->
        <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          @for (i of [1, 2, 3, 4]; track i) {
            <div class="card">
              <div class="skeleton h-3 w-20"></div>
              <div class="skeleton mt-3 h-8 w-16"></div>
            </div>
          }
        </div>
        <div class="card">
          <div class="skeleton h-4 w-32"></div>
          <div class="skeleton mt-4 h-48 w-full"></div>
        </div>
      } @else if (error()) {
        <div class="card flex items-center gap-3 border-signal-rose/30 bg-signal-rose/[0.06]">
          <app-icon name="x-circle" [size]="20" [strokeWidth]="2" class="text-signal-rose" />
          <p class="flex-1 text-sm font-medium text-signal-rose">{{ error() | transloco }}</p>
          <button type="button" (click)="load()" class="btn-secondary text-xs">
            <app-icon name="refresh" [size]="12" [strokeWidth]="2.5" />
            <span>Retry</span>
          </button>
        </div>
      } @else {
        <!-- ═══ STAT CARDS ═══ -->
        @if (overview(); as o) {
          <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            @for (card of statCards; track card.key) {
              <a [routerLink]="card.route" class="card-interactive group block">
                <div class="flex items-center gap-2">
                  <app-icon
                    [name]="card.icon"
                    [size]="14"
                    [strokeWidth]="2"
                    class="text-muted transition-colors group-hover:text-foreground"
                  />
                  <p class="text-[11px] font-medium uppercase tracking-wider text-muted">
                    {{ card.labelKey | transloco }}
                  </p>
                </div>
                <p
                  class="mt-2 text-3xl font-bold tabular-nums tracking-tight"
                  [ngClass]="statValueClass(card.key, o)"
                >
                  {{ statValue(card.key, o) }}
                </p>
              </a>
            }
          </div>
        }

        <!-- ═══ TIME SERIES CHART ═══ -->
        @if (series(); as s) {
          <app-time-series-chart
            [title]="'analytics.chart.title' | transloco"
            [subtitle]="'analytics.chart.subtitle' | transloco"
            [data]="s.buckets"
          />
        }

        <!-- ═══ COST ═══ -->
        @if (cost(); as c) {
          <div class="card">
            <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div class="flex items-start gap-3">
                <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-signal-green/10 text-signal-green">
                  <app-icon name="trending-up" [size]="18" [strokeWidth]="2" />
                </div>
                <div>
                  <h2 class="text-sm font-semibold text-foreground">
                    {{ 'analytics.cost.title' | transloco }}
                    <span class="font-mono text-xs text-muted">({{ c.windowDays }}d)</span>
                  </h2>
                  <p class="mt-0.5 text-xs text-muted">
                    {{ 'analytics.cost.subtitle' | transloco }}
                  </p>
                </div>
              </div>

              <div class="text-right">
                <p class="text-2xl font-bold tabular-nums text-signal-green">\${{ c.cost.totalUsd }}</p>
                <p class="mt-0.5 text-[11px] text-muted">
                  {{ 'analytics.cost.groq' | transloco }} \${{ c.cost.groqUsd }}
                  <span class="mx-1 text-muted-2">·</span>
                  {{ 'analytics.cost.redis' | transloco }} \${{ c.cost.redisUsd }}
                </p>
              </div>
            </div>

            @if (c.perDestination.length > 0) {
              <div class="mt-4 -mx-4 overflow-x-auto sm:mx-0 sm:rounded-lg sm:border sm:border-hairline">
                <table class="w-full min-w-[640px] text-sm">
                  <thead class="bg-surface-2/50">
                    <tr>
                      <th class="px-3 py-2 text-left text-[10px] font-medium uppercase tracking-wider text-muted-2">
                        {{ 'analytics.cost.destination' | transloco }}
                      </th>
                      <th class="px-3 py-2 text-right text-[10px] font-medium uppercase tracking-wider text-muted-2">
                        {{ 'analytics.cost.deliveries' | transloco }}
                      </th>
                      <th class="px-3 py-2 text-right text-[10px] font-medium uppercase tracking-wider text-muted-2">
                        {{ 'analytics.cost.attempts' | transloco }}
                      </th>
                      <th class="px-3 py-2 text-right text-[10px] font-medium uppercase tracking-wider text-muted-2">
                        {{ 'analytics.cost.retryRate' | transloco }}
                      </th>
                      <th class="px-3 py-2 text-right text-[10px] font-medium uppercase tracking-wider text-muted-2">
                        {{ 'analytics.cost.estCost' | transloco }}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (row of c.perDestination; track row.destinationId) {
                      <tr class="border-t border-hairline transition-colors hover:bg-surface-2/30">
                        <td class="px-3 py-2.5">
                          <div class="flex items-center gap-1.5">
                            <span class="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] text-relay-cyan">{{ row.destinationType }}</span>
                            <span class="font-mono text-[11px] text-muted">{{ row.destinationId.slice(0, 8) }}</span>
                          </div>
                        </td>
                        <td class="px-3 py-2.5 text-right tabular-nums text-foreground">{{ row.totalDeliveries }}</td>
                        <td class="px-3 py-2.5 text-right tabular-nums text-foreground">{{ row.totalAttempts }}</td>
                        <td class="px-3 py-2.5 text-right tabular-nums">
                          <span [class.text-signal-amber]="row.retryRate > 20" [class.text-muted]="row.retryRate <= 20">
                            {{ row.retryRate }}%
                          </span>
                        </td>
                        <td class="px-3 py-2.5 text-right tabular-nums text-muted">\${{ row.estimatedRedisCostUsd }}</td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            }
          </div>
        }

        <!-- ═══ USAGE ═══ -->
        @if (quota(); as q) {
          <div class="card">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <app-icon name="gauge" [size]="15" [strokeWidth]="2" class="text-muted" />
                <h2 class="text-sm font-semibold text-foreground">
                  {{ 'analytics.usage.title' | transloco }}
                </h2>
              </div>
              <span class="rounded-md bg-surface-2 px-2 py-0.5 font-mono text-[10px] text-muted">
                {{ q.period }}
              </span>
            </div>

            <div class="mt-4 space-y-4">
              @for (key of quotaKeys; track key) {
                @if (q.metrics[key]; as m) {
                  <div>
                    <div class="flex items-baseline justify-between gap-2">
                      <span class="text-xs font-medium capitalize text-foreground">
                        {{ key.split('_').join(' ') }}
                      </span>
                      <span class="font-mono text-xs tabular-nums text-foreground">
                        {{ formatNumber(m.used) }}
                        <span class="text-muted-2">/ {{ formatNumber(m.limit) }}</span>
                      </span>
                    </div>
                    <div
                      class="mt-2 h-2 overflow-hidden rounded-full bg-surface-3"
                      role="progressbar"
                      [attr.aria-valuenow]="percentOf(m)"
                      aria-valuemin="0"
                      aria-valuemax="100"
                    >
                      <div
                        class="h-full rounded-full transition-all duration-500 ease-out"
                        [ngClass]="barColor(percentOf(m))"
                        [style.width.%]="percentOf(m)"
                      ></div>
                    </div>
                    <p class="mt-1.5 text-[11px] text-muted-2">
                      {{ percentOf(m) }}% used
                      <span class="mx-1.5 text-muted-2">·</span>
                      {{ 'analytics.usage.resets' | transloco }} {{ m.resetAt | date: 'mediumDate' }}
                    </p>
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
  private readonly svc = inject(AnalyticsService);
  private readonly quotaSvc = inject(QuotaService);

  readonly ranges: Range[] = ['24h', '7d', '30d'];
  readonly quotaKeys: Array<'events' | 'ai_tokens' | 'deliveries'> = [
    'events',
    'ai_tokens',
    'deliveries',
  ];

  readonly statCards: StatCard[] = [
    { key: 'events24h', labelKey: 'analytics.stats.events24h', icon: 'activity', route: '/events' },
    { key: 'events7d', labelKey: 'analytics.stats.events7d', icon: 'trending-up', route: '/events' },
    { key: 'successRate', labelKey: 'analytics.stats.successRate', icon: 'check-circle', route: '/workflows' },
    { key: 'dlq', labelKey: 'analytics.stats.dlq', icon: 'alert-triangle', route: '/dlq' },
  ];

  readonly range = signal<Range>('24h');
  readonly overview = signal<Overview | null>(null);
  readonly delivery = signal<DeliveryStats | null>(null);
  readonly cost = signal<CostAnalytics | null>(null);
  readonly series = signal<TimeSeriesResponse | null>(null);
  readonly quota = signal<QuotaSnapshot | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  private pendingRequests = 0;

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

    this.pendingRequests = 5;

    this.svc.overview().subscribe({
      next: (o) => {
        this.overview.set(o);
        this.resolveOne();
      },
      error: (err) => {
        this.error.set(err?.error?.message ?? 'analytics.errors.overviewFailed');
        this.resolveOne();
      },
    });

    this.svc.delivery().subscribe({
      next: (d) => {
        this.delivery.set(d);
        this.resolveOne();
      },
      error: () => this.resolveOne(),
    });

    this.svc.cost().subscribe({
      next: (c) => {
        this.cost.set(c);
        this.resolveOne();
      },
      error: () => this.resolveOne(),
    });

    this.quotaSvc.snapshot().subscribe({
      next: (q) => {
        this.quota.set(q);
        this.resolveOne();
      },
      error: () => this.resolveOne(),
    });

    this.loadSeries();
  }

  private loadSeries(): void {
    this.svc.timeSeries(this.range()).subscribe({
      next: (s) => {
        this.series.set(s);
        if (this.pendingRequests > 0) this.resolveOne();
      },
      error: (err) => {
        this.error.set(
          err?.error?.message ?? 'analytics.errors.timeSeriesFailed',
        );
        if (this.pendingRequests > 0) this.resolveOne();
      },
    });
  }

  private resolveOne(): void {
    this.pendingRequests--;
    if (this.pendingRequests <= 0) {
      this.loading.set(false);
    }
  }

  statValue(key: StatCard['key'], o: Overview): string {
    switch (key) {
      case 'events24h':
        return this.formatNumber(o.events24h);
      case 'events7d':
        return this.formatNumber(o.events7d);
      case 'successRate':
        return o.deliveries.successRate !== null
          ? `${o.deliveries.successRate}%`
          : '—';
      case 'dlq':
        return this.formatNumber(o.deliveries.dlq);
    }
  }

  statValueClass(key: StatCard['key'], o: Overview): string {
    if (key === 'successRate') {
      const v = o.deliveries.successRate;
      if (v === null) return 'text-muted-2';
      if (v >= 95) return 'text-signal-green';
      if (v >= 80) return 'text-signal-amber';
      return 'text-signal-rose';
    }
    if (key === 'dlq') {
      return o.deliveries.dlq > 0 ? 'text-signal-rose' : 'text-foreground';
    }
    return 'text-foreground';
  }

  percentOf(m: { used: number; limit: number }): number {
    return Math.min(100, Math.round((m.used / Math.max(m.limit, 1)) * 100));
  }

  barColor(percent: number): string {
    if (percent >= 95) return 'bg-signal-rose';
    if (percent >= 80) return 'bg-signal-amber';
    return 'bg-relay-violet';
  }

  formatNumber(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return n.toLocaleString();
  }
}