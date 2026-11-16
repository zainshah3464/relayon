import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

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
  imports: [CommonModule, FormsModule],
  template: `
    <div class="space-y-6">
      <div class="flex justify-between items-start">
        <div>
          <h1 class="text-2xl font-bold text-white">Outbound webhooks</h1>
          <p class="text-sm text-muted mt-1">
            Receive Standard Webhooks-signed events when workflows change,
            deliveries succeed/fail, or quotas are hit.
          </p>
        </div>
        <button (click)="openCreate()" class="btn-primary text-sm">+ Add endpoint</button>
      </div>

      @if (justCreated(); as c) {
        <div class="card border-signal-green/30 bg-signal-green/5">
          <p class="text-sm font-medium text-white mb-2">✅ Endpoint created. Copy the secret now:</p>
          <code class="block text-xs font-mono text-signal-green bg-midnight p-3 rounded break-all">{{ c.secret }}</code>
          <p class="text-xs text-muted mt-2">Use this <code>whsec_</code> secret to verify incoming signatures. It will not be shown again.</p>
          <button (click)="justCreated.set(null)" class="btn-secondary text-xs mt-2">Dismiss</button>
        </div>
      }

      @if (loading()) {
        <div class="card text-sm text-muted">Loading endpoints...</div>
      } @else if (items().length === 0) {
        <div class="card text-center py-12">
          <p class="text-sm text-muted">No webhook endpoints yet.</p>
        </div>
      } @else {
        <div class="space-y-2">
          @for (e of items(); track e.id) {
            <div class="card">
              <div class="flex justify-between items-start">
                <div class="min-w-0 flex-1">
                  <div class="flex items-center gap-2">
                    <code class="text-xs font-mono text-relay-cyan">{{ e.url }}</code>
                    @if (!e.isActive) {
                      <span class="text-xs px-2 py-0.5 rounded bg-signal-rose/20 text-signal-rose">Paused</span>
                    }
                    @if (e.consecutiveFailures >= 3) {
                      <span class="text-xs px-2 py-0.5 rounded bg-signal-amber/20 text-signal-amber">
                        {{ e.consecutiveFailures }} failures
                      </span>
                    }
                  </div>
                  @if (e.description) {
                    <p class="text-xs text-muted mt-1">{{ e.description }}</p>
                  }
                  <div class="flex gap-1 mt-2 flex-wrap">
                    @for (t of e.eventTypes; track t) {
                      <span class="text-[10px] px-1.5 py-0.5 rounded bg-surface-2 text-muted font-mono">{{ t }}</span>
                    }
                    @if (e.eventTypes.length === 0) {
                      <span class="text-[10px] px-1.5 py-0.5 rounded bg-surface-2 text-signal-green font-mono">all events</span>
                    }
                  </div>
                  <p class="text-xs text-muted mt-2">
                    @if (e.lastSuccessAt) { Last success: {{ e.lastSuccessAt | date: 'short' }} }
                    @if (e.lastFailureAt) { · Last failure: {{ e.lastFailureAt | date: 'short' }} }
                  </p>
                </div>
                <div class="flex gap-2 shrink-0">
                  <button (click)="toggle(e)" class="text-xs text-muted hover:text-white">
                    {{ e.isActive ? 'Pause' : 'Resume' }}
                  </button>
                  <button (click)="remove(e)" class="text-xs text-signal-rose hover:underline">Delete</button>
                </div>
              </div>
            </div>
          }
        </div>
      }

      @if (showCreate()) {
        <div class="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" (click)="closeCreate()">
          <div class="card w-full max-w-lg" (click)="$event.stopPropagation()">
            <h2 class="text-lg font-semibold text-white mb-4">Add webhook endpoint</h2>
            <div class="space-y-3">
              <div>
                <label class="label">URL</label>
                <input [(ngModel)]="form.url" class="input font-mono" placeholder="https://your-server.com/webhooks/relayon" />
              </div>
              <div>
                <label class="label">Description (optional)</label>
                <input [(ngModel)]="form.description" class="input" placeholder="Production alerts" />
              </div>
              <div>
                <label class="label">Event types (empty = all)</label>
                <div class="grid grid-cols-2 gap-1 max-h-48 overflow-y-auto p-2 rounded border border-hairline">
                  @for (evt of allEvents; track evt) {
                    <label class="flex items-center gap-2 text-xs text-white">
                      <input
                        type="checkbox"
                        [checked]="form.eventTypes.includes(evt)"
                        (change)="toggleEvent(evt)"
                        class="rounded border-hairline"
                      />
                      <span class="font-mono">{{ evt }}</span>
                    </label>
                  }
                </div>
              </div>
              @if (error()) {
                <p class="text-sm text-signal-rose">{{ error() }}</p>
              }
            </div>
            <div class="flex justify-end gap-2 mt-4">
              <button (click)="closeCreate()" class="btn-secondary text-xs">Cancel</button>
              <button (click)="submitCreate()" [disabled]="saving() || !form.url" class="btn-primary text-xs">
                {{ saving() ? 'Creating...' : 'Create endpoint' }}
              </button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
})
export class WebhooksSettingsComponent implements OnInit {
  private http = inject(HttpClient);

  readonly allEvents = ALL_EVENTS;

  items = signal<WebhookEndpoint[]>([]);
  loading = signal(true);
  showCreate = signal(false);
  saving = signal(false);
  error = signal<string | null>(null);
  justCreated = signal<{ secret: string } | null>(null);

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

  submitCreate(): void {
    if (this.saving() || !this.form.url) return;
    this.saving.set(true);
    this.error.set(null);

    this.http.post<{ id: string; secret: string }>(
      `${environment.apiUrl}/api/webhook-endpoints`,
      this.form,
    ).subscribe({
      next: (r) => {
        this.saving.set(false);
        this.showCreate.set(false);
        this.justCreated.set({ secret: r.secret });
        this.load();
      },
      error: (err) => {
        this.saving.set(false);
        this.error.set(err?.error?.message ?? 'Failed to create endpoint');
      },
    });
  }

  toggle(e: WebhookEndpoint): void {
    this.http.post(`${environment.apiUrl}/api/webhook-endpoints/${e.id}/toggle`, {}).subscribe({
      next: () => this.load(),
    });
  }

  remove(e: WebhookEndpoint): void {
    if (!confirm(`Delete endpoint ${e.url}?`)) return;
    this.http.delete(`${environment.apiUrl}/api/webhook-endpoints/${e.id}`).subscribe({
      next: () => this.load(),
    });
  }
}