import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import {
  ApiKeysService,
  ApiKey,
  ApiKeyScope,
  IssuedApiKey,
} from '../../core/api/api-keys.service';

const ALL_SCOPES: ApiKeyScope[] = [
  'events:read',
  'workflows:read',
  'workflows:write',
  'destinations:read',
  'destinations:write',
  'dlq:read',
  'dlq:write',
  'analytics:read',
];

@Component({
  selector: 'app-api-keys',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslocoModule],
  template: `
    <div class="space-y-6">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold tracking-tightest text-white">{{ 'apiKeys.title' | transloco }}</h1>
          <p class="text-sm text-muted mt-1">{{ 'apiKeys.subtitle' | transloco }}</p>
        </div>
        <button (click)="openCreate()" class="btn-primary">{{ 'apiKeys.newKey' | transloco }}</button>
      </div>

      @if (issued(); as k) {
        <div class="card border-signal-green/30 bg-signal-green/5">
          <p class="text-sm text-white font-medium mb-2">{{ 'apiKeys.createdTitle' | transloco }}</p>
          <code class="block text-xs font-mono text-signal-green bg-surface-2 p-3 rounded break-all">{{ k.rawKey }}</code>
          <button (click)="copyRaw(k.rawKey)" class="btn-secondary text-xs mt-2">
            {{ (copied() ? 'apiKeys.copied' : 'apiKeys.copyKey') | transloco }}
          </button>
          <button (click)="issued.set(null)" class="text-xs text-muted ml-2 hover:text-white">
            {{ 'apiKeys.dismiss' | transloco }}
          </button>
        </div>
      }

      @if (loading()) {
        <div class="card text-sm text-muted">{{ 'apiKeys.loading' | transloco }}</div>
      } @else if (keys().length === 0) {
        <div class="card text-center py-12">
          <p class="text-sm text-muted">{{ 'apiKeys.empty' | transloco }}</p>
        </div>
      } @else {
        <div class="space-y-2">
          @for (k of keys(); track k.id) {
            <div class="card">
              <div class="flex justify-between items-start">
                <div class="min-w-0">
                  <div class="flex items-center gap-2">
                    <span class="text-white font-medium">{{ k.name }}</span>
                    <span class="text-xs px-2 py-0.5 rounded bg-surface-2 font-mono text-relay-cyan">{{ k.environment }}</span>
                    @if (k.revokedAt) {
                      <span class="text-xs px-2 py-0.5 rounded bg-signal-rose/20 text-signal-rose">{{ 'apiKeys.revoked' | transloco }}</span>
                    }
                  </div>
                  <p class="text-xs text-muted font-mono mt-1">{{ k.prefix }}…</p>
                  <div class="flex gap-1 mt-2 flex-wrap">
                    @for (s of k.scopes; track s) {
                      <span class="text-[10px] px-1.5 py-0.5 rounded bg-surface-2 text-muted font-mono">{{ s }}</span>
                    }
                  </div>
                  <p class="text-xs text-muted mt-2">
                    {{ 'apiKeys.created' | transloco }} {{ k.createdAt | date: 'short' }}
                    @if (k.lastUsedAt) { · {{ 'apiKeys.lastUsed' | transloco }} {{ k.lastUsedAt | date: 'short' }} }
                    @if (k.expiresAt) { · {{ 'apiKeys.expires' | transloco }} {{ k.expiresAt | date: 'short' }} }
                  </p>
                </div>
                @if (!k.revokedAt) {
                  <button (click)="revoke(k)" class="text-xs text-signal-rose hover:underline">{{ 'apiKeys.revoke' | transloco }}</button>
                }
              </div>
            </div>
          }
        </div>
      }

      <!-- Rotation history -->
      @if (rotations().length > 0) {
        <div class="card mt-6">
          <h2 class="text-sm font-medium text-white mb-3">{{ 'apiKeys.rotationHistory' | transloco }}</h2>
          <div class="space-y-2">
            @for (r of rotations(); track r.id) {
              <div class="flex justify-between text-xs bg-surface-2 p-2 rounded">
                <div class="text-muted font-mono">
                  {{ r.oldKeyId.slice(0, 8) }}… → {{ r.newKeyId.slice(0, 8) }}…
                </div>
                <div class="text-muted">
                  {{ r.createdAt | date: 'short' }} · {{ 'apiKeys.graceUntil' | transloco }} {{ r.graceUntil | date: 'short' }}
                </div>
              </div>
            }
          </div>
        </div>
      }

      @if (showCreate()) {
        <div class="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" (click)="closeCreate()">
          <div class="card w-full max-w-lg" (click)="$event.stopPropagation()">
            <h2 class="text-lg font-semibold text-white mb-4">{{ 'apiKeys.modal.title' | transloco }}</h2>
            <div class="space-y-4">
              <div>
                <label class="label">{{ 'apiKeys.modal.name' | transloco }}</label>
                <input [(ngModel)]="form.name" class="input" [placeholder]="'apiKeys.modal.namePlaceholder' | transloco" />
              </div>
              <div>
                <label class="label">{{ 'apiKeys.modal.environment' | transloco }}</label>
                <select [(ngModel)]="form.environment" class="input">
                  <option value="live">{{ 'apiKeys.modal.environments.live' | transloco }}</option>
                  <option value="test">{{ 'apiKeys.modal.environments.test' | transloco }}</option>
                </select>
              </div>
              <div>
                <label class="label">{{ 'apiKeys.modal.scopes' | transloco }}</label>
                <div class="grid grid-cols-2 gap-2">
                  @for (s of allScopes; track s) {
                    <label class="flex items-center gap-2 text-xs text-white">
                      <input
                        type="checkbox"
                        [checked]="form.scopes.includes(s)"
                        (change)="toggleScope(s)"
                        class="rounded border-hairline"
                      />
                      <span class="font-mono">{{ s }}</span>
                    </label>
                  }
                </div>
              </div>
              <label class="flex items-center gap-2 text-sm text-white">
                <input type="checkbox" [(ngModel)]="form.neverExpires" class="rounded border-hairline" />
                {{ 'apiKeys.modal.neverExpires' | transloco }}
              </label>
              @if (createError()) {
                <div class="text-sm text-signal-rose">{{ createError() }}</div>
              }
              <div class="flex justify-end gap-2">
                <button (click)="closeCreate()" class="btn-secondary">{{ 'common.cancel' | transloco }}</button>
                <button (click)="submit()" [disabled]="saving()" class="btn-primary">
                  {{ (saving() ? 'apiKeys.modal.creating' : 'apiKeys.modal.create') | transloco }}
                </button>
              </div>
            </div>
          </div>
        </div>
      }
    </div>
  `,
})
export class ApiKeysComponent implements OnInit {
  private svc = inject(ApiKeysService);
  private transloco = inject(TranslocoService);

  readonly allScopes = ALL_SCOPES;
  keys = signal<ApiKey[]>([]);
  loading = signal(true);
  issued = signal<IssuedApiKey | null>(null);
  copied = signal(false);
  showCreate = signal(false);
  saving = signal(false);
  createError = signal<string | null>(null);

  rotations = signal<Array<{
    id: string;
    oldKeyId: string;
    newKeyId: string;
    rotatedBy: string | null;
    graceUntil: string;
    createdAt: string;
  }>>([]);

  form = {
    name: '',
    environment: 'live' as 'live' | 'test',
    scopes: [] as ApiKeyScope[],
    neverExpires: false,
  };

  ngOnInit(): void {
    this.load();
    this.svc.rotationHistory().subscribe({
      next: (r) => this.rotations.set(r),
      error: () => this.rotations.set([]),
    });
  }

  load(): void {
    this.loading.set(true);
    this.svc.list().subscribe({
      next: (k) => {
        this.keys.set(k);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  openCreate(): void {
    this.form = { name: '', environment: 'live', scopes: ['events:read'], neverExpires: false };
    this.createError.set(null);
    this.showCreate.set(true);
  }

  closeCreate(): void {
    if (!this.saving()) this.showCreate.set(false);
  }

  toggleScope(s: ApiKeyScope): void {
    const has = this.form.scopes.includes(s);
    this.form.scopes = has
      ? this.form.scopes.filter((x) => x !== s)
      : [...this.form.scopes, s];
  }

  submit(): void {
    if (!this.form.name.trim() || this.form.scopes.length === 0 || this.saving()) return;
    this.saving.set(true);
    this.createError.set(null);

    this.svc
      .create({
        name: this.form.name,
        scopes: this.form.scopes,
        environment: this.form.environment,
        neverExpires: this.form.neverExpires,
      })
      .subscribe({
        next: (k) => {
          this.saving.set(false);
          this.showCreate.set(false);
          this.issued.set(k);
          this.load();
        },
        error: (err) => {
          this.saving.set(false);
          this.createError.set(err?.error?.message ?? 'apiKeys.errors.createFailed');
        },
      });
  }

  copyRaw(raw: string): void {
    navigator.clipboard.writeText(raw).then(() => {
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 1500);
    });
  }

  revoke(k: ApiKey): void {
    const msg = this.transloco.translate('apiKeys.revokeConfirm', { name: k.name });
    if (!confirm(msg)) return;
    this.svc.revoke(k.id).subscribe({ next: () => this.load() });
  }
}