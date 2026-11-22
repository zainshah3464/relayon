import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { TranslocoModule } from '@jsverse/transloco';
import { Subject, takeUntil } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { environment } from '../../../environments/environment';
import { ApiKeysComponent } from './api-keys.component';
import { BillingComponent } from './billing.component';
import { WebhooksSettingsComponent } from './webhooks.component';
import { IntegrationsSettingsComponent } from './integrations.component';
import { QuotaService } from '../../core/api/quota.service';
import { IconComponent, type IconName } from '../../shared/ui/icon/icon.component';
import { ToastService } from '../../shared/ui/toast/toast.service';

interface TenantInfo {
  id: string;
  name: string;
  slug: string;
  plan: string;
  quotaEventsPerMonth: number;
  quotaAiTokensPerMonth: number;
  quotaMode: 'hard' | 'soft';
}

type Tab = 'workspace' | 'api-keys' | 'billing' | 'integrations' | 'webhooks';

interface TabDef {
  id: Tab;
  labelKey: string;
  icon: IconName;
}

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TranslocoModule,
    ApiKeysComponent,
    BillingComponent,
    WebhooksSettingsComponent,
    IntegrationsSettingsComponent,
    IconComponent,
  ],
  template: `
    <div class="space-y-5">
      <!-- ═══════════ HEADER ═══════════ -->
      <div>
        <h1 class="text-2xl font-bold tracking-tighter text-foreground sm:text-3xl">
          {{ 'settings.title' | transloco }}
        </h1>
        <p class="mt-1 text-sm text-muted">
          {{ 'settings.subtitle' | transloco }}
        </p>
      </div>

      <!-- ═══════════ TABS ═══════════ -->
      <div class="-mx-4 overflow-x-auto border-b border-hairline px-4 sm:mx-0 sm:px-0">
        <div class="flex min-w-max gap-1" role="tablist" aria-label="Settings sections">
          @for (t of tabs; track t.id) {
            <button
              type="button"
              role="tab"
              [attr.aria-selected]="tab() === t.id"
              (click)="setTab(t.id)"
              class="group flex items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors sm:px-4"
              [class.border-relay-violet]="tab() === t.id"
              [class.text-foreground]="tab() === t.id"
              [class.border-transparent]="tab() !== t.id"
              [class.text-muted]="tab() !== t.id"
              [class.hover:text-foreground]="tab() !== t.id"
            >
              <app-icon [name]="t.icon" [size]="14" [strokeWidth]="2" />
              <span>{{ t.labelKey | transloco }}</span>
            </button>
          }
        </div>
      </div>

      <!-- ═══════════ TAB CONTENT ═══════════ -->
      @switch (tab()) {
        @case ('workspace') {
          <ng-container *ngTemplateOutlet="workspaceTpl" />
        }
        @case ('api-keys') {
          <app-api-keys />
        }
        @case ('billing') {
          <app-billing />
        }
        @case ('integrations') {
          <app-integrations-settings />
        }
        @case ('webhooks') {
          <app-webhooks-settings />
        }
      }

      <!-- ═══════════ WORKSPACE TEMPLATE ═══════════ -->
      <ng-template #workspaceTpl>
        @if (tenant()) {
          @if (tenant(); as t) {
            <!-- Workspace card -->
            <div class="card">
              <div class="flex items-center gap-3">
                <div class="flex h-9 w-9 items-center justify-center rounded-lg bg-relay-violet/10 text-relay-violet">
                  <app-icon name="settings" [size]="16" [strokeWidth]="2" />
                </div>
                <div>
                  <h2 class="text-sm font-semibold text-foreground">
                    {{ 'settings.workspace.title' | transloco }}
                  </h2>
                  <p class="text-[11px] text-muted">
                    Manage your workspace name, slug, and plan.
                  </p>
                </div>
              </div>

              <form [formGroup]="form" (ngSubmit)="save()" class="mt-4 space-y-4">
                <div>
                  <label for="ws-name" class="label">
                    {{ 'settings.workspace.name' | transloco }}
                  </label>
                  <input
                    id="ws-name"
                    formControlName="name"
                    class="input"
                    autocomplete="organization"
                  />
                  @if (form.controls.name.touched && form.controls.name.invalid) {
                    <p class="mt-1.5 text-xs text-signal-rose">Name required (min 2 chars)</p>
                  }
                </div>

                <div class="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label for="ws-slug" class="label">
                      {{ 'settings.workspace.slug' | transloco }}
                    </label>
                    <input
                      id="ws-slug"
                      [value]="t.slug"
                      disabled
                      class="input font-mono opacity-60"
                    />
                    <p class="mt-1 text-[11px] text-muted-2">
                      Slug cannot be changed — it's used in your webhook URLs.
                    </p>
                  </div>
                  <div>
                    <label for="ws-plan" class="label">
                      {{ 'settings.workspace.plan' | transloco }}
                    </label>
                    <input
                      id="ws-plan"
                      [value]="t.plan"
                      disabled
                      class="input capitalize opacity-60"
                    />
                  </div>
                </div>

                <div class="flex flex-wrap items-center gap-2">
                  <button
                    type="submit"
                    [disabled]="form.invalid || saving() || !form.dirty"
                    class="btn-primary"
                  >
                    @if (saving()) {
                      <app-icon name="loader" [size]="13" [strokeWidth]="2.5" class="animate-spin" />
                    }
                    <span>{{ (saving() ? 'common.saving' : 'settings.workspace.saveChanges') | transloco }}</span>
                  </button>
                </div>
              </form>
            </div>

            <!-- Quota card (owner) -->
            @if (auth.user()?.role === 'owner') {
              <div class="card">
                <div class="flex items-center gap-3">
                  <div class="flex h-9 w-9 items-center justify-center rounded-lg bg-relay-cyan/10 text-relay-cyan">
                    <app-icon name="gauge" [size]="16" [strokeWidth]="2" />
                  </div>
                  <div>
                    <h2 class="text-sm font-semibold text-foreground">
                      {{ 'settings.quotaOverride.title' | transloco }}
                    </h2>
                    <p class="text-[11px] text-muted">
                      Set custom limits for this workspace.
                    </p>
                  </div>
                </div>

                <div class="mt-4 grid gap-3 sm:grid-cols-2">
                  <div>
                    <label for="q-events" class="label">
                      {{ 'settings.quotaOverride.eventsPerMonth' | transloco }}
                    </label>
                    <input
                      id="q-events"
                      type="number"
                      [value]="quotaEvents()"
                      (input)="quotaEvents.set(+$any($event.target).value)"
                      class="input tabular-nums"
                      min="0"
                    />
                  </div>
                  <div>
                    <label for="q-tokens" class="label">
                      {{ 'settings.quotaOverride.aiTokensPerMonth' | transloco }}
                    </label>
                    <input
                      id="q-tokens"
                      type="number"
                      [value]="quotaTokens()"
                      (input)="quotaTokens.set(+$any($event.target).value)"
                      class="input tabular-nums"
                      min="0"
                    />
                  </div>
                </div>

                <div class="mt-3">
                  <label for="q-mode" class="label">
                    {{ 'settings.quotaOverride.enforcementMode' | transloco }}
                  </label>
                  <select
                    id="q-mode"
                    [value]="quotaMode()"
                    (change)="quotaMode.set($any($event.target).value)"
                    class="input"
                  >
                    <option value="hard">{{ 'settings.quotaOverride.hardOption' | transloco }}</option>
                    <option value="soft">{{ 'settings.quotaOverride.softOption' | transloco }}</option>
                  </select>
                  <p class="mt-1.5 text-[11px] text-muted">
                    {{ 'settings.quotaOverride.help' | transloco }}
                  </p>
                </div>

                <div class="mt-4 flex items-center gap-2">
                  <button
                    type="button"
                    (click)="saveQuota()"
                    [disabled]="quotaSaving()"
                    class="btn-primary"
                  >
                    @if (quotaSaving()) {
                      <app-icon name="loader" [size]="13" [strokeWidth]="2.5" class="animate-spin" />
                    }
                    <span>{{ (quotaSaving() ? 'common.saving' : 'settings.quotaOverride.updateQuota') | transloco }}</span>
                  </button>
                </div>
              </div>
            } @else {
              <!-- Non-owner: read-only quotas -->
              <div class="card">
                <div class="flex items-center gap-3">
                  <div class="flex h-9 w-9 items-center justify-center rounded-lg bg-surface-3 text-muted">
                    <app-icon name="gauge" [size]="16" [strokeWidth]="2" />
                  </div>
                  <div>
                    <h2 class="text-sm font-semibold text-foreground">
                      {{ 'settings.quotas.title' | transloco }}
                    </h2>
                    <p class="text-[11px] text-muted">
                      Contact the workspace owner to change these.
                    </p>
                  </div>
                </div>

                <div class="mt-4 grid gap-3 sm:grid-cols-3">
                  <div class="rounded-lg border border-hairline bg-surface-2/50 p-3">
                    <p class="text-[10px] font-medium uppercase tracking-wider text-muted-2">
                      {{ 'settings.quotas.eventsPerMonth' | transloco }}
                    </p>
                    <p class="mt-1 font-mono text-sm font-medium tabular-nums text-foreground">
                      {{ t.quotaEventsPerMonth.toLocaleString() }}
                    </p>
                  </div>
                  <div class="rounded-lg border border-hairline bg-surface-2/50 p-3">
                    <p class="text-[10px] font-medium uppercase tracking-wider text-muted-2">
                      {{ 'settings.quotas.aiTokensPerMonth' | transloco }}
                    </p>
                    <p class="mt-1 font-mono text-sm font-medium tabular-nums text-foreground">
                      {{ t.quotaAiTokensPerMonth.toLocaleString() }}
                    </p>
                  </div>
                  <div class="rounded-lg border border-hairline bg-surface-2/50 p-3">
                    <p class="text-[10px] font-medium uppercase tracking-wider text-muted-2">
                      {{ 'settings.quotas.mode' | transloco }}
                    </p>
                    <p class="mt-1 flex items-center gap-1.5 text-sm font-medium text-foreground">
                      <span class="font-mono">{{ t.quotaMode }}</span>
                      @if (t.quotaMode === 'soft') {
                        <span class="text-signal-amber">⚠</span>
                      }
                    </p>
                  </div>
                </div>

                @if (t.quotaMode === 'soft') {
                  <p class="mt-3 text-[11px] text-signal-amber">
                    {{ 'settings.quotas.softNote' | transloco }}
                  </p>
                }
              </div>
            }
          }
        } @else if (loading()) {
          <div class="space-y-3">
            <div class="card">
              <div class="skeleton h-4 w-32"></div>
              <div class="skeleton mt-3 h-9 w-full"></div>
              <div class="skeleton mt-3 h-9 w-full"></div>
              <div class="skeleton mt-3 h-9 w-full"></div>
            </div>
          </div>
        }
      </ng-template>
    </div>
  `,
})
export class SettingsComponent implements OnInit, OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly fb = inject(FormBuilder);
  private readonly quotaSvc = inject(QuotaService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  readonly auth = inject(AuthService);

  private readonly destroy$ = new Subject<void>();

  readonly tabs: TabDef[] = [
    { id: 'workspace', labelKey: 'settings.tabs.workspace', icon: 'settings' },
    { id: 'api-keys', labelKey: 'settings.tabs.apiKeys', icon: 'key' },
    { id: 'billing', labelKey: 'settings.tabs.billing', icon: 'credit-card' },
    { id: 'integrations', labelKey: 'settings.tabs.integrations', icon: 'plug' },
    { id: 'webhooks', labelKey: 'settings.tabs.webhooks', icon: 'webhook' },
  ];

  readonly tab = signal<Tab>('workspace');
  readonly tenant = signal<TenantInfo | null>(null);
  readonly loading = signal(true);
  readonly saving = signal(false);

  readonly quotaEvents = signal(0);
  readonly quotaTokens = signal(0);
  readonly quotaMode = signal<'hard' | 'soft'>('hard');
  readonly quotaSaving = signal(false);

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
  });

  ngOnInit(): void {
    // Read initial tab from URL
    this.route.queryParamMap
      .pipe(takeUntil(this.destroy$))
      .subscribe((params) => {
        const t = params.get('tab') as Tab | null;
        if (t && this.tabs.some((x) => x.id === t)) {
          this.tab.set(t);
        }
      });

    this.loadTenant();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  setTab(id: Tab): void {
    this.tab.set(id);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab: id === 'workspace' ? null : id },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  private loadTenant(): void {
    this.loading.set(true);
    this.http.get<TenantInfo>(`${environment.apiUrl}/api/tenants/me`).subscribe({
      next: (t) => {
        this.tenant.set(t);
        this.form.patchValue({ name: t.name });
        this.quotaEvents.set(t.quotaEventsPerMonth);
        this.quotaTokens.set(t.quotaAiTokensPerMonth);
        this.quotaMode.set(t.quotaMode === 'soft' ? 'soft' : 'hard');
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  save(): void {
    if (this.form.invalid || this.saving() || !this.form.dirty) return;
    this.saving.set(true);

    this.http
      .patch<TenantInfo>(
        `${environment.apiUrl}/api/tenants/me`,
        this.form.getRawValue(),
      )
      .subscribe({
        next: (t) => {
          this.tenant.set(t);
          this.form.markAsPristine();
          this.saving.set(false);
          this.toast.success('Workspace updated');
        },
        error: (err) => {
          this.saving.set(false);
          this.toast.error(err?.error?.message ?? 'Failed to save');
        },
      });
  }

  saveQuota(): void {
    if (this.quotaSaving()) return;
    this.quotaSaving.set(true);

    this.quotaSvc
      .updateQuota({
        eventsPerMonth: this.quotaEvents(),
        aiTokensPerMonth: this.quotaTokens(),
        quotaMode: this.quotaMode(),
      })
      .subscribe({
        next: () => {
          this.quotaSaving.set(false);
          this.toast.success('Quota updated');
        },
        error: (err) => {
          this.quotaSaving.set(false);
          this.toast.error(err?.error?.message ?? 'Failed to update quota');
        },
      });
  }
}