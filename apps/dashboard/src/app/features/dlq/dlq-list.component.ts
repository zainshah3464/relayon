import {
  Component,
  inject,
  signal,
  computed,
  OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslocoModule } from '@jsverse/transloco';
import { EventsService, Delivery } from '../../core/api/events.service';
import { IconComponent } from '../../shared/ui/icon/icon.component';
import { ConfirmDialogService } from '../../shared/ui/confirm/confirm-dialog.service';
import { ToastService } from '../../shared/ui/toast/toast.service';

@Component({
  selector: 'app-dlq-list',
  standalone: true,
  imports: [CommonModule, TranslocoModule, IconComponent],
  template: `
    <div class="space-y-5">
      <!-- ═══════════════ HEADER ═══════════════ -->
      <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 class="text-2xl font-bold tracking-tighter text-foreground sm:text-3xl">
            {{ 'dlq.title' | transloco }}
          </h1>
          <p class="mt-1 text-sm text-muted">
            {{ 'dlq.subtitle' | transloco }}
          </p>
        </div>

        <button
          type="button"
          (click)="load()"
          [disabled]="loading()"
          class="btn-secondary self-start sm:self-auto"
        >
          <app-icon
            name="refresh"
            [size]="14"
            [strokeWidth]="2.5"
            [class.animate-spin]="loading()"
          />
          <span>{{ 'common.refresh' | transloco }}</span>
        </button>
      </div>

      <!-- ═══════════════ BULK ACTION BAR ═══════════════ -->
      @if (selected().size > 0) {
        <div class="sticky top-14 z-20 flex flex-col gap-2 rounded-xl border border-relay-violet/30 bg-surface/95 p-3 shadow-lg backdrop-blur-md sm:flex-row sm:items-center sm:justify-between animate-slide-down">
          <div class="flex items-center gap-2">
            <span class="flex h-6 min-w-6 items-center justify-center rounded-full bg-relay-violet px-2 text-xs font-semibold text-white tabular-nums">
              {{ selected().size }}
            </span>
            <span class="text-sm text-foreground">
              {{ 'common.selected' | transloco }}
            </span>
          </div>
          <div class="flex gap-2">
            <button
              type="button"
              (click)="clearSelection()"
              class="btn-ghost text-xs"
            >
              {{ 'common.clear' | transloco }}
            </button>
            <button
              type="button"
              (click)="bulkDiscard()"
              [disabled]="bulkLoading()"
              class="btn-secondary text-xs text-signal-rose"
            >
              <app-icon name="trash" [size]="13" [strokeWidth]="2" />
              <span>{{ 'dlq.discardSelected' | transloco }}</span>
            </button>
            <button
              type="button"
              (click)="bulkReplay()"
              [disabled]="bulkLoading()"
              class="btn-primary text-xs"
            >
              @if (bulkLoading()) {
                <app-icon name="loader" [size]="13" [strokeWidth]="2.5" class="animate-spin" />
              } @else {
                <app-icon name="refresh" [size]="13" [strokeWidth]="2.5" />
              }
              <span>{{ (bulkLoading() ? 'dlq.replaying' : 'dlq.replaySelected') | transloco }}</span>
            </button>
          </div>
        </div>
      }

      <!-- ═══════════════ BULK RESULT ═══════════════ -->
      @if (bulkResult(); as r) {
        <div
          class="flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-sm"
          [ngClass]="{
            'border-signal-green/30 bg-signal-green/10 text-signal-green': r.failed === 0,
            'border-signal-amber/30 bg-signal-amber/10 text-signal-amber': r.failed > 0 && r.replayed > 0,
            'border-signal-rose/30 bg-signal-rose/10 text-signal-rose': r.failed > 0 && r.replayed === 0
          }"
        >
          <app-icon
            [name]="r.failed === 0 ? 'check-circle' : 'alert-circle'"
            [size]="16"
            [strokeWidth]="2"
            class="mt-0.5 shrink-0"
          />
          <div class="min-w-0 flex-1">
            <p class="font-medium">
              {{ 'dlq.replayedResult' | transloco: { replayed: r.replayed, total: r.total } }}
              @if (r.failed > 0) {
                · {{ 'dlq.failedResult' | transloco: { failed: r.failed } }}
              }
            </p>
            @if (r.failures.length > 0) {
              <ul class="mt-1.5 space-y-0.5 text-xs">
                @for (f of r.failures.slice(0, 5); track f.id) {
                  <li class="font-mono text-[11px]">{{ f.id.slice(0, 12) }}… — {{ f.reason }}</li>
                }
              </ul>
            }
          </div>
          <button
            type="button"
            (click)="bulkResult.set(null)"
            class="shrink-0 rounded p-1 opacity-60 transition-opacity hover:opacity-100"
            aria-label="Dismiss"
          >
            <app-icon name="x" [size]="14" [strokeWidth]="2" />
          </button>
        </div>
      }

      <!-- ═══════════════ CONTENT ═══════════════ -->
      @if (loading()) {
        <!-- Skeleton -->
        <div class="space-y-2">
          @for (i of [1, 2, 3]; track i) {
            <div class="card">
              <div class="flex items-start justify-between gap-4">
                <div class="flex-1">
                  <div class="skeleton h-3 w-40"></div>
                  <div class="skeleton mt-2 h-2.5 w-32"></div>
                </div>
                <div class="skeleton h-6 w-16"></div>
              </div>
            </div>
          }
        </div>
      } @else if (error()) {
        <div class="card flex items-center gap-3 border-signal-rose/30 bg-signal-rose/[0.06]">
          <app-icon name="x-circle" [size]="20" [strokeWidth]="2" class="text-signal-rose" />
          <div class="flex-1">
            <p class="text-sm font-medium text-signal-rose">{{ error() | transloco }}</p>
          </div>
          <button type="button" (click)="load()" class="btn-secondary text-xs">
            <app-icon name="refresh" [size]="12" [strokeWidth]="2.5" />
            <span>Retry</span>
          </button>
        </div>
      } @else if (items().length === 0) {
        <!-- Empty -->
        <div class="card flex flex-col items-center justify-center py-16 text-center">
          <div class="flex h-14 w-14 items-center justify-center rounded-full border border-signal-green/30 bg-signal-green/10 text-signal-green">
            <app-icon name="check-circle" [size]="26" [strokeWidth]="2" />
          </div>
          <h3 class="mt-4 text-base font-semibold text-foreground">All clear</h3>
          <p class="mt-1 max-w-sm text-sm text-muted">
            {{ 'dlq.empty' | transloco }}
          </p>
        </div>
      } @else {
        <!-- Select all bar -->
        <div class="flex items-center gap-3 rounded-lg border border-hairline bg-surface px-3 py-2">
          <input
            type="checkbox"
            id="select-all-dlq"
            [checked]="allSelected()"
            [indeterminate]="someSelected()"
            (change)="toggleAll($event)"
            class="h-4 w-4 cursor-pointer rounded border-hairline-strong bg-surface-2 text-relay-violet focus:ring-2 focus:ring-relay-violet focus:ring-offset-0"
          />
          <label for="select-all-dlq" class="cursor-pointer text-xs text-muted">
            {{ 'common.selectAll' | transloco }}
            <span class="ml-1 text-muted-2">({{ items().length }})</span>
          </label>
        </div>

        <!-- DLQ cards -->
        <div class="space-y-2">
          @for (d of items(); track d._id) {
            <div
              class="card transition-colors"
              [ngClass]="{ 'border-relay-violet/30 bg-surface-2': selected().has(d._id) }"
            >
              <div class="flex items-start gap-3">
                <input
                  type="checkbox"
                  [checked]="selected().has(d._id)"
                  (change)="toggleOne(d._id, $event)"
                  class="mt-1 h-4 w-4 shrink-0 cursor-pointer rounded border-hairline-strong bg-surface-2 text-relay-violet focus:ring-2 focus:ring-relay-violet focus:ring-offset-0"
                  [attr.aria-label]="'Select ' + d.correlationId"
                />

                <div class="min-w-0 flex-1">
                  <!-- Row 1: ID + status + timestamp -->
                  <div class="flex flex-wrap items-center gap-2">
                    <code class="rounded bg-surface-3 px-1.5 py-0.5 font-mono text-[11px] text-foreground">
                      {{ d.correlationId.slice(0, 16) }}…
                    </code>
                    @if (d.lastResponse?.statusCode) {
                      <span [ngClass]="statusBadgeClass(d.lastResponse!.statusCode)">
                        HTTP {{ d.lastResponse!.statusCode }}
                      </span>
                    }
                    <span class="text-[11px] text-muted-2">
                      {{ d.dlqAt | date: 'short' }}
                    </span>
                  </div>

                  <!-- Row 2: source · attempts -->
                  <div class="mt-2 flex flex-wrap items-center gap-2 text-xs">
                    <span class="flex items-center gap-1 text-muted">
                      <app-icon name="send" [size]="11" [strokeWidth]="2" />
                      {{ d.destinationType }}
                    </span>
                    <span class="text-muted-2">·</span>
                    <span class="flex items-center gap-1 text-muted">
                      <app-icon name="refresh" [size]="11" [strokeWidth]="2" />
                      {{ d.attemptCount }} {{ 'dlq.attempts' | transloco }}
                    </span>
                  </div>

                  <!-- Reason -->
                  @if (d.dlqReason) {
                    <p class="mt-2 flex items-start gap-1.5 text-xs text-signal-amber">
                      <app-icon name="alert-triangle" [size]="12" [strokeWidth]="2" class="mt-0.5 shrink-0" />
                      <span>{{ d.dlqReason }}</span>
                    </p>
                  }

                  <!-- Last response -->
                  @if (d.lastResponse) {
                    <details class="mt-2 group">
                      <summary class="flex cursor-pointer items-center gap-1 text-[11px] font-medium text-muted hover:text-foreground transition-colors list-none">
                        <app-icon name="chevron-right" [size]="11" [strokeWidth]="2.5" class="transition-transform group-open:rotate-90" />
                        {{ 'dlq.lastHttp' | transloco }} response
                      </summary>
                      <pre class="mt-1.5 max-h-32 overflow-auto rounded-md border border-hairline bg-surface-2 p-2 font-mono text-[11px] text-muted">{{ d.lastResponse.bodySnippet }}</pre>
                    </details>
                  }

                  <!-- Error JSON -->
                  @if (d.error) {
                    <details class="mt-1.5 group">
                      <summary class="flex cursor-pointer items-center gap-1 text-[11px] font-medium text-signal-rose hover:opacity-80 transition-opacity list-none">
                        <app-icon name="chevron-right" [size]="11" [strokeWidth]="2.5" class="transition-transform group-open:rotate-90" />
                        Error details
                      </summary>
                      <pre class="mt-1.5 max-h-32 overflow-auto rounded-md border border-signal-rose/20 bg-signal-rose/[0.06] p-2 font-mono text-[11px] text-signal-rose">{{ d.error | json }}</pre>
                    </details>
                  }
                </div>

                <!-- Actions -->
                <div class="flex shrink-0 flex-col gap-1 sm:flex-row sm:gap-2">
                  <button
                    type="button"
                    (click)="replay(d)"
                    class="btn-ghost text-xs text-relay-cyan hover:bg-relay-cyan/10"
                    [attr.aria-label]="'Replay ' + d.correlationId"
                  >
                    <app-icon name="refresh" [size]="12" [strokeWidth]="2.5" />
                    <span class="hidden sm:inline">{{ 'dlq.replay' | transloco }}</span>
                  </button>
                  <button
                    type="button"
                    (click)="discard(d)"
                    class="btn-ghost text-xs text-signal-rose hover:bg-signal-rose/10"
                    [attr.aria-label]="'Discard ' + d.correlationId"
                  >
                    <app-icon name="trash" [size]="12" [strokeWidth]="2.5" />
                    <span class="hidden sm:inline">{{ 'dlq.discard' | transloco }}</span>
                  </button>
                </div>
              </div>
            </div>
          }
        </div>
      }
    </div>
  `,
})
export class DlqListComponent implements OnInit {
  private readonly svc = inject(EventsService);
  private readonly confirm = inject(ConfirmDialogService);
  private readonly toast = inject(ToastService);

  readonly items = signal<Delivery[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  readonly selected = signal<Set<string>>(new Set());
  readonly bulkLoading = signal(false);
  readonly bulkResult = signal<{
    total: number;
    replayed: number;
    failed: number;
    failures: Array<{ id: string; reason: string }>;
  } | null>(null);

  readonly allSelected = computed(() => {
    const list = this.items();
    return list.length > 0 && this.selected().size === list.length;
  });

  readonly someSelected = computed(() => {
    const size = this.selected().size;
    return size > 0 && size < this.items().length;
  });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.selected.set(new Set());
    this.bulkResult.set(null);

    this.svc.listDlq({ limit: 25 }).subscribe({
      next: (res) => {
        this.items.set(res.items);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.error?.message ?? 'dlq.errors.loadFailed');
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
        if (res.failed === 0) {
          this.toast.success(
            `Replayed ${res.replayed} ${res.replayed === 1 ? 'delivery' : 'deliveries'}`,
          );
        } else if (res.replayed > 0) {
          this.toast.warning(
            `Replayed ${res.replayed} of ${res.total} · ${res.failed} failed`,
          );
        } else {
          this.toast.error(`Replay failed for all ${res.failed}`);
        }
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
        this.toast.error('Bulk replay failed');
      },
    });
  }

  async bulkDiscard(): Promise<void> {
    const ids = Array.from(this.selected());
    if (ids.length === 0) return;

    const ok = await this.confirm.confirm({
      title: 'Discard deliveries',
      message: `Permanently discard ${ids.length} ${ids.length === 1 ? 'DLQ entry' : 'DLQ entries'}? This cannot be undone.`,
      confirmText: 'Discard',
      variant: 'danger',
      icon: 'trash',
    });
    if (!ok) return;

    this.bulkLoading.set(true);
    this.svc.bulkDiscardDlq(ids).subscribe({
      next: (res) => {
        this.bulkLoading.set(false);
        this.toast.success(
          `Discarded ${res.total - res.failed} of ${res.total}`,
        );
        this.bulkResult.set({
          total: res.total,
          replayed: 0,
          failed: res.failed,
          failures: [],
        });
        this.load();
      },
      error: (err) => {
        this.bulkLoading.set(false);
        this.error.set(err?.error?.message ?? 'dlq.errors.bulkDiscardFailed');
        this.toast.error('Bulk discard failed');
      },
    });
  }

  replay(d: Delivery): void {
    this.svc.replayDlq(d._id).subscribe({
      next: () => {
        this.toast.success('Delivery replayed');
        this.items.update((list) => list.filter((x) => x._id !== d._id));
      },
      error: () => {
        this.toast.error('Failed to replay delivery');
      },
    });
  }

  async discard(d: Delivery): Promise<void> {
    const ok = await this.confirm.confirm({
      title: 'Discard delivery',
      message:
        'Delete this DLQ entry permanently? This cannot be undone.',
      confirmText: 'Discard',
      variant: 'danger',
      icon: 'trash',
    });
    if (!ok) return;

    this.svc.discardDlq(d._id).subscribe({
      next: () => {
        this.toast.success('Delivery discarded');
        this.items.update((list) => list.filter((x) => x._id !== d._id));
      },
      error: () => {
        this.toast.error('Failed to discard delivery');
      },
    });
  }

  statusBadgeClass(code: number): string {
    const base =
      'inline-flex items-center rounded px-1.5 py-0.5 font-mono text-[10px] font-medium';
    if (code >= 200 && code < 300) {
      return `${base} bg-signal-green/12 text-signal-green`;
    }
    if (code >= 400 && code < 500) {
      return `${base} bg-signal-amber/12 text-signal-amber`;
    }
    if (code >= 500) {
      return `${base} bg-signal-rose/12 text-signal-rose`;
    }
    return `${base} bg-surface-3 text-muted`;
  }
}