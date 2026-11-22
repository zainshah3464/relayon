import {
  Component,
  inject,
  input,
  output,
  signal,
  OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslocoModule } from '@jsverse/transloco';
import {
  WorkflowsService,
  WorkflowVersionSummary,
  WorkflowVersionDetail,
} from '../../core/api/workflows.service';
import { IconComponent } from '../../shared/ui/icon/icon.component';
import { ModalComponent } from '../../shared/ui/modal/modal.component';
import { ConfirmDialogService } from '../../shared/ui/confirm/confirm-dialog.service';
import { ToastService } from '../../shared/ui/toast/toast.service';

@Component({
  selector: 'app-workflow-versions-drawer',
  standalone: true,
  imports: [CommonModule, TranslocoModule, IconComponent, ModalComponent],
  template: `
    <app-modal
      title="{{ 'workflows.versions.title' | transloco }}"
      subtitle="Snapshot, compare, and restore past workflow configurations."
      size="full"
      (closed)="close.emit()"
    >
      @if (error()) {
        <div class="mb-3 flex items-start gap-2 rounded-lg border border-signal-rose/30 bg-signal-rose/10 px-3 py-2 text-xs text-signal-rose">
          <app-icon name="alert-circle" [size]="14" [strokeWidth]="2" class="mt-0.5 shrink-0" />
          <span>{{ error() }}</span>
        </div>
      }

      @if (loading()) {
        <div class="space-y-2">
          @for (i of [1, 2, 3]; track i) {
            <div class="rounded-lg border border-hairline bg-surface-2 p-3">
              <div class="skeleton h-3 w-24"></div>
              <div class="skeleton mt-2 h-3 w-48"></div>
            </div>
          }
        </div>
      } @else if (versions().length === 0) {
        <div class="flex flex-col items-center justify-center py-12 text-center">
          <div class="flex h-12 w-12 items-center justify-center rounded-xl border border-hairline bg-surface-2 text-muted">
            <app-icon name="clock" [size]="22" [strokeWidth]="2" />
          </div>
          <p class="mt-3 text-sm font-medium text-foreground">No versions yet</p>
          <p class="mt-1 max-w-sm text-xs text-muted">
            {{ 'workflows.versions.empty' | transloco }}
          </p>
        </div>
      } @else {
        <div class="space-y-2">
          @for (v of versions(); track v.id) {
            <div
              class="rounded-lg border bg-surface-2 p-3 transition-colors"
              [ngClass]="{
                'border-relay-violet/40': isCompareSelected(v),
                'border-hairline': !isCompareSelected(v)
              }"
            >
              <div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div class="min-w-0 flex-1">
                  <div class="flex flex-wrap items-center gap-1.5">
                    <span class="rounded bg-surface-3 px-1.5 py-0.5 font-mono text-[11px] font-medium text-foreground">
                      v{{ v.version }}
                    </span>
                    @if (v.version === latestVersion()) {
                      <span class="badge badge-info">{{ 'workflows.versions.latest' | transloco }}</span>
                    }
                    @if (isCompareSelected(v)) {
                      <span class="badge badge-success">{{ 'workflows.versions.selected' | transloco }}</span>
                    }
                  </div>
                  <p class="mt-1.5 text-xs text-foreground">
                    {{ v.message || ('workflows.versions.noMessage' | transloco) }}
                  </p>
                  <p class="mt-0.5 text-[11px] text-muted-2">{{ v.createdAt | date: 'medium' }}</p>
                </div>

                <div class="flex shrink-0 gap-1">
                  <button
                    type="button"
                    (click)="inspect(v)"
                    class="btn-ghost text-xs"
                  >
                    <app-icon name="eye" [size]="12" [strokeWidth]="2" />
                    <span>{{ 'common.view' | transloco }}</span>
                  </button>
                  <button
                    type="button"
                    (click)="toggleCompare(v)"
                    class="btn-ghost text-xs"
                  >
                    <app-icon name="filter" [size]="12" [strokeWidth]="2" />
                    <span>{{ (isCompareSelected(v) ? 'workflows.versions.selected' : 'workflows.versions.compare') | transloco }}</span>
                  </button>
                  @if (v.version !== latestVersion()) {
                    <button
                      type="button"
                      (click)="restore(v)"
                      class="btn-ghost text-xs text-signal-amber hover:bg-signal-amber/10"
                    >
                      <app-icon name="refresh" [size]="12" [strokeWidth]="2.5" />
                      <span>{{ 'workflows.versions.restore' | transloco }}</span>
                    </button>
                  }
                </div>
              </div>
            </div>
          }
        </div>
      }

      <!-- ═══════════ COMPARE MODE ═══════════ -->
      @if (compareMode()) {
        <div class="mt-5 rounded-lg border border-hairline bg-surface-2 p-4">
          <div class="flex items-center justify-between">
            <h3 class="text-sm font-semibold text-foreground">
              {{ 'workflows.versions.diff' | transloco }}
              @if (compareA() && compareB()) {
                <span class="ml-2 font-mono text-xs text-muted">
                  v{{ compareA()!.version }} → v{{ compareB()!.version }}
                </span>
              }
            </h3>
            <button
              type="button"
              (click)="exitCompare()"
              class="flex h-7 w-7 items-center justify-center rounded-md text-muted-2 hover:bg-surface-3 hover:text-foreground"
              aria-label="Exit compare mode"
            >
              <app-icon name="x" [size]="13" [strokeWidth]="2.5" />
            </button>
          </div>

          <p class="mt-1.5 text-xs text-muted">
            {{ 'workflows.versions.selectHint' | transloco }}
          </p>

          @if (diffResult(); as d) {
            @if (d.identical) {
              <p class="mt-3 text-sm text-muted">{{ 'workflows.versions.identical' | transloco }}</p>
            } @else {
              <div class="mt-3 flex items-center gap-3 text-xs">
                <span class="flex items-center gap-1 text-signal-green">
                  <app-icon name="plus" [size]="11" [strokeWidth]="2.5" />
                  {{ d.stats.added }}
                </span>
                <span class="flex items-center gap-1 text-signal-rose">
                  <app-icon name="x" [size]="11" [strokeWidth]="2.5" />
                  {{ d.stats.removed }}
                </span>
                <div class="ml-auto flex gap-1">
                  <button
                    type="button"
                    (click)="diffMode.set('split')"
                    [class.bg-relay-violet]="diffMode() === 'split'"
                    [class.text-white]="diffMode() === 'split'"
                    [class.text-muted]="diffMode() !== 'split'"
                    class="rounded px-2 py-1 text-[10px] font-medium transition-colors"
                  >
                    {{ 'workflows.versions.split' | transloco }}
                  </button>
                  <button
                    type="button"
                    (click)="diffMode.set('unified')"
                    [class.bg-relay-violet]="diffMode() === 'unified'"
                    [class.text-white]="diffMode() === 'unified'"
                    [class.text-muted]="diffMode() !== 'unified'"
                    class="rounded px-2 py-1 text-[10px] font-medium transition-colors"
                  >
                    {{ 'workflows.versions.unified' | transloco }}
                  </button>
                </div>
              </div>

              @if (diffMode() === 'split') {
                <div class="mt-3 max-h-[500px] overflow-auto rounded-md border border-hairline bg-midnight font-mono text-[10px]">
                  <table class="w-full border-collapse">
                    <tbody>
                      @for (row of d.structured.split; track $index) {
                        <tr>
                          <td class="w-10 select-none border-r border-hairline pr-2 text-right text-muted-2">{{ row.left.lineNo ?? '' }}</td>
                          <td
                            class="whitespace-pre-wrap break-all px-2"
                            [ngClass]="{
                              'bg-signal-rose/10': row.left.type === 'del',
                              'text-signal-rose': row.left.type === 'del',
                              'text-muted-2': row.left.type === 'blank'
                            }"
                          >{{ row.left.text || ' ' }}</td>
                          <td class="w-10 select-none border-l border-r border-hairline pr-2 text-right text-muted-2">{{ row.right.lineNo ?? '' }}</td>
                          <td
                            class="whitespace-pre-wrap break-all px-2"
                            [ngClass]="{
                              'bg-signal-green/10': row.right.type === 'add',
                              'text-signal-green': row.right.type === 'add',
                              'text-muted-2': row.right.type === 'blank'
                            }"
                          >{{ row.right.text || ' ' }}</td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              } @else {
                <pre class="mt-3 max-h-[500px] overflow-auto rounded-md border border-hairline bg-midnight p-3 font-mono text-[10px]">@for (line of diffLines(); track $index) {<span
                  [class.text-signal-green]="line.startsWith('+') && !line.startsWith('+++')"
                  [class.text-signal-rose]="line.startsWith('-') && !line.startsWith('---')"
                  [class.text-relay-cyan]="line.startsWith('@@')"
                  [class.text-muted-2]="line.startsWith('+++') || line.startsWith('---')"
                  class="block"
                >{{ line || ' ' }}</span>}</pre>
              }
            }
          } @else if (compareA() && compareB()) {
            <button
              type="button"
              (click)="runDiff()"
              [disabled]="diffing()"
              class="btn-primary mt-3 text-xs"
            >
              @if (diffing()) {
                <app-icon name="loader" [size]="12" [strokeWidth]="2.5" class="animate-spin" />
              }
              <span>{{ (diffing() ? 'workflows.versions.computing' : 'workflows.versions.computeDiff') | transloco }}</span>
            </button>
          }
        </div>
      }

      <!-- ═══════════ SNAPSHOT PREVIEW ═══════════ -->
      @if (detail(); as d) {
        <div class="mt-5 rounded-lg border border-hairline bg-surface-2 p-4">
          <div class="flex items-center justify-between">
            <h3 class="text-sm font-semibold text-foreground">
              {{ 'workflows.versions.snapshot' | transloco }}
              <span class="font-mono text-xs text-muted">v{{ d.version }}</span>
            </h3>
            <button
              type="button"
              (click)="detail.set(null)"
              class="flex h-7 w-7 items-center justify-center rounded-md text-muted-2 hover:bg-surface-3 hover:text-foreground"
              aria-label="Close preview"
            >
              <app-icon name="x" [size]="13" [strokeWidth]="2.5" />
            </button>
          </div>
          <pre class="mt-2 max-h-[400px] overflow-x-auto rounded-md bg-midnight p-3 font-mono text-xs text-relay-cyan">{{ d.snapshot | json }}</pre>
        </div>
      }

      <div modal-footer>
        <button type="button" (click)="close.emit()" class="btn-secondary">
          {{ 'common.close' | transloco }}
        </button>
      </div>
    </app-modal>
  `,
})
export class WorkflowVersionsDrawerComponent implements OnInit {
  readonly workflowId = input.required<string>();
  readonly close = output<void>();
  readonly restored = output<void>();

  private readonly svc = inject(WorkflowsService);
  private readonly confirm = inject(ConfirmDialogService);
  private readonly toast = inject(ToastService);

  readonly versions = signal<WorkflowVersionSummary[]>([]);
  readonly detail = signal<WorkflowVersionDetail | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  readonly compareMode = signal(false);
  readonly compareA = signal<WorkflowVersionDetail | null>(null);
  readonly compareB = signal<WorkflowVersionDetail | null>(null);
  readonly diffMode = signal<'split' | 'unified'>('split');

  readonly diffResult = signal<{
    fromVersion: number;
    toVersion: number;
    identical: boolean;
    stats: { added: number; removed: number };
    unified: string;
    structured: {
      hunks: Array<{
        oldStart: number;
        oldLines: number;
        newStart: number;
        newLines: number;
      }>;
      split: Array<{
        left: { lineNo: number | null; text: string; type: 'ctx' | 'del' | 'blank' };
        right: { lineNo: number | null; text: string; type: 'ctx' | 'add' | 'blank' };
      }>;
    };
  } | null>(null);

  readonly diffing = signal(false);

  ngOnInit(): void {
    this.load();
  }

  latestVersion(): number {
    return this.versions()[0]?.version ?? 0;
  }

  load(): void {
    this.loading.set(true);
    this.svc.listVersions(this.workflowId()).subscribe({
      next: (v) => {
        this.versions.set(v);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(
          err?.error?.message ?? 'workflows.versions.errors.loadFailed',
        );
        this.loading.set(false);
      },
    });
  }

  inspect(v: WorkflowVersionSummary): void {
    this.svc.getVersion(this.workflowId(), v.version).subscribe({
      next: (d) => this.detail.set(d),
      error: (err) =>
        this.error.set(
          err?.error?.message ?? 'workflows.versions.errors.loadOneFailed',
        ),
    });
  }

  async restore(v: WorkflowVersionSummary): Promise<void> {
    const ok = await this.confirm.confirm({
      title: 'Restore version',
      message: `Restore to v${v.version}? Current destinations will be replaced. A new version will be created.`,
      confirmText: 'Restore',
      variant: 'default',
      icon: 'info',
    });
    if (!ok) return;

    this.svc.restoreVersion(this.workflowId(), v.version).subscribe({
      next: () => {
        this.detail.set(null);
        this.toast.success(`Restored to v${v.version}`);
        this.load();
        this.restored.emit();
      },
      error: (err) =>
        this.toast.error(
          err?.error?.message ?? 'Failed to restore version',
        ),
    });
  }

  toggleCompare(v: WorkflowVersionSummary): void {
    this.compareMode.set(true);
    this.diffResult.set(null);

    this.svc.getVersion(this.workflowId(), v.version).subscribe({
      next: (detail) => {
        if (!this.compareA() || this.compareA()?.version === v.version) {
          this.compareA.set(detail);
        } else if (
          !this.compareB() ||
          this.compareB()?.version === v.version
        ) {
          this.compareB.set(detail);
        } else {
          this.compareB.set(this.compareA());
          this.compareA.set(detail);
        }
      },
      error: (err) =>
        this.error.set(
          err?.error?.message ?? 'workflows.versions.errors.loadOneFailed',
        ),
    });
  }

  isCompareSelected(v: WorkflowVersionSummary): boolean {
    return (
      this.compareA()?.version === v.version ||
      this.compareB()?.version === v.version
    );
  }

  diffLines(): string[] {
    const d = this.diffResult();
    return d ? d.unified.split('\n') : [];
  }

  runDiff(): void {
    const a = this.compareA();
    const b = this.compareB();
    if (!a || !b || this.diffing()) return;

    this.diffing.set(true);
    this.svc.diffVersions(this.workflowId(), a.version, b.version).subscribe({
      next: (r) => {
        this.diffResult.set(r);
        this.diffing.set(false);
      },
      error: (err) => {
        this.error.set(
          err?.error?.message ?? 'workflows.versions.errors.diffFailed',
        );
        this.diffing.set(false);
      },
    });
  }

  exitCompare(): void {
    this.compareMode.set(false);
    this.compareA.set(null);
    this.compareB.set(null);
    this.diffResult.set(null);
  }
}