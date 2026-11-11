import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { TranslocoModule } from '@jsverse/transloco';
import { environment } from '../../../environments/environment';

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
  imports: [CommonModule, TranslocoModule],
  template: `
    <div class="space-y-6">
      <div>
        <h1 class="text-2xl font-bold text-white">{{ 'billing.title' | transloco }}</h1>
        <p class="text-sm text-muted mt-1">{{ 'billing.subtitle' | transloco }}</p>
      </div>

      @if (status()?.testMode) {
        <div class="rounded-lg border border-signal-amber/30 bg-signal-amber/5 p-3 text-sm text-signal-amber">
          ⚠️ <strong>{{ 'billing.testMode.label' | transloco }}</strong> —
          {{ 'billing.testMode.body' | transloco }}
          <code class="font-mono">4242 4242 4242 4242</code>
          {{ 'billing.testMode.tail' | transloco }}
        </div>
      }

      @if (status(); as s) {
        @if (!s.billingEnabled) {
          <div class="card text-sm text-muted">
            {{ 'billing.disabled' | transloco }}
          </div>
        } @else {
          <div class="card">
            <div class="flex justify-between items-start">
              <div>
                <p class="text-xs uppercase text-muted">{{ 'billing.currentPlan' | transloco }}</p>
                <p class="text-2xl font-bold text-white mt-1">
                  {{ 'billing.plans.' + s.plan | transloco }}
                </p>
                <p class="text-xs text-muted mt-1">
                  {{ 'billing.statusLabel' | transloco }}
                  {{ 'billing.status.' + s.subscriptionStatus | transloco }}
                </p>
                @if (s.currentPeriodEnd) {
                  <p class="text-xs text-muted">
                    {{ 'billing.renews' | transloco }} {{ s.currentPeriodEnd | date: 'mediumDate' }}
                  </p>
                }
                @if (s.testMode) {
                  <span class="inline-block mt-2 text-xs px-2 py-0.5 rounded bg-signal-amber/20 text-signal-amber">
                    {{ 'billing.testMode.badge' | transloco }}
                  </span>
                }
              </div>
              <div class="flex gap-2">
                @if (s.subscriptionStatus === 'active' || s.subscriptionStatus === 'trialing') {
                  <button (click)="openPortal()" [disabled]="loading()" class="btn-secondary text-xs">
                    {{ 'billing.manageSubscription' | transloco }}
                  </button>
                } @else {
                  <button (click)="upgrade()" [disabled]="loading()" class="btn-primary text-xs">
                    {{ (loading() ? 'billing.redirecting' : 'billing.upgradeToPro') | transloco }}
                  </button>
                }
              </div>
            </div>
          </div>
        }
      }
    </div>
  `,
})
export class BillingComponent implements OnInit {
  private http = inject(HttpClient);
  status = signal<BillingStatus | null>(null);
  loading = signal(false);

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