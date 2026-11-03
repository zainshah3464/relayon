import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
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
  imports: [CommonModule],
  template: `
    <div class="space-y-6">
      <div>
        <h1 class="text-2xl font-bold text-white">Billing</h1>
        <p class="text-sm text-muted mt-1">Subscription and payment method.</p>
      </div>

      @if (status()?.testMode) {
        <div class="rounded-lg border border-signal-amber/30 bg-signal-amber/5 p-3 text-sm text-signal-amber">
          ⚠️ <strong>TEST MODE</strong> — No real charges are processed. Use card
          <code class="font-mono">4242 4242 4242 4242</code> for any future expiry.
        </div>
      }

      @if (status(); as s) {
        @if (!s.billingEnabled) {
          <div class="card text-sm text-muted">
            Billing is disabled on this instance. All features are free.
          </div>
        } @else {
          <div class="card">
            <div class="flex justify-between items-start">
              <div>
                <p class="text-xs uppercase text-muted">Current plan</p>
                <p class="text-2xl font-bold text-white mt-1 capitalize">{{ s.plan }}</p>
                <p class="text-xs text-muted mt-1">Status: {{ s.subscriptionStatus }}</p>
                @if (s.currentPeriodEnd) {
                  <p class="text-xs text-muted">Renews {{ s.currentPeriodEnd | date: 'mediumDate' }}</p>
                }
                @if (s.testMode) {
                  <span class="inline-block mt-2 text-xs px-2 py-0.5 rounded bg-signal-amber/20 text-signal-amber">
                    TEST MODE
                  </span>
                }
              </div>
              <div class="flex gap-2">
                @if (s.subscriptionStatus === 'active' || s.subscriptionStatus === 'trialing') {
                  <button (click)="openPortal()" [disabled]="loading()" class="btn-secondary text-xs">
                    Manage subscription
                  </button>
                } @else {
                  <button (click)="upgrade()" [disabled]="loading()" class="btn-primary text-xs">
                    {{ loading() ? 'Redirecting...' : 'Upgrade to Pro (Free)' }}
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