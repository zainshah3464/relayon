import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslocoModule } from '@jsverse/transloco';
import {
  ApiKeysService,
  ApiKey,
  ApiKeyScope,
  IssuedApiKey,
} from '../../core/api/api-keys.service';
import { IconComponent } from '../../shared/ui/icon/icon.component';
import { ModalComponent } from '../../shared/ui/modal/modal.component';
import { ConfirmDialogService } from '../../shared/ui/confirm/confirm-dialog.service';
import { ToastService } from '../../shared/ui/toast/toast.service';

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

interface Rotation {
  id: string;
  oldKeyId: string;
  newKeyId: string;
  rotatedBy: string | null;
  graceUntil: string;
  createdAt: string;
}

@Component({
  selector: 'app-api-keys',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslocoModule, IconComponent, ModalComponent],
  template: `
    <div class="space-y-4">
      <!-- ═══════════ HEADER ═══════════ -->
      <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 class="text-lg font-semibold text-foreground">
            {{ 'apiKeys.title' | transloco }}
          </h2>
          <p class="mt-0.5 text-sm text-muted">
            {{ 'apiKeys.subtitle' | transloco }}
          </p>
        </div>
        <button type="button" (click)="openCreate()" class="btn-primary self-start sm:self-auto">
          <app-icon name="plus" [size]="13" [strokeWidth]="2.5" />
          <span>{{ 'apiKeys.newKey' | transloco }}</span>
        </button>
      </div>

      <!-- ═══════════ ISSUED KEY BANNER ═══════════ -->
      @if (issued(); as k) {
        <div class="rounded-xl border border-signal-green/30 bg-signal-green/[0.06] p-4 animate-slide-up">
          <div class="flex items-start gap-3">
            <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-signal-green/15 text-signal-green">
              <app-icon name="check-circle" [size]="18" [strokeWidth]="2" />
            </div>
            <div class="min-w-0 flex-1">
              <p class="text-sm font-semibold text-signal-green">
                {{ 'apiKeys.createdTitle' | transloco }}
              </p>
              <p class="mt-0.5 text-xs text-muted">
                Copy this key now — it won't be shown again.
              </p>

              <div class="mt-3 flex flex-col gap-2 sm:flex-row">
                <code class="min-w-0 flex-1 truncate rounded-md border border-signal-green/20 bg-midnight px-3 py-2 font-mono text-xs text-signal-green">
                  {{ k.rawKey }}
                </code>
                <button
                  type="button"
                  (click)="copyRaw(k.rawKey)"
                  class="btn-secondary shrink-0 text-xs"
                >
                  <app-icon [name]="copied() ? 'check' : 'copy'" [size]="12" [strokeWidth]="2.5" />
                  <span>{{ (copied() ? 'apiKeys.copied' : 'apiKeys.copyKey') | transloco }}</span>
                </button>
              </div>

              <button
                type="button"
                (click)="issued.set(null)"
                class="mt-2 text-xs text-muted transition-colors hover:text-foreground"
              >
                {{ 'apiKeys.dismiss' | transloco }}
              </button>
            </div>
          </div>
        </div>
      }

      <!-- ═══════════ KEYS LIST ═══════════ -->
      @if (loading()) {
        <div class="space-y-2">
          @for (i of [1, 2, 3]; track i) {
            <div class="card">
              <div class="skeleton h-4 w-40"></div>
              <div class="skeleton mt-2 h-3 w-24"></div>
              <div class="skeleton mt-3 h-5 w-32"></div>
            </div>
          }
        </div>
      } @else if (keys().length === 0) {
        <div class="card flex flex-col items-center justify-center py-12 text-center">
          <div class="flex h-12 w-12 items-center justify-center rounded-xl border border-hairline bg-surface-2 text-muted">
            <app-icon name="key" [size]="22" [strokeWidth]="1.75" />
          </div>
          <p class="mt-3 text-sm font-medium text-foreground">No API keys yet</p>
          <p class="mt-1 max-w-sm text-xs text-muted">
            {{ 'apiKeys.empty' | transloco }}
          </p>
          <button type="button" (click)="openCreate()" class="btn-primary mt-4 text-xs">
            <app-icon name="plus" [size]="12" [strokeWidth]="2.5" />
            <span>Create your first key</span>
          </button>
        </div>
      } @else {
        <div class="space-y-2">
          @for (k of keys(); track k.id) {
            <div class="card">
              <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div class="min-w-0 flex-1">
                  <div class="flex flex-wrap items-center gap-1.5">
                    <span class="text-sm font-semibold text-foreground">{{ k.name }}</span>
                    <span class="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] text-relay-cyan">
                      {{ k.environment }}
                    </span>
                    @if (k.revokedAt) {
                      <span class="badge badge-danger">{{ 'apiKeys.revoked' | transloco }}</span>
                    }
                  </div>

                  <code class="mt-1 block font-mono text-[11px] text-muted">{{ k.prefix }}…</code>

                  <div class="mt-2 flex flex-wrap gap-1">
                    @for (s of k.scopes; track s) {
                      <span class="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] text-muted">{{ s }}</span>
                    }
                  </div>

                  <p class="mt-2 text-[11px] text-muted-2">
                    {{ 'apiKeys.created' | transloco }} {{ k.createdAt | date: 'short' }}
                    @if (k.lastUsedAt) {
                      <span class="mx-1">·</span>
                      {{ 'apiKeys.lastUsed' | transloco }} {{ k.lastUsedAt | date: 'short' }}
                    }
                    @if (k.expiresAt) {
                      <span class="mx-1">·</span>
                      {{ 'apiKeys.expires' | transloco }} {{ k.expiresAt | date: 'short' }}
                    }
                  </p>
                </div>

                @if (!k.revokedAt) {
                  <button
                    type="button"
                    (click)="revoke(k)"
                    class="btn-ghost text-xs text-signal-rose hover:bg-signal-rose/10"
                  >
                    <app-icon name="trash" [size]="12" [strokeWidth]="2" />
                    <span>{{ 'apiKeys.revoke' | transloco }}</span>
                  </button>
                }
              </div>
            </div>
          }
        </div>
      }

      <!-- ═══════════ ROTATION HISTORY ═══════════ -->
      @if (rotations().length > 0) {
        <div class="card">
          <h3 class="flex items-center gap-2 text-sm font-semibold text-foreground">
            <app-icon name="refresh" [size]="13" [strokeWidth]="2" class="text-muted" />
            {{ 'apiKeys.rotationHistory' | transloco }}
          </h3>
          <div class="mt-3 space-y-1.5">
            @for (r of rotations(); track r.id) {
              <div class="flex flex-col gap-1 rounded-md border border-hairline bg-surface-2/50 p-2 text-xs sm:flex-row sm:items-center sm:justify-between">
                <div class="flex items-center gap-1.5 font-mono text-muted">
                  <span>{{ r.oldKeyId.slice(0, 8) }}…</span>
                  <app-icon name="arrow-right" [size]="10" [strokeWidth]="2.5" class="text-muted-2" />
                  <span>{{ r.newKeyId.slice(0, 8) }}…</span>
                </div>
                <div class="text-muted-2">
                  {{ r.createdAt | date: 'short' }}
                  <span class="mx-1">·</span>
                  {{ 'apiKeys.graceUntil' | transloco }} {{ r.graceUntil | date: 'short' }}
                </div>
              </div>
            }
          </div>
        </div>
      }

      <!-- ═══════════ CREATE MODAL ═══════════ -->
      @if (showCreate()) {
        <app-modal
          title="{{ 'apiKeys.modal.title' | transloco }}"
          subtitle="Scoped keys — only the permissions you select will be granted."
          size="md"
          (closed)="closeCreate()"
        >
          <div class="space-y-4">
            <div>
              <label for="key-name" class="label">{{ 'apiKeys.modal.name' | transloco }}</label>
              <input
                id="key-name"
                [(ngModel)]="form.name"
                class="input"
                [placeholder]="'apiKeys.modal.namePlaceholder' | transloco"
                autocomplete="off"
              />
            </div>

            <div>
              <label for="key-env" class="label">
                {{ 'apiKeys.modal.environment' | transloco }}
              </label>
              <select id="key-env" [(ngModel)]="form.environment" class="input">
                <option value="live">{{ 'apiKeys.modal.environments.live' | transloco }}</option>
                <option value="test">{{ 'apiKeys.modal.environments.test' | transloco }}</option>
              </select>
            </div>

            <div>
              <label class="label">{{ 'apiKeys.modal.scopes' | transloco }}</label>
              <div class="grid grid-cols-1 gap-1.5 rounded-lg border border-hairline bg-surface-2/50 p-3 sm:grid-cols-2">
                @for (s of allScopes; track s) {
                  <label class="flex cursor-pointer items-center gap-2 rounded p-1 text-xs text-foreground transition-colors hover:bg-surface-3">
                    <input
                      type="checkbox"
                      [checked]="form.scopes.includes(s)"
                      (change)="toggleScope(s)"
                      class="h-3.5 w-3.5 rounded border-hairline-strong bg-surface-3 text-relay-violet"
                    />
                    <span class="font-mono">{{ s }}</span>
                  </label>
                }
              </div>
              @if (form.scopes.length === 0) {
                <p class="mt-1.5 text-xs text-signal-rose">Select at least one scope</p>
              }
            </div>

            <label class="flex cursor-pointer items-center gap-2.5 rounded-lg border border-hairline bg-surface-2/50 p-3">
              <input
                type="checkbox"
                [(ngModel)]="form.neverExpires"
                class="h-4 w-4 rounded border-hairline-strong bg-surface-3 text-relay-violet"
              />
              <span class="text-sm text-foreground">{{ 'apiKeys.modal.neverExpires' | transloco }}</span>
            </label>

            @if (createError()) {
              <div class="flex items-start gap-2.5 rounded-lg border border-signal-rose/30 bg-signal-rose/10 px-3 py-2.5 text-sm text-signal-rose">
                <app-icon name="alert-circle" [size]="16" [strokeWidth]="2" class="mt-0.5 shrink-0" />
                <span>{{ createError() }}</span>
              </div>
            }
          </div>

          <div modal-footer>
            <button type="button" (click)="closeCreate()" class="btn-secondary">
              {{ 'common.cancel' | transloco }}
            </button>
            <button
              type="button"
              (click)="submit()"
              [disabled]="!form.name.trim() || form.scopes.length === 0 || saving()"
              class="btn-primary"
            >
              @if (saving()) {
                <app-icon name="loader" [size]="13" [strokeWidth]="2.5" class="animate-spin" />
              } @else {
                <app-icon name="key" [size]="13" [strokeWidth]="2" />
              }
              <span>{{ (saving() ? 'apiKeys.modal.creating' : 'apiKeys.modal.create') | transloco }}</span>
            </button>
          </div>
        </app-modal>
      }
    </div>
  `,
})
export class ApiKeysComponent implements OnInit {
  private readonly svc = inject(ApiKeysService);
  private readonly confirm = inject(ConfirmDialogService);
  private readonly toast = inject(ToastService);

  readonly allScopes = ALL_SCOPES;
  readonly keys = signal<ApiKey[]>([]);
  readonly loading = signal(true);
  readonly issued = signal<IssuedApiKey | null>(null);
  readonly copied = signal(false);
  readonly showCreate = signal(false);
  readonly saving = signal(false);
  readonly createError = signal<string | null>(null);
  readonly rotations = signal<Rotation[]>([]);

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
          this.toast.success(`API key "${k.name}" created`);
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
      this.toast.success('API key copied to clipboard');
      setTimeout(() => this.copied.set(false), 1500);
    });
  }

  async revoke(k: ApiKey): Promise<void> {
    const ok = await this.confirm.confirm({
      title: 'Revoke API key',
      message: `Revoke "${k.name}"? Any client using this key will stop working immediately. This cannot be undone.`,
      confirmText: 'Revoke',
      variant: 'danger',
      icon: 'trash',
    });
    if (!ok) return;

    this.svc.revoke(k.id).subscribe({
      next: () => {
        this.toast.success('API key revoked');
        this.load();
      },
      error: () => this.toast.error('Failed to revoke key'),
    });
  }
}