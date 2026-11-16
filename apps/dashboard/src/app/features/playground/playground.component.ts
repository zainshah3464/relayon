import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

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

@Component({
  selector: 'app-playground',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="space-y-6">
      <div>
        <h1 class="text-2xl font-bold text-white">Webhook playground</h1>
        <p class="text-sm text-muted mt-1">Send test webhooks to a unique URL and inspect them live.</p>
      </div>

      @if (!session()) {
        <div class="card text-center py-12">
          <p class="text-sm text-muted mb-4">Create a session to get started</p>
          <button (click)="createSession()" [disabled]="creating()" class="btn-primary">
            {{ creating() ? 'Creating...' : 'Create session' }}
          </button>
        </div>
      } @else {
        @if (session(); as s) {
          <div class="card border-relay-violet/30 bg-relay-violet/5">
            <p class="text-xs uppercase text-muted mb-2">Your unique webhook URL</p>
            <div class="flex gap-2">
              <code class="flex-1 text-xs font-mono text-relay-cyan bg-midnight p-3 rounded break-all">{{ s.url }}</code>
              <button (click)="copyUrl()" class="btn-secondary text-xs">
                {{ copied() ? 'Copied!' : 'Copy' }}
              </button>
            </div>
            <p class="text-xs text-muted mt-2">Expires {{ s.expiresAt | date: 'shortTime' }} · Any HTTP method</p>
          </div>

          <div class="flex justify-between items-center">
            <div class="flex items-center gap-2 text-xs">
              <span class="w-2 h-2 rounded-full bg-signal-green animate-pulse"></span>
              <span class="text-signal-green">Live</span>
              <span class="text-muted">· {{ requests().length }} captured</span>
            </div>
            <button (click)="clearAll()" class="text-xs text-signal-rose hover:underline">Clear all</button>
          </div>

          @if (requests().length === 0) {
            <div class="card text-center py-8 text-sm text-muted">
              Waiting for incoming requests...
            </div>
          } @else {
            <div class="space-y-2">
              @for (r of requests(); track r.id) {
                <details class="card cursor-pointer">
                  <summary class="flex justify-between items-center">
                    <div class="flex items-center gap-2">
                      <span class="text-xs px-2 py-0.5 rounded font-mono bg-signal-amber/20 text-signal-amber">{{ r.method }}</span>
                      <code class="text-xs text-white">{{ r.path }}</code>
                    </div>
                    <span class="text-xs text-muted">{{ r.receivedAt | date: 'HH:mm:ss' }} · {{ r.sizeBytes }}B</span>
                  </summary>
                  <div class="mt-3 space-y-2 text-xs">
                    <div>
                      <p class="text-muted mb-1">Headers</p>
                      <pre class="bg-midnight p-2 rounded overflow-x-auto text-white">{{ formatHeaders(r.headers) }}</pre>
                    </div>
                    <div>
                      <p class="text-muted mb-1">Body</p>
                      <pre class="bg-midnight p-2 rounded overflow-x-auto text-relay-cyan">{{ r.body || '(empty)' }}</pre>
                    </div>
                  </div>
                </details>
              }
            </div>
          }
        }
      }
    </div>
  `,
})
export class PlaygroundComponent implements OnInit, OnDestroy {
  private http = inject(HttpClient);

  session = signal<{ sessionId: string; url: string; expiresAt: string } | null>(null);
  requests = signal<CapturedRequest[]>([]);
  creating = signal(false);
  copied = signal(false);

  private eventSource: EventSource | null = null;

  ngOnInit(): void {
    const stored = localStorage.getItem('relayon_playground_session');
    if (stored) {
      try {
        const s = JSON.parse(stored);
        if (new Date(s.expiresAt) > new Date()) {
          this.session.set(s);
          this.loadExisting(s.sessionId);
          this.connectSse(s.sessionId);
        }
      } catch { /* ignore */ }
    }
  }

  ngOnDestroy(): void {
    this.eventSource?.close();
  }

  createSession(): void {
    this.creating.set(true);
    this.http
      .post<{ sessionId: string; url: string; expiresAt: string }>(
        `${environment.apiUrl}/api/playground/sessions`, {},
      )
      .subscribe({
        next: (s) => {
          this.session.set(s);
          localStorage.setItem('relayon_playground_session', JSON.stringify(s));
          this.creating.set(false);
          this.connectSse(s.sessionId);
        },
        error: () => this.creating.set(false),
      });
  }

  private loadExisting(sessionId: string): void {
    this.http
      .get<CapturedRequest[]>(`${environment.apiUrl}/api/playground/sessions/${sessionId}/requests`)
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
        if (!req.id) return; // ping
        this.requests.update((list) => [req, ...list]);
      } catch { /* ignore */ }
    };
  }

  copyUrl(): void {
    const url = this.session()?.url;
    if (!url) return;
    navigator.clipboard.writeText(url).then(() => {
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 1500);
    });
  }

  clearAll(): void {
    const s = this.session();
    if (!s) return;
    this.http.post(`${environment.apiUrl}/api/playground/sessions/${s.sessionId}/clear`, {})
      .subscribe({ next: () => this.requests.set([]) });
  }

  formatHeaders(h: Record<string, string>): string {
    return Object.entries(h).map(([k, v]) => `${k}: ${v}`).join('\n');
  }
}