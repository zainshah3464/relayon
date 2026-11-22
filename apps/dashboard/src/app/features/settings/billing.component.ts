import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { TranslocoModule } from '@jsverse/transloco';
import { environment } from '../../../environments/environment';
import { IconComponent } from '../../shared/ui/icon/icon.component';

interface BillingStatus {
  plan: string;
  subscriptionStatus: string;
  currentPeriodEnd: string | null;
  billingEnabled: boolean;
  testMode: boolean;
}

@Component({
  selector: 'app-billing',
  standalone: true,
  imports: [CommonModule, TranslocoModule, IconComponent],
  template: `
    <div class="space-y-4">
      <div>
        <h2 class="text-lg font-semibold text-foreground">
          {{ 'billing.title' | transloco }}
        </h2>
        <p class="mt-0.5 text-sm text-muted">
          {{ 'billing.subtitle' | transloco }}
        </p>
      </div>

      <!-- Test mode banner -->
      @if (status()?.testMode) {
        <div class="flex items-start gap-2.5 rounded-lg border border-signal-amber/30 bg-signal-amber/[0.06] p-3 text-sm">
          <app-icon name="alert-triangle" [size]="16" [strokeWidth]="2" class="mt-0.5 shrink-0 text-signal-amber" />
          <div class="min-w-0 flex-1">
            <p class="font-medium text-signal-amber">
              {{ 'billing.testMode.label' | transloco }}
            </p>
            <p class="mt-0.5 text-xs text-muted">
              {{ 'billing.testMode.body' | transloco }}
              <code class="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-signal-amber">4242 4242 4242 4242</code>
              {{ 'billing.testMode.tail' | transloco }}
            </p>
          </div>
        </div>
      }

      @if (status()) {
        @if (status(); as s) {
          @if (!s.billingEnabled) {
            <div class="card flex items-start gap-3">
              <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-3 text-muted">
                <app-icon name="info" [size]="16" [strokeWidth]="2" />
              </div>
              <div>
                <p class="text-sm font-medium text-foreground">Billing is disabled</p>
                <p class="mt-0.5 text-xs text-muted">
                  {{ 'billing.disabled' | transloco }}
                </p>
              </div>
            </div>
          } @else {
            <div class="card">
              <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div class="flex items-start gap-3">
                  <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-relay-violet to-relay-cyan text-white">
                    <app-icon name="credit-card" [size]="18" [strokeWidth]="2" />
                  </div>
                  <div>
                    <p class="text-[10px] font-medium uppercase tracking-wider text-muted-2">
                      {{ 'billing.currentPlan' | transloco }}
                    </p>
                    <p class="mt-0.5 text-xl font-bold tracking-tight text-foreground capitalize">
                      {{ 'billing.plans.' + s.plan | transloco }}
                    </p>
                    <p class="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                      <span [ngClass]="statusPillClass(s.subscriptionStatus)">
                        {{ 'billing.status.' + s.subscriptionStatus | transloco }}
                      </span>
                      @if (s.currentPeriodEnd) {
                        <span class="text-muted-2">·</span>
                        <span>{{ 'billing.renews' | transloco }} {{ s.currentPeriodEnd | date: 'mediumDate' }}</span>
                      }
                    </p>
                    @if (s.testMode) {
                      <span class="badge badge-warning mt-2">
                        {{ 'billing.testMode.badge' | transloco }}
                      </span>
                    }
                  </div>
                </div>

                <div class="flex flex-wrap gap-2">
                  @if (s.subscriptionStatus === 'active' || s.subscriptionStatus === 'trialing') {
                    <button
                      type="button"
                      (click)="openPortal()"
                      [disabled]="loading()"
                      class="btn-secondary"
                    >
                      @if (loading()) {
                        <app-icon name="loader" [size]="13" [strokeWidth]="2.5" class="animate-spin" />
                      } @else {
                        <app-icon name="external-link" [size]="13" [strokeWidth]="2" />
                      }
                      <span>{{ 'billing.manageSubscription' | transloco }}</span>
                    </button>
                  } @else {
                    <button
                      type="button"
                      (click)="upgrade()"
                      [disabled]="loading()"
                      class="btn-primary"
                    >
                      @if (loading()) {
                        <app-icon name="loader" [size]="13" [strokeWidth]="2.5" class="animate-spin" />
                      } @else {
                        <app-icon name="sparkles" [size]="13" [strokeWidth]="2" />
                      }
                      <span>{{ (loading() ? 'billing.redirecting' : 'billing.upgradeToPro') | transloco }}</span>
                    </button>
                  }
                </div>
              </div>
            </div>
          }
        }
      } @else {
        <!-- Skeleton (initial load) -->
        <div class="card">
          <div class="skeleton h-4 w-24"></div>
          <div class="skeleton mt-3 h-8 w-32"></div>
          <div class="skeleton mt-2 h-3 w-40"></div>
        </div>
      }
    </div>
  `,
})
export class BillingComponent implements OnInit {
  private readonly http = inject(HttpClient);

  readonly status = signal<BillingStatus | null>(null);
  readonly loading = signal(false);

  ngOnInit(): void {
    this.http
      .get<BillingStatus>(`${environment.apiUrl}/api/billing/status`)
      .subscribe({
        next: (s) => this.status.set(s),
        error: () =>
          this.status.set({
            plan: 'free',
            subscriptionStatus: 'none',
            currentPeriodEnd: null,
            billingEnabled: false,
            testMode: false,
          }),
      });
  }

  statusPillClass(status: string): string {
    const base = 'inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium';
    if (status === 'active') return `${base} bg-signal-green/12 text-signal-green`;
    if (status === 'trialing') return `${base} bg-info/12 text-info`;
    if (status === 'past_due' || status === 'unpaid')
      return `${base} bg-signal-rose/12 text-signal-rose`;
    return `${base} bg-surface-3 text-muted`;
  }

  upgrade(): void {
    this.loading.set(true);
    this.http
      .post<{ url: string }>(`${environment.apiUrl}/api/billing/checkout`, {
        priceId:
          (environment as unknown as { stripeProPriceId?: string }).stripeProPriceId ??
          'price_replace_with_real_pro_price_id',
      })
      .subscribe({
        next: ({ url }) => {
          window.location.href = url;
        },
        error: () => this.loading.set(false),
      });
  }

  openPortal(): void {
    this.loading.set(true);
    this.http
      .post<{ url: string }>(`${environment.apiUrl}/api/billing/portal`, {})
      .subscribe({
        next: ({ url }) => {
          window.location.href = url;
        },
        error: () => this.loading.set(false),
      });
  }
}