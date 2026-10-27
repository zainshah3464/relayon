import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
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
  imports: [CommonModule, FormsModule],
  template: `
    <div class="space-y-6">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold tracking-tightest text-white">API Keys</h1>
          <p class="text-sm text-muted mt-1">Programmatic access to Relayon. Keys are hashed — raw value shown once.</p>
        </div>
        <button (click)="openCreate()" class="btn-primary">+ New key</button>
      </div>

      @if (issued(); as k) {
        <div class="card border-signal-green/30 bg-signal-green/5">
          <p class="text-sm text-white font-medium mb-2">✅ Key created — copy now. It won't be shown again.</p>
          <code class="block text-xs font-mono text-signal-green bg-surface-2 p-3 rounded break-all">{{ k.rawKey }}</code>
          <button (click)="copyRaw(k.rawKey)" class="btn-secondary text-xs mt-2">{{ copied() ? 'Copied!' : 'Copy key' }}</button>
          <button (click)="issued.set(null)" class="text-xs text-muted ml-2 hover:text-white">Dismiss</button>
        </div>
      }

      @if (loading()) {
        <div class="card text-sm text-muted">Loading API keys...</div>
      } @else if (keys().length === 0) {
        <div class="card text-center py-12">
          <p class="text-sm text-muted">No API keys yet. Create one to enable programmatic access.</p>
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
                      <span class="text-xs px-2 py-0.5 rounded bg-signal-rose/20 text-signal-rose">Revoked</span>
                    }
                  </div>
                  <p class="text-xs text-muted font-mono mt-1">{{ k.prefix }}…</p>
                  <div class="flex gap-1 mt-2 flex-wrap">
                    @for (s of k.scopes; track s) {
                      <span class="text-[10px] px-1.5 py-0.5 rounded bg-surface-2 text-muted font-mono">{{ s }}</span>
                    }
                  </div>
                  <p class="text-xs text-muted mt-2">
                    Created {{ k.createdAt | date: 'short' }}
                    @if (k.lastUsedAt) { · Last used {{ k.lastUsedAt | date: 'short' }} }
                    @if (k.expiresAt) { · Expires {{ k.expiresAt | date: 'short' }} }
                  </p>
                </div>
                @if (!k.revokedAt) {
                  <button (click)="revoke(k)" class="text-xs text-signal-rose hover:underline">Revoke</button>
                }
              </div>
            </div>
          }
        </div>
      }

      <!-- Rotation history -->
      @if (rotations().length > 0) {
        <div class="card mt-6">
          <h2 class="text-sm font-medium text-white mb-3">Rotation history</h2>
          <div class="space-y-2">
            @for (r of rotations(); track r.id) {
              <div class="flex justify-between text-xs bg-surface-2 p-2 rounded">
                <div class="text-muted font-mono">
                  {{ r.oldKeyId.slice(0, 8) }}… → {{ r.newKeyId.slice(0, 8) }}…
                </div>
                <div class="text-muted">
                  {{ r.createdAt | date: 'short' }} · grace until {{ r.graceUntil | date: 'short' }}
                </div>
              </div>
            }
          </div>
        </div>
      }

      @if (showCreate()) {
        <div class="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" (click)="closeCreate()">
          <div class="card w-full max-w-lg" (click)="$event.stopPropagation()">
            <h2 class="text-lg font-semibold text-white mb-4">Create API key</h2>
            <div class="space-y-4">
              <div>
                <label class="label">Name</label>
                <input [(ngModel)]="form.name" class="input" placeholder="CI pipeline" />
              </div>
              <div>
                <label class="label">Environment</label>
                <select [(ngModel)]="form.environment" class="input">
                  <option value="live">Live</option>
                  <option value="test">Test</option>
                </select>
              </div>
              <div>
                <label class="label">Scopes</label>
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
                Never expires
              </label>
              @if (createError()) {
                <div class="text-sm text-signal-rose">{{ createError() }}</div>
              }
              <div class="flex justify-end gap-2">
                <button (click)="closeCreate()" class="btn-secondary">Cancel</button>
                <button (click)="submit()" [disabled]="saving()" class="btn-primary">
                  {{ saving() ? 'Creating...' : 'Create' }}
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
          this.createError.set(err?.error?.message ?? 'Failed to create key');
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
    if (!confirm(`Revoke "${k.name}"? This cannot be undone.`)) return;
    this.svc.revoke(k.id).subscribe({ next: () => this.load() });
  }
}