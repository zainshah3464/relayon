import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { AuthService } from '../../core/auth/auth.service';
import { AnalyticsService, Overview } from '../../core/api/analytics.service';
import { QuotaService, QuotaSnapshot } from '../../core/api/quota.service';
import { AnnouncementsWidgetComponent } from '../community/announcements-widget.component';
import { IconComponent, type IconName } from '../../shared/ui/icon/icon.component';

interface StatCard {
  key: 'events24h' | 'successRate' | 'pending' | 'dlq';
  labelKey: string;
  icon: IconName;
  route: string;
}

interface OnboardingStep {
  num: number;
  title: string;
  desc: string;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    TranslocoModule,
    AnnouncementsWidgetComponent,
    IconComponent,
  ],
  template: `
    <div class="space-y-5 sm:space-y-6">
      <!-- ═══════════════ HEADER ═══════════════ -->
      <div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div class="min-w-0">
          <p class="text-[11px] font-medium uppercase tracking-widest text-relay-cyan">
            {{ auth.user()?.tenantName }}
          </p>
          <h1 class="mt-1 text-2xl font-bold tracking-tighter text-foreground sm:text-3xl">
            {{ 'dashboard.welcome' | transloco: { name: firstName() } }}
          </h1>
          <p class="mt-1 text-sm text-muted">
            {{ 'dashboard.subtitle' | transloco }}
          </p>
        </div>

        <div class="flex shrink-0 gap-2">
          <button
            type="button"
            (click)="refresh()"
            [disabled]="loading()"
            class="btn-secondary"
            aria-label="Refresh data"
          >
            <app-icon
              name="refresh"
              [size]="14"
              [strokeWidth]="2.5"
              [class.animate-spin]="loading()"
            />
            <span class="hidden sm:inline">Refresh</span>
          </button>
          <a routerLink="/workflows" [queryParams]="{ new: '1' }" class="btn-primary">
            <app-icon name="plus" [size]="14" [strokeWidth]="2.5" />
            <span>New workflow</span>
          </a>
        </div>
      </div>

      <!-- ═══════════════ NEW USER BANNER ═══════════════ -->
      @if (isNewUser()) {
        <div class="relative overflow-hidden rounded-xl border border-relay-violet/25 bg-gradient-to-br from-relay-violet/[0.08] via-surface to-relay-cyan/[0.06] p-5 sm:p-6 animate-slide-up">
          <div class="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-relay-violet/20 blur-3xl"></div>
          <div class="absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-relay-cyan/15 blur-3xl"></div>

          <div class="relative flex flex-col gap-4 sm:flex-row sm:items-start">
            <div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-relay-violet to-relay-cyan text-white shadow-md">
              <app-icon name="rocket" [size]="22" [strokeWidth]="2" />
            </div>

            <div class="min-w-0 flex-1">
              <h3 class="text-base font-semibold text-foreground">
                Welcome to Relayon, {{ firstName() }}
              </h3>
              <p class="mt-1 text-sm text-muted">
                Your workspace is live. Get your first webhook flowing in 3 steps:
              </p>

              <ol class="mt-4 grid gap-2 sm:grid-cols-3">
                @for (step of onboardingSteps; track step.num) {
                  <li class="flex items-start gap-2.5 rounded-lg border border-hairline bg-surface-2/60 p-3">
                    <span class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-relay-violet text-[10px] font-bold text-white">
                      {{ step.num }}
                    </span>
                    <div class="min-w-0">
                      <p class="text-xs font-medium leading-tight text-foreground">{{ step.title }}</p>
                      <p class="mt-0.5 text-[11px] leading-tight text-muted">{{ step.desc }}</p>
                    </div>
                  </li>
                }
              </ol>

              <div class="mt-4 flex flex-wrap gap-2">
                <a routerLink="/workflows" class="btn-primary text-xs">
                  Create workflow
                  <app-icon name="arrow-right" [size]="12" [strokeWidth]="2.5" />
                </a>
                <a routerLink="/guide" class="btn-secondary text-xs">
                  Read the guide
                </a>
              </div>
            </div>
          </div>
        </div>
      }

      <!-- ═══════════════ ANNOUNCEMENTS ═══════════════ -->
      <app-announcements-widget />

      <!-- ═══════════════ DLQ ALERT (critical) ═══════════════ -->
      @if (dlqCount() > 0) {
        <a
          routerLink="/dlq"
          class="group flex items-center gap-3 rounded-xl border border-signal-rose/30 bg-signal-rose/[0.06] p-4 transition-colors hover:border-signal-rose/50 hover:bg-signal-rose/[0.1]"
        >
          <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-signal-rose/15 text-signal-rose">
            <app-icon name="alert-triangle" [size]="18" [strokeWidth]="2" />
          </div>
          <div class="min-w-0 flex-1">
            <p class="text-sm font-medium text-signal-rose">
              {{ dlqCount() }} {{ dlqCount() === 1 ? 'delivery' : 'deliveries' }} failed and need attention
            </p>
            <p class="mt-0.5 text-xs text-muted">
              Click to review, replay, or discard failed deliveries.
            </p>
          </div>
          <app-icon
            name="arrow-right"
            [size]="16"
            [strokeWidth]="2"
            class="shrink-0 text-signal-rose transition-transform group-hover:translate-x-1"
          />
        </a>
      }

      <!-- ═══════════════ STATS GRID ═══════════════ -->
      <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        @if (loading()) {
          @for (i of [1, 2, 3, 4]; track i) {
            <div class="card">
              <div class="skeleton h-3 w-20"></div>
              <div class="skeleton mt-3 h-8 w-16"></div>
              <div class="skeleton mt-2 h-2.5 w-24"></div>
            </div>
          }
        } @else {
          @for (card of statCards; track card.key) {
            <a
              [routerLink]="card.route"
              class="card-interactive group block text-left"
            >
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
                [ngClass]="statValueClass(card.key)"
              >
                {{ statValue(card.key) }}
              </p>

              <p class="mt-1 text-[11px] text-muted-2">
                @switch (card.key) {
                  @case ('events24h') {
                    In the last 24 hours
                  }
                  @case ('successRate') {
                    @if (successRateValue() !== null) {
                      Across all destinations
                    } @else {
                      No deliveries yet
                    }
                  }
                  @case ('pending') {
                    Queued for retry
                  }
                  @case ('dlq') {
                    @if (dlqCount() > 0) {
                      Needs attention
                    } @else {
                      All clear
                    }
                  }
                }
              </p>
            </a>
          }
        }
      </div>

      <!-- ═══════════════ USAGE ═══════════════ -->
      @if (loading()) {
        <div class="card">
          <div class="skeleton h-4 w-32"></div>
          <div class="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <div class="skeleton h-3 w-full"></div>
              <div class="skeleton mt-2 h-2 w-full"></div>
            </div>
            <div>
              <div class="skeleton h-3 w-full"></div>
              <div class="skeleton mt-2 h-2 w-full"></div>
            </div>
          </div>
        </div>
      } @else {
        @if (quota(); as q) {
          <div class="card">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <app-icon name="gauge" [size]="15" [strokeWidth]="2" class="text-muted" />
                <h2 class="text-sm font-semibold text-foreground">
                  {{ 'dashboard.monthlyUsage' | transloco }}
                </h2>
              </div>
              <span class="rounded-md bg-surface-2 px-2 py-0.5 font-mono text-[10px] text-muted">
                {{ q.period }}
              </span>
            </div>

            <div class="mt-4 grid gap-5 sm:grid-cols-2">
              <!-- Events usage -->
              <div>
                <div class="flex items-baseline justify-between gap-2">
                  <span class="text-xs font-medium text-muted">
                    {{ 'dashboard.events' | transloco }}
                  </span>
                  <span class="font-mono text-xs tabular-nums text-foreground">
                    {{ formatNumber(q.metrics.events.used) }}
                    <span class="text-muted-2">/ {{ formatNumber(q.metrics.events.limit) }}</span>
                  </span>
                </div>
                <div
                  class="mt-2 h-2 overflow-hidden rounded-full bg-surface-3"
                  role="progressbar"
                  [attr.aria-valuenow]="eventsPercent()"
                  aria-valuemin="0"
                  aria-valuemax="100"
                  [attr.aria-label]="'dashboard.events' | transloco"
                >
                  <div
                    class="h-full rounded-full transition-all duration-500 ease-out"
                    [ngClass]="barColor(eventsPercent())"
                    [style.width.%]="eventsPercent()"
                  ></div>
                </div>
                <p class="mt-1.5 text-[11px] text-muted-2">
                  {{ eventsPercent() }}% used
                  @if (eventsPercent() >= 90) {
                    <span class="ml-1 text-signal-rose">· Almost full</span>
                  } @else if (eventsPercent() >= 80) {
                    <span class="ml-1 text-signal-amber">· Warning</span>
                  }
                </p>
              </div>

              <!-- AI tokens usage -->
              <div>
                <div class="flex items-baseline justify-between gap-2">
                  <span class="text-xs font-medium text-muted">
                    {{ 'dashboard.aiTokens' | transloco }}
                  </span>
                  <span class="font-mono text-xs tabular-nums text-foreground">
                    {{ formatNumber(q.metrics.ai_tokens.used) }}
                    <span class="text-muted-2">/ {{ formatNumber(q.metrics.ai_tokens.limit) }}</span>
                  </span>
                </div>
                <div
                  class="mt-2 h-2 overflow-hidden rounded-full bg-surface-3"
                  role="progressbar"
                  [attr.aria-valuenow]="tokensPercent()"
                  aria-valuemin="0"
                  aria-valuemax="100"
                  [attr.aria-label]="'dashboard.aiTokens' | transloco"
                >
                  <div
                    class="h-full rounded-full transition-all duration-500 ease-out"
                    [ngClass]="barColor(tokensPercent())"
                    [style.width.%]="tokensPercent()"
                  ></div>
                </div>
                <p class="mt-1.5 text-[11px] text-muted-2">
                  {{ tokensPercent() }}% used
                  @if (tokensPercent() >= 90) {
                    <span class="ml-1 text-signal-rose">· Almost full</span>
                  } @else if (tokensPercent() >= 80) {
                    <span class="ml-1 text-signal-amber">· Warning</span>
                  }
                </p>
              </div>
            </div>
          </div>
        }
      }

      <!-- ═══════════════ QUICK LINKS ═══════════════ -->
      <div class="grid gap-3 md:grid-cols-2">
        <a routerLink="/workflows" class="card-interactive group block">
          <div class="flex items-center gap-3">
            <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-relay-violet/10 text-relay-violet">
              <app-icon name="workflow" [size]="18" [strokeWidth]="2" />
            </div>
            <div class="min-w-0 flex-1">
              <h3 class="text-sm font-semibold text-foreground">
                {{ 'dashboard.quickLinks.workflowsTitle' | transloco }}
              </h3>
              <p class="mt-0.5 text-xs text-muted">
                {{ 'dashboard.quickLinks.workflowsDesc' | transloco }}
              </p>
            </div>
            <app-icon
              name="arrow-right"
              [size]="16"
              [strokeWidth]="2"
              class="shrink-0 text-muted transition-all group-hover:translate-x-1 group-hover:text-foreground"
            />
          </div>
        </a>

        <a routerLink="/events" class="card-interactive group block">
          <div class="flex items-center gap-3">
            <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-relay-cyan/10 text-relay-cyan">
              <app-icon name="inbox" [size]="18" [strokeWidth]="2" />
            </div>
            <div class="min-w-0 flex-1">
              <h3 class="text-sm font-semibold text-foreground">
                {{ 'dashboard.quickLinks.eventsTitle' | transloco }}
              </h3>
              <p class="mt-0.5 text-xs text-muted">
                {{ 'dashboard.quickLinks.eventsDesc' | transloco }}
              </p>
            </div>
            <app-icon
              name="arrow-right"
              [size]="16"
              [strokeWidth]="2"
              class="shrink-0 text-muted transition-all group-hover:translate-x-1 group-hover:text-foreground"
            />
          </div>
        </a>
      </div>
    </div>
  `,
})
export class DashboardComponent implements OnInit {
  readonly auth = inject(AuthService);
  private readonly analytics = inject(AnalyticsService);
  private readonly quotaSvc = inject(QuotaService);
  private readonly router = inject(Router);

  readonly loading = signal(true);
  readonly stats = signal<Overview | null>(null);
  readonly quota = signal<QuotaSnapshot | null>(null);

  private pendingRequests = 2;

  readonly statCards: StatCard[] = [
    { key: 'events24h', labelKey: 'dashboard.stats.events24h', icon: 'activity', route: '/events' },
    { key: 'successRate', labelKey: 'dashboard.stats.successRate', icon: 'check-circle', route: '/analytics' },
    { key: 'pending', labelKey: 'dashboard.stats.pendingDeliveries', icon: 'clock', route: '/events' },
    { key: 'dlq', labelKey: 'dashboard.stats.dlqEntries', icon: 'alert-triangle', route: '/dlq' },
  ];

  readonly onboardingSteps: OnboardingStep[] = [
    { num: 1, title: 'Create a workflow', desc: 'Name it and pick your source.' },
    { num: 2, title: 'Copy the webhook URL', desc: 'Paste it in Stripe, GitHub, etc.' },
    { num: 3, title: 'Add a destination', desc: 'Route to Slack, email, or your API.' },
  ];

  readonly firstName = computed(() => {
    const name = this.auth.displayName() || 'there';
    return name.split(' ')[0];
  });

  readonly dlqCount = computed(() => this.stats()?.deliveries?.dlq ?? 0);

  readonly successRateValue = computed(() => {
    const v = this.stats()?.deliveries?.successRate;
    return v === null || v === undefined ? null : v;
  });

  readonly isNewUser = computed(() => {
    const s = this.stats();
    if (!s) return false;
    const d = s.deliveries;
    return (
      s.events24h === 0 &&
      (d?.pending ?? 0) === 0 &&
      (d?.dlq ?? 0) === 0 &&
      (d?.successRate === null || d?.successRate === undefined)
    );
  });

  readonly eventsPercent = computed(() => {
    const q = this.quota();
    if (!q) return 0;
    const { used, limit } = q.metrics.events;
    return Math.min(100, Math.round((used / Math.max(limit, 1)) * 100));
  });

  readonly tokensPercent = computed(() => {
    const q = this.quota();
    if (!q) return 0;
    const { used, limit } = q.metrics.ai_tokens;
    return Math.min(100, Math.round((used / Math.max(limit, 1)) * 100));
  });

  ngOnInit(): void {
    this.load();
  }

  refresh(): void {
    this.loading.set(true);
    this.pendingRequests = 2;
    this.load();
  }

  private load(): void {
    this.analytics.overview().subscribe({
      next: (o) => {
        this.stats.set(o);
        this.resolveOne();
      },
      error: () => {
        this.stats.set(null);
        this.resolveOne();
      },
    });

    this.quotaSvc.snapshot().subscribe({
      next: (q) => {
        this.quota.set(q);
        this.resolveOne();
      },
      error: () => {
        this.quota.set(null);
        this.resolveOne();
      },
    });
  }

  private resolveOne(): void {
    this.pendingRequests--;
    if (this.pendingRequests <= 0) {
      this.loading.set(false);
    }
  }

  statValue(key: StatCard['key']): string {
    const s = this.stats();
    if (!s) return '—';
    switch (key) {
      case 'events24h':
        return this.formatNumber(s.events24h);
      case 'successRate':
        return s.deliveries?.successRate !== null &&
          s.deliveries?.successRate !== undefined
          ? `${s.deliveries.successRate}%`
          : '—';
      case 'pending':
        return this.formatNumber(s.deliveries?.pending ?? 0);
      case 'dlq':
        return this.formatNumber(s.deliveries?.dlq ?? 0);
    }
  }

  statValueClass(key: StatCard['key']): string {
    if (!this.stats()) return 'text-muted-2';
    switch (key) {
      case 'successRate': {
        const v = this.successRateValue();
        if (v === null) return 'text-muted-2';
        if (v >= 95) return 'text-signal-green';
        if (v >= 80) return 'text-signal-amber';
        return 'text-signal-rose';
      }
      case 'dlq':
        return this.dlqCount() > 0 ? 'text-signal-rose' : 'text-foreground';
      default:
        return 'text-foreground';
    }
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