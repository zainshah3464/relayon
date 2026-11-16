import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { AuthService } from '../../core/auth/auth.service';
import { AnalyticsService, Overview } from '../../core/api/analytics.service';
import { QuotaService, QuotaSnapshot } from '../../core/api/quota.service';
import { AnnouncementsWidgetComponent } from '../community/announcements-widget.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    TranslocoModule,
    AnnouncementsWidgetComponent,
  ],
  template: `
    <div class="space-y-8">
      <div>
        <p class="text-xs font-medium uppercase tracking-widest text-relay-cyan">
          {{ auth.user()?.tenantName }}
        </p>
        <h1 class="mt-1 text-3xl font-bold tracking-tightest text-white">
          {{ 'dashboard.welcome' | transloco: { name: auth.displayName() } }}
        </h1>
        <p class="mt-1 text-sm text-muted">
          {{ 'dashboard.subtitle' | transloco }}
        </p>
      </div>

      <!-- ⚠️ v3.2 — welcome banner for new users -->
      @if (isNewUser) {
        <div class="card bg-gradient-to-br from-relay-violet/10 to-relay-cyan/10 border-relay-violet/30">
          <div class="flex items-start gap-4">
            <div class="text-4xl">🚀</div>
            <div class="flex-1">
              <h3 class="text-lg font-semibold text-white mb-1">Welcome to Relayon, {{ auth.displayName() }}!</h3>
              <p class="text-sm text-muted mb-4">
                You're all set up. Here's how to get your first webhook flowing:
              </p>
              <div class="flex flex-wrap gap-2">
                <a routerLink="/workflows" class="btn-primary text-xs">
                  Create first workflow
                </a>
                <a routerLink="/guide" class="btn-secondary text-xs">Read the guide</a>
              </div>
            </div>
          </div>
        </div>
      }

      <!-- ⚠️ v2.5 — community announcements widget -->
      <app-announcements-widget />

      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div class="card">
          <p class="text-xs font-medium uppercase tracking-wider text-muted">{{ 'dashboard.stats.events24h' | transloco }}</p>
          <p class="mt-2 text-2xl font-bold text-white">{{ stats()?.events24h ?? '—' }}</p>
        </div>
        <div class="card">
          <p class="text-xs font-medium uppercase tracking-wider text-muted">{{ 'dashboard.stats.successRate' | transloco }}</p>
          <p class="mt-2 text-2xl font-bold text-signal-green">
            {{ stats()?.deliveries?.successRate !== null && stats()?.deliveries?.successRate !== undefined ? stats()!.deliveries.successRate + '%' : '—' }}
          </p>
        </div>
        <div class="card">
          <p class="text-xs font-medium uppercase tracking-wider text-muted">{{ 'dashboard.stats.pendingDeliveries' | transloco }}</p>
          <p class="mt-2 text-2xl font-bold text-white">{{ stats()?.deliveries?.pending ?? 0 }}</p>
        </div>
        <div class="card">
          <p class="text-xs font-medium uppercase tracking-wider text-muted">{{ 'dashboard.stats.dlqEntries' | transloco }}</p>
          <p class="mt-2 text-2xl font-bold" [class.text-signal-rose]="(stats()?.deliveries?.dlq ?? 0) > 0" [class.text-white]="(stats()?.deliveries?.dlq ?? 0) === 0">
            {{ stats()?.deliveries?.dlq ?? 0 }}
          </p>
        </div>
      </div>

      @if (quota(); as q) {
        <div class="card">
          <div class="flex justify-between items-center mb-3">
            <h2 class="text-sm font-medium text-white">{{ 'dashboard.monthlyUsage' | transloco }}</h2>
            <span class="text-xs text-muted">{{ q.period }}</span>
          </div>
          <div class="grid gap-3 sm:grid-cols-2">
            <div>
              <div class="flex justify-between text-xs mb-1">
                <span class="text-muted">{{ 'dashboard.events' | transloco }}</span>
                <span class="text-white">{{ q.metrics.events.used }} / {{ q.metrics.events.limit }}</span>
              </div>
              <div class="h-1.5 rounded-full bg-surface-2 overflow-hidden">
                <div class="h-full bg-relay-violet" [style.width.%]="Math.min(100, q.metrics.events.used / Math.max(q.metrics.events.limit, 1) * 100)"></div>
              </div>
            </div>
            <div>
              <div class="flex justify-between text-xs mb-1">
                <span class="text-muted">{{ 'dashboard.aiTokens' | transloco }}</span>
                <span class="text-white">{{ q.metrics.ai_tokens.used }} / {{ q.metrics.ai_tokens.limit }}</span>
              </div>
              <div class="h-1.5 rounded-full bg-surface-2 overflow-hidden">
                <div class="h-full bg-relay-cyan" [style.width.%]="Math.min(100, q.metrics.ai_tokens.used / Math.max(q.metrics.ai_tokens.limit, 1) * 100)"></div>
              </div>
            </div>
          </div>
        </div>
      }

      <div class="grid gap-4 md:grid-cols-2">
        <a routerLink="/workflows" class="card block hover:bg-surface-2 transition">
          <div class="flex items-center gap-3">
            <div class="text-2xl">🔄</div>
            <div>
              <h3 class="text-white font-medium">{{ 'dashboard.quickLinks.workflowsTitle' | transloco }}</h3>
              <p class="text-xs text-muted">{{ 'dashboard.quickLinks.workflowsDesc' | transloco }}</p>
            </div>
          </div>
        </a>
        <a routerLink="/events" class="card block hover:bg-surface-2 transition">
          <div class="flex items-center gap-3">
            <div class="text-2xl">📨</div>
            <div>
              <h3 class="text-white font-medium">{{ 'dashboard.quickLinks.eventsTitle' | transloco }}</h3>
              <p class="text-xs text-muted">{{ 'dashboard.quickLinks.eventsDesc' | transloco }}</p>
            </div>
          </div>
        </a>
      </div>

      @if (stats(); as s) {
        @if (s.deliveries.dlq > 0) {
          <a routerLink="/dlq" class="block rounded-xl border border-signal-rose/30 bg-signal-rose/5 p-4 hover:bg-signal-rose/10">
            <p class="text-sm text-signal-rose">
              {{ 'dashboard.dlqAlert' | transloco: { count: s.deliveries.dlq } }}
            </p>
          </a>
        }
      }
    </div>
  `,
})
export class DashboardComponent implements OnInit {
  readonly auth = inject(AuthService);
  private analytics = inject(AnalyticsService);
  private quotaSvc = inject(QuotaService);

  readonly Math = Math;
  stats = signal<Overview | null>(null);
  quota = signal<QuotaSnapshot | null>(null);

  readonly hasData = computed(() => (this.stats()?.events24h ?? 0) > 0);

  // ⚠️ v3.2 — new user banner: no events yet, but stats already loaded
  get isNewUser(): boolean {
    const s = this.stats();
    return s !== null && s.events24h === 0;
  }

  ngOnInit(): void {
    this.analytics.overview().subscribe({
      next: (o) => this.stats.set(o),
      error: () => this.stats.set(null),
    });
    this.quotaSvc.snapshot().subscribe({
      next: (q) => this.quota.set(q),
      error: () => this.quota.set(null),
    });
  }
}