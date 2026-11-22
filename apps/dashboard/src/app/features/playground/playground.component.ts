import {
  Component,
  inject,
  signal,
  OnInit,
  OnDestroy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { IconComponent } from '../../shared/ui/icon/icon.component';
import { ConfirmDialogService } from '../../shared/ui/confirm/confirm-dialog.service';
import { ToastService } from '../../shared/ui/toast/toast.service';

interface CapturedRequest {
  id: string;
  receivedAt: string;
  method: string;
  path: string;
  headers: Record<string, string>;
  body: string;
  contentType: string;
  sizeBytes: number;
}

interface PlaygroundSession {
  sessionId: string;
  url: string;
  expiresAt: string;
}

@Component({
  selector: 'app-playground',
  standalone: true,
  imports: [CommonModule, IconComponent],
  template: `
    <div class="space-y-5">
      <!-- ═══════════════ HEADER ═══════════════ -->
      <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 class="text-2xl font-bold tracking-tighter text-foreground sm:text-3xl">
            Webhook playground
          </h1>
          <p class="mt-1 text-sm text-muted">
            Send test webhooks to a unique URL and inspect them live.
          </p>
        </div>

        @if (session(); as s) {
          <div class="flex items-center gap-2 self-start sm:self-auto">
            <div class="flex items-center gap-1.5 rounded-full border border-hairline bg-surface px-2.5 py-1">
              <span class="relative flex h-1.5 w-1.5">
                <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-signal-green opacity-75"></span>
                <span class="relative inline-flex h-1.5 w-1.5 rounded-full bg-signal-green"></span>
              </span>
              <span class="text-[11px] font-medium text-signal-green">Live</span>
            </div>
            <button
              type="button"
              (click)="clearAll()"
              [disabled]="requests().length === 0"
              class="btn-secondary text-xs text-signal-rose"
            >
              <app-icon name="trash" [size]="12" [strokeWidth]="2" />
              <span>Clear all</span>
            </button>
          </div>
        }
      </div>

      <!-- ═══════════════ EMPTY STATE ═══════════════ -->
      @if (!session()) {
        <div class="card flex flex-col items-center justify-center py-16 text-center">
          <div class="relative">
            <div class="absolute inset-0 rounded-full bg-relay-violet/20 blur-2xl"></div>
            <div class="relative flex h-16 w-16 items-center justify-center rounded-2xl border border-relay-violet/30 bg-relay-violet/10 text-relay-violet">
              <app-icon name="flask" [size]="28" [strokeWidth]="1.75" />
            </div>
          </div>
          <h2 class="mt-5 text-lg font-semibold text-foreground">
            Try Relayon without setup
          </h2>
          <p class="mt-1.5 max-w-sm text-sm text-muted">
            Create a temporary webhook URL. Send any HTTP request to it and watch it appear here in real time — perfect for testing integrations.
          </p>
          <button
            type="button"
            (click)="createSession()"
            [disabled]="creating()"
            class="btn-primary mt-5"
          >
            @if (creating()) {
              <app-icon name="loader" [size]="14" [strokeWidth]="2.5" class="animate-spin" />
            } @else {
              <app-icon name="plus" [size]="14" [strokeWidth]="2.5" />
            }
            <span>{{ creating() ? 'Creating…' : 'Create session' }}</span>
          </button>
        </div>
      } @else {
        <!-- ═══════════════ SESSION INFO ═══════════════ -->
        @if (session(); as s) {
          <div class="relative overflow-hidden rounded-xl border border-relay-violet/30 bg-gradient-to-br from-relay-violet/[0.08] via-surface to-relay-cyan/[0.06] p-4 sm:p-5">
            <div class="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-relay-violet/20 blur-3xl"></div>

            <div class="relative">
              <p class="text-[10px] font-medium uppercase tracking-wider text-relay-cyan">
                Your unique webhook URL
              </p>
              <div class="mt-2 flex flex-col gap-2 sm:flex-row">
                <code class="flex-1 truncate rounded-lg border border-hairline bg-midnight/60 px-3 py-2 font-mono text-xs text-relay-cyan">
                  {{ s.url }}
                </code>
                <button
                  type="button"
                  (click)="copyUrl()"
                  class="btn-secondary shrink-0 text-xs"
                >
                  <app-icon [name]="copied() ? 'check' : 'copy'" [size]="12" [strokeWidth]="2.5" />
                  <span>{{ copied() ? 'Copied' : 'Copy' }}</span>
                </button>
              </div>
              <p class="mt-2 flex items-center gap-1.5 text-[11px] text-muted">
                <app-icon name="clock" [size]="11" [strokeWidth]="2" />
                Expires {{ s.expiresAt | date: 'shortTime' }}
                <span class="mx-1 text-muted-2">·</span>
                Any HTTP method accepted
              </p>
            </div>
          </div>
        }

        <!-- ═══════════════ REQUESTS ═══════════════ -->
        <div>
          <div class="mb-3 flex items-center justify-between">
            <h2 class="text-sm font-semibold text-foreground">
              Captured requests
              <span class="ml-1.5 rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] text-muted">
                {{ requests().length }}
              </span>
            </h2>
          </div>

          @if (requests().length === 0) {
            <div class="card flex flex-col items-center justify-center py-12 text-center">
              <div class="flex h-12 w-12 items-center justify-center rounded-xl border border-hairline bg-surface-2">
                <app-icon name="clock" [size]="22" [strokeWidth]="1.75" class="text-muted animate-pulse-subtle" />
              </div>
              <p class="mt-3 text-sm font-medium text-foreground">
                Waiting for incoming requests…
              </p>
              <p class="mt-1 max-w-sm text-xs text-muted">
                Send an HTTP request to your webhook URL — it will appear here instantly.
              </p>
            </div>
          } @else {
            <div class="space-y-2">
              @for (r of requests(); track r.id) {
                <details class="card group cursor-pointer p-0">
                  <summary class="flex flex-wrap items-center gap-2 p-3 list-none [&::-webkit-details-marker]:hidden">
                    <span [ngClass]="methodClass(r.method)" class="rounded px-2 py-0.5 font-mono text-[10px] font-bold">
                      {{ r.method }}
                    </span>
                    <code class="min-w-0 flex-1 truncate font-mono text-xs text-foreground">{{ r.path }}</code>
                    <span class="text-[11px] text-muted">
                      {{ r.receivedAt | date: 'HH:mm:ss' }}
                      <span class="mx-1 text-muted-2">·</span>
                      {{ formatSize(r.sizeBytes) }}
                    </span>
                    <app-icon
                      name="chevron-down"
                      [size]="14"
                      [strokeWidth]="2.5"
                      class="text-muted-2 transition-transform group-open:rotate-180"
                    />
                  </summary>

                  <div class="space-y-2 border-t border-hairline p-3 pt-2">
                    <div>
                      <p class="mb-1 flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-muted-2">
                        <app-icon name="filter" [size]="10" [strokeWidth]="2" />
                        Headers
                      </p>
                      <pre class="max-h-32 overflow-auto rounded bg-midnight p-2 font-mono text-[11px] text-foreground">{{ formatHeaders(r.headers) }}</pre>
                    </div>
                    <div>
                      <p class="mb-1 flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-muted-2">
                        <app-icon name="download" [size]="10" [strokeWidth]="2" />
                        Body
                      </p>
                      <pre class="max-h-48 overflow-auto rounded bg-midnight p-2 font-mono text-[11px] text-relay-cyan">{{ r.body || '(empty)' }}</pre>
                    </div>
                  </div>
                </details>
              }
            </div>
          }
        </div>
      }
    </div>
  `,
})
export class PlaygroundComponent implements OnInit, OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly confirm = inject(ConfirmDialogService);
  private readonly toast = inject(ToastService);

  readonly session = signal<PlaygroundSession | null>(null);
  readonly requests = signal<CapturedRequest[]>([]);
  readonly creating = signal(false);
  readonly copied = signal(false);

  private eventSource: EventSource | null = null;

  ngOnInit(): void {
    if (typeof localStorage === 'undefined') return;
    const stored = localStorage.getItem('relayon_playground_session');
    if (!stored) return;
    try {
      const s = JSON.parse(stored) as PlaygroundSession;
      if (new Date(s.expiresAt) > new Date()) {
        this.session.set(s);
        this.loadExisting(s.sessionId);
        this.connectSse(s.sessionId);
      } else {
        localStorage.removeItem('relayon_playground_session');
      }
    } catch {
      /* ignore */
    }
  }

  ngOnDestroy(): void {
    this.eventSource?.close();
  }

  createSession(): void {
    this.creating.set(true);
    this.http
      .post<PlaygroundSession>(`${environment.apiUrl}/api/playground/sessions`, {})
      .subscribe({
        next: (s) => {
          this.session.set(s);
          localStorage.setItem('relayon_playground_session', JSON.stringify(s));
          this.creating.set(false);
          this.connectSse(s.sessionId);
          this.toast.success('Playground session created');
        },
        error: () => {
          this.creating.set(false);
          this.toast.error('Failed to create session');
        },
      });
  }

  private loadExisting(sessionId: string): void {
    this.http
      .get<CapturedRequest[]>(
        `${environment.apiUrl}/api/playground/sessions/${sessionId}/requests`,
      )
      .subscribe({ next: (r) => this.requests.set(r) });
  }

  private connectSse(sessionId: string): void {
    this.eventSource?.close();
    const url = `${environment.apiUrl}/api/playground/sessions/${sessionId}/stream`;
    const es = new EventSource(url);
    this.eventSource = es;

    es.onmessage = (event) => {
      try {
        const req = JSON.parse(event.data) as CapturedRequest;
        if (!req.id) return;
        this.requests.update((list) => [req, ...list]);
      } catch {
        /* ignore */
      }
    };
  }

  copyUrl(): void {
    const url = this.session()?.url;
    if (!url) return;
    navigator.clipboard.writeText(url).then(() => {
      this.copied.set(true);
      this.toast.success('Webhook URL copied');
      setTimeout(() => this.copied.set(false), 1500);
    });
  }

  async clearAll(): Promise<void> {
    const s = this.session();
    if (!s || this.requests().length === 0) return;

    const ok = await this.confirm.confirm({
      title: 'Clear all requests',
      message: `Delete all ${this.requests().length} captured requests? This cannot be undone.`,
      confirmText: 'Clear',
      variant: 'danger',
      icon: 'trash',
    });
    if (!ok) return;

    this.http
      .post(`${environment.apiUrl}/api/playground/sessions/${s.sessionId}/clear`, {})
      .subscribe({
        next: () => {
          this.requests.set([]);
          this.toast.success('All requests cleared');
        },
        error: () => this.toast.error('Failed to clear requests'),
      });
  }

  formatHeaders(h: Record<string, string>): string {
    return Object.entries(h)
      .map(([k, v]) => `${k}: ${v}`)
      .join('\n');
  }

  formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  }

  methodClass(method: string): string {
    const m = method.toUpperCase();
    if (m === 'GET') return 'bg-info/15 text-info';
    if (m === 'POST') return 'bg-signal-green/15 text-signal-green';
    if (m === 'PUT') return 'bg-signal-amber/15 text-signal-amber';
    if (m === 'PATCH') return 'bg-relay-violet/15 text-relay-violet';
    if (m === 'DELETE') return 'bg-signal-rose/15 text-signal-rose';
    return 'bg-surface-3 text-muted';
  }
}