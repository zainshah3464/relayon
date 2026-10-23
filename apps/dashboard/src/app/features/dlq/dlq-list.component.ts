import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EventsService, Delivery } from '../../core/api/events.service';

@Component({
  selector: 'app-dlq-list',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="space-y-6">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold tracking-tightest text-white">Dead Letter Queue</h1>
          <p class="text-sm text-muted mt-1">Deliveries that exhausted retries. Inspect errors and replay.</p>
        </div>
        <button (click)="load()" class="btn-secondary">Refresh</button>
      </div>

      @if (selected().size > 0) {
        <div class="card flex items-center justify-between">
          <p class="text-sm text-white">
            <strong>{{ selected().size }}</strong> selected
          </p>
          <div class="flex gap-2">
            <button (click)="bulkReplay()" [disabled]="bulkLoading()" class="btn-primary">
              {{ bulkLoading() ? 'Replaying...' : 'Replay selected' }}
            </button>
            <button (click)="clearSelection()" class="btn-secondary">Clear</button>
          </div>
        </div>
      }

      @if (bulkResult(); as r) {
        <div class="card">
          <p class="text-sm text-white">
            Replayed {{ r.replayed }}/{{ r.total }}
            @if (r.failed > 0) {
              · {{ r.failed }} failed
            }
          </p>
          @if (r.failures.length > 0) {
            <ul class="mt-2 text-xs text-signal-rose space-y-1">
              @for (f of r.failures.slice(0, 5); track f.id) {
                <li class="font-mono">{{ f.id.slice(0, 12) }}… — {{ f.reason }}</li>
              }
            </ul>
          }
        </div>
      }

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
        <div class="card flex items-center gap-3">
          <input
            type="checkbox"
            [checked]="allSelected()"
            (change)="toggleAll($event)"
            class="rounded border-hairline"
          />
          <span class="text-xs text-muted">Select all ({{ items().length }})</span>
        </div>

        <div class="space-y-2">
          @for (d of items(); track d._id) {
            <div class="card">
              <div class="flex justify-between items-start mb-2">
                <div class="flex items-start gap-3">
                  <input
                    type="checkbox"
                    [checked]="selected().has(d._id)"
                    (change)="toggleOne(d._id, $event)"
                    class="mt-1 rounded border-hairline"
                  />
                  <div>
                    <p class="text-white font-mono text-xs">{{ d.correlationId }}</p>
                    <p class="text-xs text-muted mt-1">
                      {{ d.destinationType }} · {{ d.attemptCount }} attempts · {{ d.dlqAt | date: 'short' }}
                    </p>
                  </div>
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

  selected = signal<Set<string>>(new Set());
  bulkLoading = signal(false);
  bulkResult = signal<{
    total: number;
    replayed: number;
    failed: number;
    failures: Array<{ id: string; reason: string }>;
  } | null>(null);

  allSelected = computed(() => {
    const list = this.items();
    return list.length > 0 && this.selected().size === list.length;
  });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.selected.set(new Set());
    this.bulkResult.set(null);
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

  toggleAll(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    if (checked) {
      this.selected.set(new Set(this.items().map((d) => d._id)));
    } else {
      this.selected.set(new Set());
    }
  }

  toggleOne(id: string, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    const next = new Set(this.selected());
    if (checked) next.add(id);
    else next.delete(id);
    this.selected.set(next);
  }

  clearSelection(): void {
    this.selected.set(new Set());
  }

  bulkReplay(): void {
    const ids = Array.from(this.selected());
    if (ids.length === 0) return;

    this.bulkLoading.set(true);
    this.svc.bulkReplayDlq(ids).subscribe({
      next: (res) => {
        this.bulkLoading.set(false);
        this.bulkResult.set(res);
        this.load();
      },
      error: (err) => {
        this.bulkLoading.set(false);
        this.bulkResult.set({
          total: ids.length,
          replayed: 0,
          failed: ids.length,
          failures: ids.map((id) => ({
            id,
            reason: err?.error?.message ?? 'Request failed',
          })),
        });
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