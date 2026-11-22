import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IntegrationsApiService,
  type Integration,
  type Provider,
  type ProviderStatus,
  type TestResult,
} from '../../core/integrations/integrations.service';
import { IconComponent } from '../../shared/ui/icon/icon.component';
import { ModalComponent } from '../../shared/ui/modal/modal.component';
import { ConfirmDialogService } from '../../shared/ui/confirm/confirm-dialog.service';
import { ToastService } from '../../shared/ui/toast/toast.service';

interface ProviderMeta {
  id: Provider;
  name: string;
  description: string;
  keyPrefix: string;
  docsUrl: string;
  modelHint: string;
  supportsModel: boolean;
}

const PROVIDERS: ProviderMeta[] = [
  {
    id: 'groq',
    name: 'Groq',
    description: 'Powers AI enrichment and chat assistant.',
    keyPrefix: 'gsk_',
    docsUrl: 'https://console.groq.com/keys',
    modelHint: 'e.g. openai/gpt-oss-120b',
    supportsModel: true,
  },
  {
    id: 'openai',
    name: 'OpenAI',
    description: 'Alternative AI provider — GPT-4, embeddings.',
    keyPrefix: 'sk-',
    docsUrl: 'https://platform.openai.com/api-keys',
    modelHint: 'e.g. gpt-4o-mini',
    supportsModel: true,
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    description: 'Claude models for long context.',
    keyPrefix: 'sk-ant-',
    docsUrl: 'https://console.anthropic.com/settings/keys',
    modelHint: 'e.g. claude-3-5-sonnet',
    supportsModel: true,
  },
  {
    id: 'resend',
    name: 'Resend',
    description: 'Auth emails — verification, password reset.',
    keyPrefix: 're_',
    docsUrl: 'https://resend.com/api-keys',
    modelHint: '',
    supportsModel: false,
  },
];

@Component({
  selector: 'app-integrations-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent, ModalComponent],
  template: `
    <div class="space-y-4">
      <!-- ═══════════ HEADER ═══════════ -->
      <div>
        <h2 class="text-lg font-semibold text-foreground">Integrations & API keys</h2>
        <p class="mt-0.5 text-sm text-muted">
          Bring your own API keys to use your own quota. Without a key, Relayon uses its own.
        </p>
      </div>

      <!-- Info banner -->
      <div class="flex items-start gap-2.5 rounded-lg border border-relay-cyan/25 bg-relay-cyan/[0.06] p-3 text-sm">
        <app-icon name="zap" [size]="16" [strokeWidth]="2" class="mt-0.5 shrink-0 text-relay-cyan" />
        <div class="min-w-0 flex-1">
          <p class="text-xs text-relay-cyan">
            <strong>Why BYOK?</strong> Your keys give you control — your quota, your rate limits, your billing. When you add a key, that provider uses it exclusively for your workspace.
          </p>
        </div>
      </div>

      <!-- ═══════════ LOADING ═══════════ -->
      @if (loading()) {
        <div class="space-y-2">
          @for (i of [1, 2, 3, 4]; track i) {
            <div class="card">
              <div class="flex items-center gap-3">
                <div class="skeleton h-10 w-10 rounded-lg"></div>
                <div class="flex-1">
                  <div class="skeleton h-3 w-24"></div>
                  <div class="skeleton mt-1.5 h-2.5 w-48"></div>
                </div>
              </div>
            </div>
          }
        </div>
      } @else {
        <div class="space-y-2">
          @for (p of providers; track p.id) {
            <div class="card">
              <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div class="flex items-start gap-3">
                  <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-relay-violet to-relay-cyan text-sm font-bold text-white">
                    {{ p.name[0] }}
                  </div>
                  <div class="min-w-0">
                    <div class="flex flex-wrap items-center gap-1.5">
                      <h3 class="text-sm font-semibold text-foreground">{{ p.name }}</h3>
                      @if (status()[p.id]) {
                        @if (status()[p.id]!.source === 'tenant') {
                          <span class="badge badge-success">
                            <app-icon name="check" [size]="9" [strokeWidth]="3" />
                            Your key
                          </span>
                        } @else if (status()[p.id]!.source === 'platform') {
                          <span class="badge badge-warning">Platform key</span>
                        } @else {
                          <span class="badge badge-danger">Not configured</span>
                        }
                      }
                    </div>
                    <p class="mt-0.5 text-xs text-muted">{{ p.description }}</p>
                  </div>
                </div>
              </div>

              <!-- Active integration view -->
              @if (integrations()[p.id]) {
                @if (integrations()[p.id]; as int) {
                  <div class="mt-3 rounded-lg border border-hairline bg-surface-2 p-3">
                    <dl class="space-y-1.5 text-xs">
                      <div class="flex items-center justify-between gap-2">
                        <dt class="text-muted">API key</dt>
                        <dd class="truncate font-mono text-foreground">{{ int.apiKey }}</dd>
                      </div>
                      @if (int.model) {
                        <div class="flex items-center justify-between gap-2">
                          <dt class="text-muted">Model</dt>
                          <dd class="truncate font-mono text-foreground">{{ int.model }}</dd>
                        </div>
                      }
                      <div class="flex items-center justify-between gap-2">
                        <dt class="text-muted">Status</dt>
                        <dd class="flex items-center gap-1">
                          @if (int.lastValidationOk === true) {
                            <app-icon name="check-circle" [size]="11" [strokeWidth]="2" class="text-signal-green" />
                            <span class="text-signal-green">Valid</span>
                          } @else if (int.lastValidationOk === false) {
                            <app-icon name="x-circle" [size]="11" [strokeWidth]="2" class="text-signal-rose" />
                            <span class="text-signal-rose">Invalid</span>
                          } @else {
                            <span class="text-muted">Untested</span>
                          }
                        </dd>
                      </div>
                      @if (int.lastUsedAt) {
                        <div class="flex items-center justify-between gap-2">
                          <dt class="text-muted">Last used</dt>
                          <dd class="text-foreground">{{ int.lastUsedAt | date: 'short' }}</dd>
                        </div>
                      }
                    </dl>

                    <div class="mt-3 flex flex-wrap gap-1.5">
                      <button type="button" (click)="edit(p.id)" class="btn-secondary text-xs">
                        <app-icon name="edit" [size]="11" [strokeWidth]="2" />
                        <span>Update key</span>
                      </button>
                      <button type="button" (click)="toggle(p.id)" class="btn-secondary text-xs">
                        <app-icon
                          [name]="int.isActive ? 'pause' : 'play'"
                          [size]="11"
                          [strokeWidth]="2"
                        />
                        <span>{{ int.isActive ? 'Disable' : 'Enable' }}</span>
                      </button>
                      <button
                        type="button"
                        (click)="remove(p.id)"
                        class="btn-ghost text-xs text-signal-rose hover:bg-signal-rose/10"
                      >
                        <app-icon name="trash" [size]="11" [strokeWidth]="2" />
                        <span>Remove</span>
                      </button>
                    </div>
                  </div>
                }
              } @else {
                <button type="button" (click)="edit(p.id)" class="btn-secondary mt-3 self-start text-xs">
                  <app-icon name="plus" [size]="11" [strokeWidth]="2.5" />
                  <span>Add your {{ p.name }} key</span>
                </button>
              }
            </div>
          }
        </div>
      }

      <!-- ═══════════ EDIT MODAL ═══════════ -->
      @if (editing(); as editProvider) {
        <app-modal
          title="Add {{ meta(editProvider).name }} key"
          subtitle="Get your key from {{ meta(editProvider).docsUrl }}"
          size="md"
          (closed)="closeEdit()"
        >
          <div class="space-y-4">
            <div>
              <label for="int-key" class="label">API key</label>
              <input
                id="int-key"
                [(ngModel)]="form.apiKey"
                type="password"
                [placeholder]="meta(editProvider).keyPrefix + '...'"
                class="input font-mono text-sm"
                autocomplete="off"
              />
              <p class="mt-1.5 text-[11px] text-muted">
                <a
                  [href]="meta(editProvider).docsUrl"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="inline-flex items-center gap-0.5 text-relay-cyan hover:underline"
                >
                  Open {{ meta(editProvider).name }} dashboard
                  <app-icon name="external-link" [size]="10" [strokeWidth]="2" />
                </a>
              </p>
            </div>

            @if (meta(editProvider).supportsModel) {
              <div>
                <label for="int-model" class="label">Model (optional)</label>
                <input
                  id="int-model"
                  [(ngModel)]="form.model"
                  [placeholder]="meta(editProvider).modelHint"
                  class="input font-mono text-sm"
                  list="available-models"
                  autocomplete="off"
                />
                @if (testResult()?.models?.length) {
                  <datalist id="available-models">
                    @for (m of testResult()!.models!; track m) {
                      <option [value]="m"></option>
                    }
                  </datalist>
                  <p class="mt-1.5 text-[11px] text-muted">
                    {{ testResult()!.models!.length }} models available
                  </p>
                }
                <p class="mt-1.5 text-[11px] text-muted-2">
                  Leave empty to use the platform default.
                </p>
              </div>
            }

            @if (testResult()) {
              @if (testResult(); as r) {
                <div
                  class="rounded-lg border p-3 text-xs"
                  [ngClass]="{
                    'border-signal-green/30': r.ok,
                    'bg-signal-green/[0.06]': r.ok,
                    'border-signal-rose/30': !r.ok,
                    'bg-signal-rose/[0.06]': !r.ok
                  }"
                >
                  @if (r.ok) {
                    <p class="flex items-center gap-1.5 font-medium text-signal-green">
                      <app-icon name="check-circle" [size]="13" [strokeWidth]="2" />
                      Key is valid
                    </p>
                    @if (r.models?.length) {
                      <p class="mt-1 text-muted">{{ r.models!.length }} models available</p>
                    }
                  } @else {
                    <p class="flex items-center gap-1.5 font-medium text-signal-rose">
                      <app-icon name="x-circle" [size]="13" [strokeWidth]="2" />
                      {{ r.error }}
                    </p>
                  }
                </div>
              }
            }

            @if (error()) {
              <div class="flex items-start gap-2.5 rounded-lg border border-signal-rose/30 bg-signal-rose/10 px-3 py-2.5 text-sm text-signal-rose">
                <app-icon name="alert-circle" [size]="16" [strokeWidth]="2" class="mt-0.5 shrink-0" />
                <span>{{ error() }}</span>
              </div>
            }
          </div>

          <div modal-footer class="flex-col-reverse sm:flex-row">
            <button
              type="button"
              (click)="test()"
              [disabled]="!form.apiKey || testing()"
              class="btn-secondary text-xs sm:mr-auto"
            >
              @if (testing()) {
                <app-icon name="loader" [size]="12" [strokeWidth]="2.5" class="animate-spin" />
              } @else {
                <app-icon name="zap" [size]="12" [strokeWidth]="2" />
              }
              <span>{{ testing() ? 'Testing…' : 'Test key' }}</span>
            </button>
            <div class="flex flex-col-reverse gap-2 sm:flex-row">
              <button type="button" (click)="closeEdit()" class="btn-secondary text-xs">
                Cancel
              </button>
              <button
                type="button"
                (click)="save()"
                [disabled]="!form.apiKey || saving() || testResult()?.ok === false"
                class="btn-primary text-xs"
              >
                @if (saving()) {
                  <app-icon name="loader" [size]="12" [strokeWidth]="2.5" class="animate-spin" />
                }
                <span>{{ saving() ? 'Saving…' : 'Save key' }}</span>
              </button>
            </div>
          </div>
        </app-modal>
      }
    </div>
  `,
})
export class IntegrationsSettingsComponent implements OnInit {
  private readonly api = inject(IntegrationsApiService);
  private readonly confirm = inject(ConfirmDialogService);
  private readonly toast = inject(ToastService);

  readonly providers = PROVIDERS;

  readonly integrations = signal<Record<string, Integration>>({});
  readonly status = signal<Record<string, ProviderStatus>>({});
  readonly loading = signal(true);

  readonly editing = signal<Provider | null>(null);
  readonly testing = signal(false);
  readonly saving = signal(false);
  readonly testResult = signal<TestResult | null>(null);
  readonly error = signal<string | null>(null);

  form = { apiKey: '', model: '' };

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    Promise.all([
      new Promise<void>((resolve) => {
        this.api.list().subscribe({
          next: (list) => {
            const map: Record<string, Integration> = {};
            for (const i of list) map[i.provider] = i;
            this.integrations.set(map);
            resolve();
          },
          error: () => resolve(),
        });
      }),
      new Promise<void>((resolve) => {
        this.api.status().subscribe({
          next: (s) => {
            this.status.set(s);
            resolve();
          },
          error: () => resolve(),
        });
      }),
    ]).then(() => this.loading.set(false));
  }

  meta(provider: Provider): ProviderMeta {
    return this.providers.find((p) => p.id === provider)!;
  }

  edit(provider: Provider): void {
    this.editing.set(provider);
    const existing = this.integrations()[provider];
    this.form = { apiKey: '', model: existing?.model ?? '' };
    this.testResult.set(null);
    this.error.set(null);
  }

  closeEdit(): void {
    if (!this.saving()) this.editing.set(null);
  }

  test(): void {
    const provider = this.editing();
    if (!provider || !this.form.apiKey) return;
    this.testing.set(true);
    this.error.set(null);
    this.api.test(provider, this.form.apiKey).subscribe({
      next: (r) => {
        this.testResult.set(r);
        this.testing.set(false);
        if (r.ok) this.toast.success('Key is valid');
        else this.toast.error(r.error ?? 'Key is invalid');
      },
      error: (err) => {
        this.testResult.set({ ok: false, error: err?.error?.message ?? 'Test failed' });
        this.testing.set(false);
        this.toast.error('Test failed');
      },
    });
  }

  save(): void {
    const provider = this.editing();
    if (!provider || !this.form.apiKey || this.saving()) return;
    this.saving.set(true);
    this.error.set(null);

    this.api
      .upsert({
        provider,
        apiKey: this.form.apiKey,
        model: this.form.model || undefined,
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.editing.set(null);
          this.toast.success(`${this.meta(provider).name} key saved`);
          this.load();
        },
        error: (err) => {
          this.saving.set(false);
          this.error.set(err?.error?.message ?? 'Failed to save');
        },
      });
  }

  toggle(provider: Provider): void {
    this.api.toggle(provider).subscribe({
      next: () => {
        this.toast.success('Integration updated');
        this.load();
      },
      error: () => this.toast.error('Failed to update'),
    });
  }

  async remove(provider: Provider): Promise<void> {
    const ok = await this.confirm.confirm({
      title: `Remove ${this.meta(provider).name} key`,
      message: `Remove your ${this.meta(provider).name} key? The platform key will be used as fallback.`,
      confirmText: 'Remove',
      variant: 'danger',
      icon: 'trash',
    });
    if (!ok) return;

    this.api.remove(provider).subscribe({
      next: () => {
        this.toast.success('Key removed');
        this.load();
      },
      error: () => this.toast.error('Failed to remove'),
    });
  }
}