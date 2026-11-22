import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { IconComponent } from '../../shared/ui/icon/icon.component';
import { ModalComponent } from '../../shared/ui/modal/modal.component';
import { ConfirmDialogService } from '../../shared/ui/confirm/confirm-dialog.service';
import { ToastService } from '../../shared/ui/toast/toast.service';

interface WebhookEndpoint {
  id: string;
  url: string;
  description: string | null;
  eventTypes: string[];
  isActive: boolean;
  consecutiveFailures: number;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  createdAt: string;
}

const ALL_EVENTS = [
  'workflow.created',
  'workflow.updated',
  'workflow.deleted',
  'event.received',
  'delivery.succeeded',
  'delivery.failed',
  'dlq.entry_created',
  'quota.warning',
  'quota.exceeded',
];

@Component({
  selector: 'app-webhooks-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent, ModalComponent],
  template: `
    <div class="space-y-4">
      <!-- ═══════════ HEADER ═══════════ -->
      <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 class="text-lg font-semibold text-foreground">Outbound webhooks</h2>
          <p class="mt-0.5 text-sm text-muted">
            Receive Standard Webhooks-signed events when workflows change, deliveries succeed or fail, or quotas are hit.
          </p>
        </div>
        <button
          type="button"
          (click)="openCreate()"
          class="btn-primary self-start sm:self-auto"
        >
          <app-icon name="plus" [size]="13" [strokeWidth]="2.5" />
          <span>Add endpoint</span>
        </button>
      </div>

      <!-- ═══════════ JUST CREATED BANNER ═══════════ -->
      @if (justCreated(); as c) {
        <div class="rounded-xl border border-signal-green/30 bg-signal-green/[0.06] p-4 animate-slide-up">
          <div class="flex items-start gap-3">
            <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-signal-green/15 text-signal-green">
              <app-icon name="check-circle" [size]="18" [strokeWidth]="2" />
            </div>
            <div class="min-w-0 flex-1">
              <p class="text-sm font-semibold text-signal-green">Endpoint created</p>
              <p class="mt-0.5 text-xs text-muted">
                Copy this secret now — it verifies incoming signatures and won't be shown again.
              </p>
              <div class="mt-3 flex flex-col gap-2 sm:flex-row">
                <code class="min-w-0 flex-1 truncate rounded-md border border-signal-green/20 bg-midnight px-3 py-2 font-mono text-xs text-signal-green">
                  {{ c.secret }}
                </code>
                <button type="button" (click)="copySecret(c.secret)" class="btn-secondary shrink-0 text-xs">
                  <app-icon name="copy" [size]="12" [strokeWidth]="2.5" />
                  <span>Copy</span>
                </button>
              </div>
              <button
                type="button"
                (click)="justCreated.set(null)"
                class="mt-2 text-xs text-muted transition-colors hover:text-foreground"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      }

      <!-- ═══════════ LIST ═══════════ -->
      @if (loading()) {
        <div class="space-y-2">
          @for (i of [1, 2]; track i) {
            <div class="card">
              <div class="skeleton h-4 w-64"></div>
              <div class="skeleton mt-2 h-3 w-40"></div>
              <div class="skeleton mt-3 h-4 w-48"></div>
            </div>
          }
        </div>
      } @else if (items().length === 0) {
        <div class="card flex flex-col items-center justify-center py-12 text-center">
          <div class="flex h-12 w-12 items-center justify-center rounded-xl border border-hairline bg-surface-2 text-muted">
            <app-icon name="webhook" [size]="22" [strokeWidth]="1.75" />
          </div>
          <p class="mt-3 text-sm font-medium text-foreground">No outbound endpoints</p>
          <p class="mt-1 max-w-sm text-xs text-muted">
            Add a URL to receive signed webhook events from Relayon.
          </p>
          <button type="button" (click)="openCreate()" class="btn-primary mt-4 text-xs">
            <app-icon name="plus" [size]="12" [strokeWidth]="2.5" />
            <span>Add endpoint</span>
          </button>
        </div>
      } @else {
        <div class="space-y-2">
          @for (e of items(); track e.id) {
            <div class="card">
              <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div class="min-w-0 flex-1">
                  <div class="flex flex-wrap items-center gap-1.5">
                    <code class="truncate font-mono text-xs text-relay-cyan">{{ e.url }}</code>
                    @if (!e.isActive) {
                      <span class="badge">Paused</span>
                    }
                    @if (e.consecutiveFailures >= 3) {
                      <span class="badge badge-warning">
                        <app-icon name="alert-triangle" [size]="9" [strokeWidth]="2.5" />
                        {{ e.consecutiveFailures }} failures
                      </span>
                    }
                  </div>

                  @if (e.description) {
                    <p class="mt-1 text-xs text-muted">{{ e.description }}</p>
                  }

                  <div class="mt-2 flex flex-wrap gap-1">
                    @if (e.eventTypes.length === 0) {
                      <span class="badge badge-success">all events</span>
                    } @else {
                      @for (t of e.eventTypes; track t) {
                        <span class="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] text-muted">{{ t }}</span>
                      }
                    }
                  </div>

                  <p class="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-2">
                    @if (e.lastSuccessAt) {
                      <span class="flex items-center gap-1">
                        <app-icon name="check" [size]="10" [strokeWidth]="3" class="text-signal-green" />
                        Last success {{ e.lastSuccessAt | date: 'short' }}
                      </span>
                    }
                    @if (e.lastFailureAt) {
                      @if (e.lastSuccessAt) {
                        <span>·</span>
                      }
                      <span class="flex items-center gap-1">
                        <app-icon name="x" [size]="10" [strokeWidth]="3" class="text-signal-rose" />
                        Last failure {{ e.lastFailureAt | date: 'short' }}
                      </span>
                    }
                  </p>
                </div>

                <div class="flex shrink-0 gap-1">
                  <button
                    type="button"
                    (click)="toggle(e)"
                    class="btn-ghost text-xs"
                  >
                    <app-icon
                      [name]="e.isActive ? 'pause' : 'play'"
                      [size]="12"
                      [strokeWidth]="2"
                    />
                    <span class="hidden sm:inline">{{ e.isActive ? 'Pause' : 'Resume' }}</span>
                  </button>
                  <button
                    type="button"
                    (click)="remove(e)"
                    class="btn-ghost text-xs text-signal-rose hover:bg-signal-rose/10"
                  >
                    <app-icon name="trash" [size]="12" [strokeWidth]="2" />
                    <span class="hidden sm:inline">Delete</span>
                  </button>
                </div>
              </div>
            </div>
          }
        </div>
      }

      <!-- ═══════════ CREATE MODAL ═══════════ -->
      @if (showCreate()) {
        <app-modal
          title="Add webhook endpoint"
          subtitle="We'll POST signed events to this URL with the selected event types."
          size="md"
          (closed)="closeCreate()"
        >
          <div class="space-y-4">
            <div>
              <label for="wh-url" class="label">URL</label>
              <input
                id="wh-url"
                [(ngModel)]="form.url"
                class="input font-mono text-xs"
                placeholder="https://your-server.com/webhooks/relayon"
                autocomplete="off"
              />
            </div>

            <div>
              <label for="wh-desc" class="label">Description (optional)</label>
              <input
                id="wh-desc"
                [(ngModel)]="form.description"
                class="input"
                placeholder="Production alerts"
                autocomplete="off"
              />
            </div>

            <div>
              <div class="flex items-center justify-between">
                <label class="label mb-0">Event types</label>
                <button
                  type="button"
                  (click)="form.eventTypes.length === allEvents.length ? clearAll() : selectAll()"
                  class="text-[11px] font-medium text-relay-cyan hover:underline"
                >
                  {{ form.eventTypes.length === allEvents.length ? 'Clear all' : 'Select all' }}
                </button>
              </div>
              <div class="mt-2 max-h-48 overflow-y-auto rounded-lg border border-hairline bg-surface-2/50 p-2">
                @for (evt of allEvents; track evt) {
                  <label class="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-xs text-foreground transition-colors hover:bg-surface-3">
                    <input
                      type="checkbox"
                      [checked]="form.eventTypes.includes(evt)"
                      (change)="toggleEvent(evt)"
                      class="h-3.5 w-3.5 rounded border-hairline-strong bg-surface-3 text-relay-violet"
                    />
                    <span class="font-mono">{{ evt }}</span>
                  </label>
                }
              </div>
              <p class="mt-1.5 text-[11px] text-muted-2">
                Empty = subscribe to all events.
              </p>
            </div>

            @if (error()) {
              <div class="flex items-start gap-2.5 rounded-lg border border-signal-rose/30 bg-signal-rose/10 px-3 py-2.5 text-sm text-signal-rose">
                <app-icon name="alert-circle" [size]="16" [strokeWidth]="2" class="mt-0.5 shrink-0" />
                <span>{{ error() }}</span>
              </div>
            }
          </div>

          <div modal-footer>
            <button type="button" (click)="closeCreate()" class="btn-secondary">
              Cancel
            </button>
            <button
              type="button"
              (click)="submitCreate()"
              [disabled]="saving() || !form.url"
              class="btn-primary"
            >
              @if (saving()) {
                <app-icon name="loader" [size]="13" [strokeWidth]="2.5" class="animate-spin" />
              } @else {
                <app-icon name="plus" [size]="13" [strokeWidth]="2.5" />
              }
              <span>{{ saving() ? 'Creating…' : 'Create endpoint' }}</span>
            </button>
          </div>
        </app-modal>
      }
    </div>
  `,
})
export class WebhooksSettingsComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly confirm = inject(ConfirmDialogService);
  private readonly toast = inject(ToastService);

  readonly allEvents = ALL_EVENTS;

  readonly items = signal<WebhookEndpoint[]>([]);
  readonly loading = signal(true);
  readonly showCreate = signal(false);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly justCreated = signal<{ secret: string } | null>(null);

  form = { url: '', description: '', eventTypes: [] as string[] };

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.http.get<WebhookEndpoint[]>(`${environment.apiUrl}/api/webhook-endpoints`).subscribe({
      next: (r) => {
        this.items.set(r);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  openCreate(): void {
    this.form = { url: '', description: '', eventTypes: [] };
    this.error.set(null);
    this.showCreate.set(true);
  }

  closeCreate(): void {
    if (!this.saving()) this.showCreate.set(false);
  }

  toggleEvent(evt: string): void {
    this.form.eventTypes = this.form.eventTypes.includes(evt)
      ? this.form.eventTypes.filter((x) => x !== evt)
      : [...this.form.eventTypes, evt];
  }

  selectAll(): void {
    this.form.eventTypes = [...this.allEvents];
  }

  clearAll(): void {
    this.form.eventTypes = [];
  }

  submitCreate(): void {
    if (this.saving() || !this.form.url) return;
    this.saving.set(true);
    this.error.set(null);

    this.http
      .post<{ id: string; secret: string }>(
        `${environment.apiUrl}/api/webhook-endpoints`,
        this.form,
      )
      .subscribe({
        next: (r) => {
          this.saving.set(false);
          this.showCreate.set(false);
          this.justCreated.set({ secret: r.secret });
          this.toast.success('Endpoint created');
          this.load();
        },
        error: (err) => {
          this.saving.set(false);
          this.error.set(err?.error?.message ?? 'Failed to create endpoint');
        },
      });
  }

  copySecret(secret: string): void {
    navigator.clipboard.writeText(secret).then(() => {
      this.toast.success('Secret copied to clipboard');
    });
  }

  toggle(e: WebhookEndpoint): void {
    this.http
      .post(`${environment.apiUrl}/api/webhook-endpoints/${e.id}/toggle`, {})
      .subscribe({
        next: () => {
          this.toast.success(e.isActive ? 'Endpoint paused' : 'Endpoint resumed');
          this.load();
        },
        error: () => this.toast.error('Failed to update endpoint'),
      });
  }

  async remove(e: WebhookEndpoint): Promise<void> {
    const ok = await this.confirm.confirm({
      title: 'Delete endpoint',
      message: `Delete endpoint ${e.url}? This cannot be undone.`,
      confirmText: 'Delete',
      variant: 'danger',
      icon: 'trash',
    });
    if (!ok) return;

    this.http
      .delete(`${environment.apiUrl}/api/webhook-endpoints/${e.id}`)
      .subscribe({
        next: () => {
          this.toast.success('Endpoint deleted');
          this.load();
        },
        error: () => this.toast.error('Failed to delete endpoint'),
      });
  }
}