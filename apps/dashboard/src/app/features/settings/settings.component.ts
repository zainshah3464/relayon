import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { TranslocoModule } from '@jsverse/transloco';
import { AuthService } from '../../core/auth/auth.service';
import { environment } from '../../../environments/environment';
import { ApiKeysComponent } from './api-keys.component';
import { BillingComponent } from './billing.component';
import { WebhooksSettingsComponent } from './webhooks.component';
import { QuotaService } from '../../core/api/quota.service';

interface TenantInfo {
  id: string;
  name: string;
  slug: string;
  plan: string;
  quotaEventsPerMonth: number;
  quotaAiTokensPerMonth: number;
  quotaMode: 'hard' | 'soft';
}

type Tab = 'workspace' | 'api-keys' | 'billing' | 'webhooks';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TranslocoModule, ApiKeysComponent, BillingComponent, WebhooksSettingsComponent],
  template: `
    <div class="space-y-6 max-w-4xl">
      <div>
        <h1 class="text-2xl font-bold tracking-tightest text-white">{{ 'settings.title' | transloco }}</h1>
        <p class="text-sm text-muted mt-1">{{ 'settings.subtitle' | transloco }}</p>
      </div>

      <div class="flex gap-1 border-b border-hairline">
        <button
          (click)="tab.set('workspace')"
          class="px-4 py-2 text-sm border-b-2 -mb-px"
          [class.border-relay-violet]="tab() === 'workspace'"
          [class.text-white]="tab() === 'workspace'"
          [class.text-muted]="tab() !== 'workspace'"
          [class.border-transparent]="tab() !== 'workspace'"
        >{{ 'settings.tabs.workspace' | transloco }}</button>
        <button
          (click)="tab.set('api-keys')"
          class="px-4 py-2 text-sm border-b-2 -mb-px"
          [class.border-relay-violet]="tab() === 'api-keys'"
          [class.text-white]="tab() === 'api-keys'"
          [class.text-muted]="tab() !== 'api-keys'"
          [class.border-transparent]="tab() !== 'api-keys'"
        >{{ 'settings.tabs.apiKeys' | transloco }}</button>
        <button
          (click)="tab.set('billing')"
          class="px-4 py-2 text-sm border-b-2 -mb-px"
          [class.border-relay-violet]="tab() === 'billing'"
          [class.text-white]="tab() === 'billing'"
          [class.text-muted]="tab() !== 'billing'"
          [class.border-transparent]="tab() !== 'billing'"
        >{{ 'settings.tabs.billing' | transloco }}</button>
        <button
          (click)="tab.set('webhooks')"
          class="px-4 py-2 text-sm border-b-2 -mb-px"
          [class.border-relay-violet]="tab() === 'webhooks'"
          [class.text-white]="tab() === 'webhooks'"
          [class.text-muted]="tab() !== 'webhooks'"
          [class.border-transparent]="tab() !== 'webhooks'"
        >Webhooks</button>
      </div>

      @if (tab() === 'workspace') {
        @if (tenant(); as t) {
          <div class="card">
            <h2 class="text-sm font-medium text-white mb-4">{{ 'settings.workspace.title' | transloco }}</h2>
            <form [formGroup]="form" (ngSubmit)="save()" class="space-y-4">
              <div>
                <label class="label">{{ 'settings.workspace.name' | transloco }}</label>
                <input formControlName="name" class="input" />
              </div>
              <div>
                <label class="label">{{ 'settings.workspace.slug' | transloco }}</label>
                <input [value]="t.slug" disabled class="input opacity-60" />
              </div>
              <div>
                <label class="label">{{ 'settings.workspace.plan' | transloco }}</label>
                <input [value]="t.plan" disabled class="input opacity-60" />
              </div>
              <div class="flex gap-2">
                <button type="submit" [disabled]="form.invalid || saving()" class="btn-primary">
                  {{ (saving() ? 'common.saving' : 'settings.workspace.saveChanges') | transloco }}
                </button>
                @if (saved()) {
                  <span class="text-sm text-signal-green self-center">{{ 'settings.workspace.saved' | transloco }}</span>
                }
              </div>
            </form>
          </div>

          @if (auth.user()?.role === 'owner') {
            <div class="card">
              <h2 class="text-sm font-medium text-white mb-4">{{ 'settings.quotaOverride.title' | transloco }}</h2>
              <div class="grid gap-3 sm:grid-cols-2">
                <div>
                  <label class="label">{{ 'settings.quotaOverride.eventsPerMonth' | transloco }}</label>
                  <input
                    type="number"
                    [value]="quotaEvents()"
                    (input)="quotaEvents.set(+$any($event.target).value)"
                    class="input"
                  />
                </div>
                <div>
                  <label class="label">{{ 'settings.quotaOverride.aiTokensPerMonth' | transloco }}</label>
                  <input
                    type="number"
                    [value]="quotaTokens()"
                    (input)="quotaTokens.set(+$any($event.target).value)"
                    class="input"
                  />
                </div>
              </div>
              <div class="mt-3">
                <label class="label">{{ 'settings.quotaOverride.enforcementMode' | transloco }}</label>
                <select
                  [value]="quotaMode()"
                  (change)="quotaMode.set($any($event.target).value)"
                  class="input"
                >
                  <option value="hard">{{ 'settings.quotaOverride.hardOption' | transloco }}</option>
                  <option value="soft">{{ 'settings.quotaOverride.softOption' | transloco }}</option>
                </select>
                <p class="text-xs text-muted mt-1">
                  {{ 'settings.quotaOverride.help' | transloco }}
                </p>
              </div>
              <div class="flex gap-2 mt-3">
                <button (click)="saveQuota()" [disabled]="quotaSaving()" class="btn-primary text-xs">
                  {{ (quotaSaving() ? 'common.saving' : 'settings.quotaOverride.updateQuota') | transloco }}
                </button>
                @if (quotaSaved()) {
                  <span class="text-xs text-signal-green self-center">{{ 'settings.quotaOverride.saved' | transloco }}</span>
                }
              </div>
            </div>
          } @else {
            <div class="card">
              <h2 class="text-sm font-medium text-white mb-2">{{ 'settings.quotas.title' | transloco }}</h2>
              <p class="text-xs text-muted">
                {{ 'settings.quotas.eventsPerMonth' | transloco }} {{ t.quotaEventsPerMonth.toLocaleString() }}
              </p>
              <p class="text-xs text-muted">
                {{ 'settings.quotas.aiTokensPerMonth' | transloco }} {{ t.quotaAiTokensPerMonth.toLocaleString() }}
              </p>
              <p class="text-xs text-muted mt-1">
                {{ 'settings.quotas.mode' | transloco }} <span class="font-mono">{{ t.quotaMode }}</span>
                @if (t.quotaMode === 'soft') {
                  <span class="text-signal-amber">{{ 'settings.quotas.softNote' | transloco }}</span>
                }
              </p>
            </div>
          }
        }
      }

      @if (tab() === 'api-keys') {
        <app-api-keys />
      }

      @if (tab() === 'billing') {
        <app-billing />
      }

      @if (tab() === 'webhooks') {
        <app-webhooks-settings />
      }
    </div>
  `,
})
export class SettingsComponent implements OnInit {
  private http = inject(HttpClient);
  private fb = inject(FormBuilder);
  private quotaSvc = inject(QuotaService);
  readonly auth = inject(AuthService);

  tab = signal<Tab>('workspace');
  tenant = signal<TenantInfo | null>(null);
  saving = signal(false);
  saved = signal(false);

  quotaEvents = signal(0);
  quotaTokens = signal(0);
  quotaMode = signal<'hard' | 'soft'>('hard');
  quotaSaving = signal(false);
  quotaSaved = signal(false);

  form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
  });

  ngOnInit(): void {
    this.http.get<TenantInfo>(`${environment.apiUrl}/api/tenants/me`).subscribe({
      next: (t) => {
        this.tenant.set(t);
        this.form.patchValue({ name: t.name });
        this.quotaEvents.set(t.quotaEventsPerMonth);
        this.quotaTokens.set(t.quotaAiTokensPerMonth);
        this.quotaMode.set(t.quotaMode === 'soft' ? 'soft' : 'hard');
      },
    });
  }

  save(): void {
    if (this.form.invalid || this.saving()) return;
    this.saving.set(true);
    this.saved.set(false);

    this.http
      .patch<TenantInfo>(`${environment.apiUrl}/api/tenants/me`, this.form.getRawValue())
      .subscribe({
        next: (t) => {
          this.tenant.set(t);
          this.saving.set(false);
          this.saved.set(true);
          setTimeout(() => this.saved.set(false), 2000);
        },
        error: () => this.saving.set(false),
      });
  }

  saveQuota(): void {
    if (this.quotaSaving()) return;
    this.quotaSaving.set(true);
    this.quotaSaved.set(false);

    this.quotaSvc
      .updateQuota({
        eventsPerMonth: this.quotaEvents(),
        aiTokensPerMonth: this.quotaTokens(),
        quotaMode: this.quotaMode(),
      })
      .subscribe({
        next: () => {
          this.quotaSaving.set(false);
          this.quotaSaved.set(true);
          setTimeout(() => this.quotaSaved.set(false), 2000);
        },
        error: () => this.quotaSaving.set(false),
      });
  }
}