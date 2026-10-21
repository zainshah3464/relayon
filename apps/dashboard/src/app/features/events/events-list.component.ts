import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  EventsService,
  EventSummary,
  EventDetail,
} from '../../core/api/events.service';

@Component({
  selector: 'app-events-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="space-y-6">
      <div>
        <h1 class="text-2xl font-bold tracking-tightest text-white">Events</h1>
        <p class="text-sm text-muted mt-1">Every webhook received by Relayon, with full lifecycle.</p>
      </div>

      <div class="flex gap-2 flex-wrap">
        <select [(ngModel)]="filterStatus" (change)="load()" class="input max-w-xs">
          <option value="">All statuses</option>
          <option value="processed">Processed</option>
          <option value="failed">Failed</option>
          <option value="processing">Processing</option>
        </select>
        <button (click)="load()" class="btn-secondary">Refresh</button>
      </div>

      @if (loading()) {
        <div class="card text-sm text-muted">Loading events...</div>
      } @else if (error()) {
        <div class="card text-sm text-signal-rose">{{ error() }}</div>
      } @else if (events().length === 0) {
        <div class="card text-center py-12">
          <p class="text-sm text-muted">No events yet. Send a webhook to see it here.</p>
        </div>
      } @else {
        <div class="card p-0 overflow-hidden">
          <table class="w-full text-sm">
            <thead class="bg-surface-2 text-xs uppercase text-muted">
              <tr>
                <th class="text-left p-3">Correlation ID</th>
                <th class="text-left p-3">Source</th>
                <th class="text-left p-3">Status</th>
                <th class="text-left p-3">Received</th>
                <th class="text-right p-3"></th>
              </tr>
            </thead>
            <tbody>
              @for (e of events(); track e._id) {
                <tr class="border-t border-hairline hover:bg-surface-2">
                  <td class="p-3 font-mono text-xs text-muted">{{ e.correlationId.slice(0, 12) }}…</td>
                  <td class="p-3 text-white">{{ e.sourceType }}</td>
                  <td class="p-3">
  @if (e.status === 'processed') {
    <span class="text-xs px-2 py-0.5 rounded bg-signal-green text-midnight">
      {{ e.status }}
    </span>
  } @else if (e.status === 'failed') {
    <span class="text-xs px-2 py-0.5 rounded bg-signal-rose/20 text-signal-rose">
      {{ e.status }}
    </span>
  } @else {
    <span class="text-xs px-2 py-0.5 rounded bg-surface-2 text-muted">
      {{ e.status }}
    </span>
  }
</td>
                  <td class="p-3 text-muted text-xs">{{ e.receivedAt | date: 'short' }}</td>
                  <td class="p-3 text-right">
                    <button (click)="openDetail(e._id)" class="text-xs text-relay-cyan hover:underline">View</button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        @if (nextCursor()) {
          <button (click)="loadMore()" class="btn-secondary w-full">Load more</button>
        }
      }

      @if (detail()) {
        <div class="fixed inset-0 z-50 bg-black/60 flex justify-end" (click)="closeDetail()">
          <div class="bg-surface w-full max-w-2xl h-full overflow-y-auto p-6" (click)="$event.stopPropagation()">
            <div class="flex justify-between items-center mb-4">
              <h2 class="text-lg font-semibold text-white">Event detail</h2>
              <button (click)="closeDetail()" class="text-muted hover:text-white">✕</button>
            </div>
            @if (detail(); as d) {
              <div class="space-y-4">
                <div class="grid grid-cols-2 gap-2 text-sm">
                  <div><span class="text-muted">Correlation:</span> <span class="font-mono text-xs text-white">{{ d.correlationId }}</span></div>
                  <div><span class="text-muted">Status:</span> <span class="text-white">{{ d.status }}</span></div>
                  <div><span class="text-muted">Source:</span> <span class="text-white">{{ d.sourceType }}</span></div>
                  <div><span class="text-muted">Received:</span> <span class="text-white">{{ d.receivedAt | date: 'medium' }}</span></div>
                </div>

                @if (d.enrichment) {
                  <div class="card bg-surface-2">
                    <h3 class="text-xs uppercase text-muted mb-1">AI Enrichment</h3>
                    <p class="text-xs text-white">
                      Model: {{ d.enrichment.model ?? '—' }} · Duration: {{ d.enrichment.durationMs }}ms · Cached: {{ d.enrichment.cached }}
                    </p>
                    @if (d.enrichment.error) {
                      <p class="text-xs text-signal-rose mt-1">Error: {{ d.enrichment.error }}</p>
                    }
                  </div>
                }

                <div>
                  <h3 class="text-xs uppercase text-muted mb-1">Raw payload</h3>
                  <pre class="bg-surface-2 p-3 rounded text-xs overflow-x-auto text-white">{{ d.rawPayload | json }}</pre>
                </div>

                @if (d.enrichedPayload) {
                  <div>
                    <h3 class="text-xs uppercase text-muted mb-1">Enriched</h3>
                    <pre class="bg-surface-2 p-3 rounded text-xs overflow-x-auto text-relay-cyan">{{ d.enrichedPayload | json }}</pre>
                  </div>
                }

                <div>
                  <h3 class="text-xs uppercase text-muted mb-1">Deliveries ({{ d.deliveries.length }})</h3>
                  @for (del of d.deliveries; track del._id) {
                    <div class="card bg-surface-2 mb-2">
                      <div class="flex justify-between">
                        <span class="text-sm text-white font-mono">{{ del.destinationType }}</span>
                        <span class="text-xs" [class.text-signal-green]="del.status === 'delivered'" [class.text-signal-rose]="del.status === 'dlq'" [class.text-muted]="del.status === 'pending'">
                          {{ del.status }} · {{ del.attemptCount }} attempt(s)
                        </span>
                      </div>
                      @if (del.lastResponse) {
                        <p class="text-xs text-muted mt-1">HTTP {{ del.lastResponse.statusCode }} · {{ del.lastResponse.latencyMs }}ms</p>
                      }
                    </div>
                  }
                </div>
              </div>
            }
          </div>
        </div>
      }
    </div>
  `,
})
export class EventsListComponent implements OnInit {
  private svc = inject(EventsService);

  events = signal<EventSummary[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);
  nextCursor = signal<string | null>(null);
  detail = signal<EventDetail | null>(null);
  filterStatus = '';

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.svc
      .list({ status: this.filterStatus || undefined, limit: 25 })
      .subscribe({
        next: (res) => {
          this.events.set(res.items);
          this.nextCursor.set(res.nextCursor);
          this.loading.set(false);
        },
        error: (err) => {
          this.error.set(err?.error?.message ?? 'Failed to load events');
          this.loading.set(false);
        },
      });
  }

  loadMore(): void {
    const cursor = this.nextCursor();
    if (!cursor) return;
    this.svc.list({ status: this.filterStatus || undefined, cursor }).subscribe({
      next: (res) => {
        this.events.set([...this.events(), ...res.items]);
        this.nextCursor.set(res.nextCursor);
      },
    });
  }

  openDetail(id: string): void {
    this.svc.get(id).subscribe({
      next: (d) => this.detail.set(d),
    });
  }

  closeDetail(): void {
    this.detail.set(null);
  }
}