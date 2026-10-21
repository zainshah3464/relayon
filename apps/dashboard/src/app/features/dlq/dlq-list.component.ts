import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EventsService, Delivery } from '../../core/api/events.service';

@Component({
  selector: 'app-dlq-list',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="space-y-6">
      <div>
        <h1 class="text-2xl font-bold tracking-tightest text-white">Dead Letter Queue</h1>
        <p class="text-sm text-muted mt-1">Deliveries that exhausted retries. Inspect errors and replay.</p>
      </div>

      <div class="flex gap-2">
        <button (click)="load()" class="btn-secondary">Refresh</button>
      </div>

      @if (loading()) {
        <div class="card text-sm text-muted">Loading DLQ...</div>
      } @else if (error()) {
        <div class="card text-sm text-signal-rose">{{ error() }}</div>
      } @else if (items().length === 0) {
        <div class="card text-center py-12">
          <div class="text-3xl mb-2">✅</div>
          <p class="text-sm text-muted">All clear — no failed deliveries in the DLQ.</p>
        </div>
      } @else {
        <div class="space-y-2">
          @for (d of items(); track d._id) {
            <div class="card">
              <div class="flex justify-between items-start mb-2">
                <div>
                  <p class="text-white font-mono text-xs">{{ d.correlationId }}</p>
                  <p class="text-xs text-muted mt-1">
                    {{ d.destinationType }} · {{ d.attemptCount }} attempts · {{ d.dlqAt | date: 'short' }}
                  </p>
                </div>
                <div class="flex gap-2">
                  <button (click)="replay(d)" class="text-xs text-relay-cyan hover:underline">Replay</button>
                  <button (click)="discard(d)" class="text-xs text-signal-rose hover:underline">Discard</button>
                </div>
              </div>
              @if (d.dlqReason) {
                <p class="text-xs text-signal-amber">{{ d.dlqReason }}</p>
              }
              @if (d.error) {
                <pre class="text-xs text-signal-rose bg-surface-2 p-2 rounded mt-2">{{ d.error | json }}</pre>
              }
              @if (d.lastResponse) {
                <p class="text-xs text-muted mt-1">Last HTTP {{ d.lastResponse.statusCode }}: {{ d.lastResponse.bodySnippet.slice(0, 200) }}</p>
              }
            </div>
          }
        </div>
      }
    </div>
  `,
})
export class DlqListComponent implements OnInit {
  private svc = inject(EventsService);

  items = signal<Delivery[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.svc.listDlq({ limit: 25 }).subscribe({
      next: (res) => {
        this.items.set(res.items);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.error?.message ?? 'Failed to load DLQ');
        this.loading.set(false);
      },
    });
  }

  replay(d: Delivery): void {
    this.svc.replayDlq(d._id).subscribe({
      next: () => {
        this.items.set(this.items().filter((x) => x._id !== d._id));
      },
    });
  }

  discard(d: Delivery): void {
    if (!confirm('Delete this DLQ entry permanently?')) return;
    this.svc.discardDlq(d._id).subscribe({
      next: () => {
        this.items.set(this.items().filter((x) => x._id !== d._id));
      },
    });
  }
}