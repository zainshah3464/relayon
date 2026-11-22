import {
  Component,
  inject,
  signal,
  computed,
  OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslocoModule } from '@jsverse/transloco';
import {
  EventsService,
  EventSummary,
  EventDetail,
} from '../../core/api/events.service';
import { IconComponent } from '../../shared/ui/icon/icon.component';
import { ModalComponent } from '../../shared/ui/modal/modal.component';
import { ConfirmDialogService } from '../../shared/ui/confirm/confirm-dialog.service';
import { ToastService } from '../../shared/ui/toast/toast.service';

type EventStatus = '' | 'processed' | 'failed' | 'processing';

interface StatusChip {
  value: EventStatus;
  labelKey: string;
}

@Component({
  selector: 'app-events-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TranslocoModule,
    IconComponent,
    ModalComponent,
  ],
  template: `
    <div class="space-y-5">
      <!-- ═══════════════ HEADER ═══════════════ -->
      <div>
        <h1 class="text-2xl font-bold tracking-tighter text-foreground sm:text-3xl">
          {{ 'events.title' | transloco }}
        </h1>
        <p class="mt-1 text-sm text-muted">
          {{ 'events.subtitle' | transloco }}
        </p>
      </div>

      <!-- ═══════════════ FILTERS ═══════════════ -->
      <div class="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div class="relative flex-1">
          <app-icon
            name="search"
            [size]="14"
            [strokeWidth]="2"
            class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-2"
          />
          <input
            type="text"
            [value]="searchQuery()"
            (input)="searchQuery.set($any($event.target).value)"
            placeholder="Search by correlation ID or source…"
            class="input pl-9"
            aria-label="Search events"
          />
          @if (searchQuery()) {
            <button
              type="button"
              (click)="searchQuery.set('')"
              class="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-2 hover:bg-surface-3 hover:text-foreground"
              aria-label="Clear search"
            >
              <app-icon name="x" [size]="12" [strokeWidth]="2.5" />
            </button>
          }
        </div>

        <!-- Status chips -->
        <div class="flex flex-wrap items-center gap-1">
          @for (chip of statusChips; track chip.value) {
            <button
              type="button"
              (click)="setStatus(chip.value)"
              class="rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors"
              [class.bg-relay-violet]="filterStatus() === chip.value"
              [class.text-white]="filterStatus() === chip.value"
              [class.bg-surface-2]="filterStatus() !== chip.value"
              [class.text-muted]="filterStatus() !== chip.value"
              [class.hover:bg-surface-3]="filterStatus() !== chip.value"
            >
              {{ chip.labelKey | transloco }}
            </button>
          }
        </div>

        <button
          type="button"
          (click)="load()"
          [disabled]="loading()"
          class="btn-secondary shrink-0"
        >
          <app-icon
            name="refresh"
            [size]="13"
            [strokeWidth]="2.5"
            [class.animate-spin]="loading()"
          />
          <span class="hidden sm:inline">{{ 'common.refresh' | transloco }}</span>
        </button>
      </div>

      <!-- ═══════════════ CONTENT ═══════════════ -->
      @if (loading() && events().length === 0) {
        <div class="card p-0 overflow-hidden">
          @for (i of [1, 2, 3, 4, 5]; track i) {
            <div class="flex items-center gap-3 border-b border-hairline p-3 last:border-b-0">
              <div class="skeleton h-3 w-32"></div>
              <div class="skeleton h-3 w-20"></div>
              <div class="skeleton h-5 w-16"></div>
              <div class="ml-auto skeleton h-3 w-24"></div>
            </div>
          }
        </div>
      } @else if (error()) {
        <div class="card flex items-center gap-3 border-signal-rose/30 bg-signal-rose/[0.06]">
          <app-icon name="x-circle" [size]="20" [strokeWidth]="2" class="text-signal-rose" />
          <p class="flex-1 text-sm font-medium text-signal-rose">{{ error() | transloco }}</p>
          <button type="button" (click)="load()" class="btn-secondary text-xs">
            <app-icon name="refresh" [size]="12" [strokeWidth]="2.5" />
            <span>Retry</span>
          </button>
        </div>
      } @else if (events().length === 0) {
        <!-- Empty (no events yet) -->
        <div class="card flex flex-col items-center justify-center py-16 text-center">
          <div class="flex h-14 w-14 items-center justify-center rounded-2xl border border-hairline bg-surface-2 text-muted">
            <app-icon name="inbox" [size]="26" [strokeWidth]="1.75" />
          </div>
          <h3 class="mt-4 text-base font-semibold text-foreground">No events yet</h3>
          <p class="mt-1.5 max-w-sm text-sm text-muted">
            {{ 'events.empty' | transloco }}
          </p>
        </div>
      } @else if (filtered().length === 0) {
        <!-- Search/filter empty -->
        <div class="card flex flex-col items-center justify-center py-12 text-center">
          <div class="flex h-12 w-12 items-center justify-center rounded-xl border border-hairline bg-surface-2 text-muted">
            <app-icon name="search" [size]="20" [strokeWidth]="2" />
          </div>
          <p class="mt-3 text-sm font-medium text-foreground">No matches</p>
          <p class="mt-1 text-xs text-muted">
            No events match your search or filter.
          </p>
          <button
            type="button"
            (click)="clearFilters()"
            class="btn-ghost mt-3 text-xs"
          >
            Clear filters
          </button>
        </div>
      } @else {
        <!-- ═══ Desktop table ═══ -->
        <div class="card hidden overflow-hidden p-0 sm:block">
          <table class="w-full text-sm">
            <thead class="bg-surface-2/50">
              <tr class="border-b border-hairline">
                <th class="px-3 py-2.5 text-left text-[10px] font-medium uppercase tracking-wider text-muted-2">
                  {{ 'events.table.correlationId' | transloco }}
                </th>
                <th class="px-3 py-2.5 text-left text-[10px] font-medium uppercase tracking-wider text-muted-2">
                  {{ 'events.table.source' | transloco }}
                </th>
                <th class="px-3 py-2.5 text-left text-[10px] font-medium uppercase tracking-wider text-muted-2">
                  {{ 'events.table.status' | transloco }}
                </th>
                <th class="px-3 py-2.5 text-left text-[10px] font-medium uppercase tracking-wider text-muted-2">
                  {{ 'events.table.received' | transloco }}
                </th>
                <th class="w-10 px-3 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              @for (e of filtered(); track e._id) {
                <tr
                  (click)="openDetail(e._id)"
                  class="group cursor-pointer border-b border-hairline transition-colors last:border-b-0 hover:bg-surface-2"
                >
                  <td class="px-3 py-2.5">
                    <button
                      type="button"
                      (click)="copyId(e.correlationId, $event)"
                      class="flex items-center gap-1.5 font-mono text-xs text-foreground transition-colors hover:text-relay-cyan"
                      [attr.aria-label]="'Copy correlation ID'"
                    >
                      <span>{{ e.correlationId.slice(0, 12) }}…</span>
                      <app-icon name="copy" [size]="10" [strokeWidth]="2.5" class="opacity-0 transition-opacity group-hover:opacity-60" />
                    </button>
                  </td>
                  <td class="px-3 py-2.5 text-xs text-foreground">
                    {{ e.sourceType }}
                  </td>
                  <td class="px-3 py-2.5">
                    <span [ngClass]="statusBadgeClass(e.status)">
                      {{ e.status }}
                    </span>
                  </td>
                  <td class="px-3 py-2.5 text-xs text-muted">
                    {{ e.receivedAt | date: 'short' }}
                  </td>
                  <td class="px-3 py-2.5 text-right">
                    <app-icon
                      name="arrow-right"
                      [size]="13"
                      [strokeWidth]="2"
                      class="text-muted-2 transition-all group-hover:translate-x-0.5 group-hover:text-foreground"
                    />
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        <!-- ═══ Mobile cards ═══ -->
        <div class="space-y-2 sm:hidden">
          @for (e of filtered(); track e._id) {
            <button
              type="button"
              (click)="openDetail(e._id)"
              class="card-interactive block w-full text-left"
            >
              <div class="flex items-start justify-between gap-2">
                <code class="truncate font-mono text-xs text-foreground">
                  {{ e.correlationId.slice(0, 16) }}…
                </code>
                <span [ngClass]="statusBadgeClass(e.status)">
                  {{ e.status }}
                </span>
              </div>
              <div class="mt-2 flex items-center gap-2 text-xs text-muted">
                <span>{{ e.sourceType }}</span>
                <span class="text-muted-2">·</span>
                <span>{{ e.receivedAt | date: 'short' }}</span>
              </div>
            </button>
          }
        </div>

        <!-- Load more -->
        @if (nextCursor()) {
          <button
            type="button"
            (click)="loadMore()"
            [disabled]="loadingMore()"
            class="btn-secondary w-full"
          >
            @if (loadingMore()) {
              <app-icon name="loader" [size]="13" [strokeWidth]="2.5" class="animate-spin" />
            }
            <span>{{ 'events.loadMore' | transloco }}</span>
          </button>
        }
      }

      <!-- ═══════════════ DETAIL MODAL ═══════════════ -->
      @if (detail()) {
        <app-modal
          title="{{ 'events.detail.title' | transloco }}"
          [subtitle]="detail()!.correlationId"
          size="xl"
          (closed)="closeDetail()"
        >
          @if (detail(); as d) {
            @if (replayResult()) {
              <div class="mb-4 flex items-start gap-2.5 rounded-lg border border-signal-green/30 bg-signal-green/[0.06] p-3 text-xs">
                <app-icon name="check-circle" [size]="16" [strokeWidth]="2" class="mt-0.5 shrink-0 text-signal-green" />
                <div class="min-w-0 flex-1">
                  <p class="font-medium text-signal-green">{{ 'events.detail.replayQueued' | transloco }}</p>
                  <p class="mt-0.5 truncate font-mono text-muted">
                    {{ 'events.detail.newCorrelation' | transloco }} {{ replayResult()!.newCorrelationId }}
                  </p>
                </div>
              </div>
            }

            <div class="space-y-4">
              <!-- Meta grid -->
              <div class="grid gap-2 sm:grid-cols-2">
                <div class="rounded-lg border border-hairline bg-surface-2/50 p-3">
                  <p class="text-[10px] font-medium uppercase tracking-wider text-muted-2">
                    {{ 'events.detail.status' | transloco }}
                  </p>
                  <div class="mt-1.5 flex items-center gap-2">
                    <span [ngClass]="statusBadgeClass(d.status)">{{ d.status }}</span>
                  </div>
                </div>
                <div class="rounded-lg border border-hairline bg-surface-2/50 p-3">
                  <p class="text-[10px] font-medium uppercase tracking-wider text-muted-2">
                    {{ 'events.detail.source' | transloco }}
                  </p>
                  <p class="mt-1.5 font-mono text-xs text-foreground">{{ d.sourceType }}</p>
                </div>
                <div class="rounded-lg border border-hairline bg-surface-2/50 p-3 sm:col-span-2">
                  <p class="text-[10px] font-medium uppercase tracking-wider text-muted-2">
                    {{ 'events.detail.received' | transloco }}
                  </p>
                  <p class="mt-1.5 text-xs text-foreground">{{ d.receivedAt | date: 'medium' }}</p>
                </div>
              </div>

              <!-- Enrichment -->
              @if (d.enrichment) {
                <div class="rounded-lg border border-hairline bg-surface-2 p-3">
                  <h3 class="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                    <app-icon name="sparkles" [size]="13" [strokeWidth]="2" class="text-relay-cyan" />
                    {{ 'events.detail.enrichment' | transloco }}
                  </h3>
                  <p class="mt-1.5 text-xs text-muted">
                    Model: <span class="font-mono text-foreground">{{ d.enrichment.model ?? '—' }}</span>
                    <span class="mx-1.5 text-muted-2">·</span>
                    {{ d.enrichment.durationMs }}ms
                    <span class="mx-1.5 text-muted-2">·</span>
                    {{ d.enrichment.cached ? 'cached' : 'live' }}
                  </p>
                  @if (d.enrichment.error) {
                    <p class="mt-1.5 flex items-start gap-1.5 text-xs text-signal-rose">
                      <app-icon name="alert-circle" [size]="12" [strokeWidth]="2" class="mt-0.5 shrink-0" />
                      {{ d.enrichment.error }}
                    </p>
                  }
                </div>
              }

              <!-- Raw payload -->
              <div>
                <h3 class="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted">
                  <app-icon name="download" [size]="11" [strokeWidth]="2" />
                  {{ 'events.detail.rawPayload' | transloco }}
                </h3>
                <pre class="max-h-64 overflow-auto rounded-lg border border-hairline bg-surface-2 p-3 font-mono text-[11px] text-foreground">{{ d.rawPayload | json }}</pre>
              </div>

              <!-- Enriched payload -->
              @if (d.enrichedPayload) {
                <div>
                  <h3 class="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted">
                    <app-icon name="sparkles" [size]="11" [strokeWidth]="2" />
                    {{ 'events.detail.enriched' | transloco }}
                  </h3>
                  <pre class="max-h-64 overflow-auto rounded-lg border border-relay-cyan/20 bg-relay-cyan/[0.04] p-3 font-mono text-[11px] text-relay-cyan">{{ d.enrichedPayload | json }}</pre>
                </div>
              }

              <!-- Deliveries -->
              <div>
                <h3 class="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted">
                  <app-icon name="send" [size]="11" [strokeWidth]="2" />
                  {{ 'events.detail.deliveries' | transloco }} ({{ d.deliveries.length }})
                </h3>
                @if (d.deliveries.length === 0) {
                  <p class="rounded-lg border border-hairline bg-surface-2/50 p-3 text-xs text-muted">
                    No deliveries yet.
                  </p>
                } @else {
                  <div class="space-y-1.5">
                    @for (del of d.deliveries; track del._id) {
                      <div class="rounded-lg border border-hairline bg-surface-2 p-3">
                        <div class="flex items-start justify-between gap-2">
                          <span class="font-mono text-xs text-foreground">{{ del.destinationType }}</span>
                          <span
                            class="text-xs font-medium"
                            [class.text-signal-green]="del.status === 'delivered'"
                            [class.text-signal-rose]="del.status === 'dlq'"
                            [class.text-signal-amber]="del.status === 'pending'"
                          >
                            {{ del.status }}
                          </span>
                        </div>
                        <div class="mt-1 flex items-center gap-2 text-[11px] text-muted">
                          <span>{{ del.attemptCount }} {{ 'dlq.attempts' | transloco }}</span>
                          @if (del.lastResponse) {
                            <span class="text-muted-2">·</span>
                            <span>HTTP {{ del.lastResponse.statusCode }} · {{ del.lastResponse.latencyMs }}ms</span>
                          }
                        </div>
                      </div>
                    }
                  </div>
                }
              </div>
            </div>
          }

          <div modal-footer>
            <button type="button" (click)="closeDetail()" class="btn-secondary">
              {{ 'common.close' | transloco }}
            </button>
            <button
              type="button"
              (click)="replayCurrent()"
              [disabled]="replaying()"
              class="btn-primary"
            >
              @if (replaying()) {
                <app-icon name="loader" [size]="13" [strokeWidth]="2.5" class="animate-spin" />
              } @else {
                <app-icon name="refresh" [size]="13" [strokeWidth]="2.5" />
              }
              <span>{{ (replaying() ? 'events.detail.replaying' : 'events.detail.replay') | transloco }}</span>
            </button>
          </div>
        </app-modal>
      }
    </div>
  `,
})
export class EventsListComponent implements OnInit {
  private readonly svc = inject(EventsService);
  private readonly confirm = inject(ConfirmDialogService);
  private readonly toast = inject(ToastService);

  readonly events = signal<EventSummary[]>([]);
  readonly loading = signal(true);
  readonly loadingMore = signal(false);
  readonly error = signal<string | null>(null);
  readonly nextCursor = signal<string | null>(null);
  readonly detail = signal<EventDetail | null>(null);

  readonly filterStatus = signal<EventStatus>('');
  readonly searchQuery = signal('');

  readonly replaying = signal(false);
  readonly replayResult = signal<{ newCorrelationId: string } | null>(null);

  readonly statusChips: StatusChip[] = [
    { value: '', labelKey: 'events.filter.allStatuses' },
    { value: 'processed', labelKey: 'events.filter.processed' },
    { value: 'failed', labelKey: 'events.filter.failed' },
    { value: 'processing', labelKey: 'events.filter.processing' },
  ];

  readonly filtered = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    const list = this.events();
    if (!q) return list;
    return list.filter(
      (e) =>
        e.correlationId.toLowerCase().includes(q) ||
        e.sourceType.toLowerCase().includes(q),
    );
  });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.svc
      .list({ status: this.filterStatus() || undefined, limit: 25 })
      .subscribe({
        next: (res) => {
          this.events.set(res.items);
          this.nextCursor.set(res.nextCursor);
          this.loading.set(false);
        },
        error: (err) => {
          this.error.set(err?.error?.message ?? 'events.errors.loadFailed');
          this.loading.set(false);
        },
      });
  }

  setStatus(status: EventStatus): void {
    this.filterStatus.set(status);
    this.load();
  }

  clearFilters(): void {
    this.searchQuery.set('');
    this.filterStatus.set('');
    this.load();
  }

  loadMore(): void {
    const cursor = this.nextCursor();
    if (!cursor || this.loadingMore()) return;
    this.loadingMore.set(true);
    this.svc
      .list({ status: this.filterStatus() || undefined, cursor })
      .subscribe({
        next: (res) => {
          this.events.update((list) => [...list, ...res.items]);
          this.nextCursor.set(res.nextCursor);
          this.loadingMore.set(false);
        },
        error: () => this.loadingMore.set(false),
      });
  }

  openDetail(id: string): void {
    this.replayResult.set(null);
    this.svc.get(id).subscribe({
      next: (d) => this.detail.set(d),
      error: () => this.toast.error('Failed to load event'),
    });
  }

  closeDetail(): void {
    this.detail.set(null);
    this.replayResult.set(null);
  }

  copyId(id: string, event: Event): void {
    event.stopPropagation();
    navigator.clipboard.writeText(id).then(() => {
      this.toast.success('Correlation ID copied');
    });
  }

  async replayCurrent(): Promise<void> {
    const d = this.detail();
    if (!d || this.replaying()) return;

    const ok = await this.confirm.confirm({
      title: 'Replay event',
      message:
        'Replay this event from scratch? A new correlation ID will be created and all destinations will receive it again.',
      confirmText: 'Replay',
      variant: 'default',
      icon: 'info',
    });
    if (!ok) return;

    this.replaying.set(true);
    this.replayResult.set(null);

    this.svc.replayEvent(d._id).subscribe({
      next: (r) => {
        this.replaying.set(false);
        this.replayResult.set({ newCorrelationId: r.newCorrelationId });
        this.toast.success('Event queued for replay');
      },
      error: (err) => {
        this.replaying.set(false);
        this.toast.error(err?.error?.message ?? 'Failed to replay event');
      },
    });
  }

  statusBadgeClass(status: string): string {
    const base = 'inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium';
    if (status === 'processed') return `${base} bg-signal-green/12 text-signal-green`;
    if (status === 'failed') return `${base} bg-signal-rose/12 text-signal-rose`;
    if (status === 'processing') return `${base} bg-signal-amber/12 text-signal-amber`;
    return `${base} bg-surface-3 text-muted`;
  }
}