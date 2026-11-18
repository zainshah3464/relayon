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

interface ProviderMeta {
  id: Provider;
  name: string;
  description: string;
  keyPrefix: string;
  docsUrl: string;
  modelHint: string;
}

const PROVIDERS: ProviderMeta[] = [
  {
    id: 'groq',
    name: 'Groq',
    description: 'Powers AI enrichment and chat assistant. Free tier: 30 req/min.',
    keyPrefix: 'gsk_',
    docsUrl: 'https://console.groq.com/keys',
    modelHint: 'e.g. openai/gpt-oss-120b, openai/gpt-oss-20b',
  },
  {
    id: 'openai',
    name: 'OpenAI',
    description: 'Alternative AI provider. Useful if you want GPT-4 or embeddings.',
    keyPrefix: 'sk-',
    docsUrl: 'https://platform.openai.com/api-keys',
    modelHint: 'e.g. gpt-4o-mini, gpt-4o',
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    description: 'Claude models — good for long context and careful reasoning.',
    keyPrefix: 'sk-ant-',
    docsUrl: 'https://console.anthropic.com/settings/keys',
    modelHint: 'e.g. claude-3-5-sonnet-20241022',
  },
  {
    id: 'resend',
    name: 'Resend',
    description: 'Powers auth emails (verification, password reset).',
    keyPrefix: 're_',
    docsUrl: 'https://resend.com/api-keys',
    modelHint: '',
  },
];

@Component({
  selector: 'app-integrations-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="space-y-6 max-w-4xl">
      <div>
        <h1 class="text-2xl font-bold text-white">Integrations & API Keys</h1>
        <p class="text-sm text-muted mt-1">
          Bring your own API keys to use your own quota. If you don't add a key, Relayon uses its own.
        </p>
      </div>

      <div class="rounded-xl border border-relay-cyan/20 bg-relay-cyan/5 p-4">
        <p class="text-sm text-relay-cyan">
          <strong>💡 Why BYOK?</strong> Your keys give you control — your quota, your rate limits, your billing. When you add a key, that provider uses it exclusively for your workspace.
        </p>
      </div>

      @if (loading()) {
        <div class="card text-sm text-muted">Loading integrations...</div>
      } @else {
        <div class="space-y-3">
          @for (p of providers; track p.id) {
            <div class="card">
              <div class="flex justify-between items-start mb-3">
                <div class="flex items-center gap-3">
                  <div class="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-relay-violet to-relay-cyan text-white text-sm font-bold">
                    {{ p.name[0] }}
                  </div>
                  <div>
                    <h3 class="text-white font-medium">{{ p.name }}</h3>
                    <p class="text-xs text-muted">{{ p.description }}</p>
                  </div>
                </div>
                @if (status()[p.id]; as s) {
                  @if (s.source === 'tenant') {
                    <span class="text-xs px-2 py-0.5 rounded bg-signal-green/20 text-signal-green whitespace-nowrap">
                      ✓ Your key
                    </span>
                  } @else if (s.source === 'platform') {
                    <span class="text-xs px-2 py-0.5 rounded bg-signal-amber/20 text-signal-amber whitespace-nowrap">
                      Platform key
                    </span>
                  } @else {
                    <span class="text-xs px-2 py-0.5 rounded bg-signal-rose/20 text-signal-rose whitespace-nowrap">
                      Not configured
                    </span>
                  }
                }
              </div>

              <!-- Active state -->
              @if (integrations()[p.id]; as int) {
                <div class="bg-surface-2 rounded-lg p-3 space-y-2">
                  <div class="flex justify-between text-xs">
                    <span class="text-muted">API key</span>
                    <span class="font-mono text-white">{{ int.apiKey }}</span>
                  </div>
                  @if (int.model) {
                    <div class="flex justify-between text-xs">
                      <span class="text-muted">Model</span>
                      <span class="font-mono text-white">{{ int.model }}</span>
                    </div>
                  }
                  <div class="flex justify-between text-xs">
                    <span class="text-muted">Status</span>
                    <span [class.text-signal-green]="int.lastValidationOk" [class.text-signal-rose]="int.lastValidationOk === false">
                      @if (int.lastValidationOk === true) { ✓ Valid }
                      @else if (int.lastValidationOk === false) { ✗ Invalid — {{ int.validationError }} }
                      @else { Untested }
                    </span>
                  </div>
                  @if (int.lastUsedAt) {
                    <div class="flex justify-between text-xs">
                      <span class="text-muted">Last used</span>
                      <span class="text-white">{{ int.lastUsedAt | date: 'short' }}</span>
                    </div>
                  }

                  <div class="flex gap-2 pt-2">
                    <button (click)="edit(p.id)" class="btn-secondary text-xs">Update key</button>
                    <button (click)="toggle(p.id)" class="btn-secondary text-xs">
                      {{ int.isActive ? 'Disable' : 'Enable' }}
                    </button>
                    <button (click)="remove(p.id)" class="text-xs text-signal-rose hover:underline">Remove</button>
                  </div>
                </div>
              } @else {
                <button (click)="edit(p.id)" class="btn-secondary text-xs">
                  + Add your {{ p.name }} key
                </button>
              }
            </div>
          }
        </div>
      }

      <!-- Edit modal -->
      @if (editing(); as editProvider) {
        <div class="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" (click)="closeEdit()">
          <div class="card w-full max-w-lg" (click)="$event.stopPropagation()">
            <h2 class="text-lg font-semibold text-white mb-1">Add {{ meta(editProvider).name }} key</h2>
            <p class="text-xs text-muted mb-4">
              Get your key from
              <a [href]="meta(editProvider).docsUrl" target="_blank" rel="noopener" class="text-relay-cyan hover:underline">
                {{ meta(editProvider).docsUrl }}
              </a>
            </p>

            <div class="space-y-3">
              <div>
                <label class="label">API key</label>
                <input
                  [(ngModel)]="form.apiKey"
                  type="password"
                  [placeholder]="meta(editProvider).keyPrefix + '...'"
                  class="input font-mono text-sm"
                />
              </div>

              @if (editProvider === 'groq' || editProvider === 'openai' || editProvider === 'anthropic') {
                <div>
                  <label class="label">Model (optional)</label>
                  <input
                    [(ngModel)]="form.model"
                    [placeholder]="meta(editProvider).modelHint"
                    class="input font-mono text-sm"
                    list="available-models"
                  />
                  @if (testResult()?.models?.length) {
                    <datalist id="available-models">
                      @for (m of testResult()!.models!; track m) {
                        <option [value]="m"></option>
                      }
                    </datalist>
                    <p class="text-xs text-muted mt-1">
                      {{ testResult()!.models!.length }} models available
                    </p>
                  }
                  <p class="text-xs text-muted mt-1">
                    Leave empty to use the platform default.
                  </p>
                </div>
              }

              @if (testResult(); as r) {
                <!-- ⚠️ Fixed: slashed Tailwind classes moved into ngClass string values -->
                <div
                  class="rounded-lg border p-2 text-xs"
                  [ngClass]="r.ok ? 'border-signal-green/30 bg-signal-green/5' : 'border-signal-rose/30 bg-signal-rose/5'"
                >
                  @if (r.ok) {
                    <p class="text-signal-green font-medium">✓ Key is valid</p>
                    @if (r.models?.length) {
                      <p class="text-muted mt-1">{{ r.models!.length }} models available</p>
                    }
                  } @else {
                    <p class="text-signal-rose font-medium">✗ {{ r.error }}</p>
                  }
                </div>
              }

              @if (error()) {
                <p class="text-sm text-signal-rose">{{ error() }}</p>
              }
            </div>

            <div class="flex justify-between gap-2 mt-4">
              <button (click)="test()" [disabled]="!form.apiKey || testing()" class="btn-secondary text-xs">
                {{ testing() ? 'Testing...' : 'Test key' }}
              </button>
              <div class="flex gap-2">
                <button (click)="closeEdit()" class="btn-secondary text-xs">Cancel</button>
                <button
                  (click)="save()"
                  [disabled]="!form.apiKey || saving() || testResult()?.ok === false"
                  class="btn-primary text-xs"
                >
                  {{ saving() ? 'Saving...' : 'Save key' }}
                </button>
              </div>
            </div>
          </div>
        </div>
      }
    </div>
  `,
})
export class IntegrationsSettingsComponent implements OnInit {
  private readonly api = inject(IntegrationsApiService);

  readonly providers = PROVIDERS;

  integrations = signal<Record<string, Integration>>({});
  status = signal<Record<string, ProviderStatus>>({});
  loading = signal(true);

  editing = signal<Provider | null>(null);
  form = { apiKey: '', model: '' };
  testing = signal(false);
  saving = signal(false);
  testResult = signal<TestResult | null>(null);
  error = signal<string | null>(null);

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
      },
      error: (err) => {
        this.testResult.set({ ok: false, error: err?.error?.message ?? 'Test failed' });
        this.testing.set(false);
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
          this.load();
        },
        error: (err) => {
          this.saving.set(false);
          this.error.set(err?.error?.message ?? 'Failed to save');
        },
      });
  }

  toggle(provider: Provider): void {
    this.api.toggle(provider).subscribe({ next: () => this.load() });
  }

  remove(provider: Provider): void {
    if (!confirm(`Remove your ${this.meta(provider).name} key? Platform key will be used as fallback.`)) return;
    this.api.remove(provider).subscribe({ next: () => this.load() });
  }
}