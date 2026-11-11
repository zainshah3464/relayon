import { Component, inject, input, output, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import {
  WorkflowsService,
  WorkflowVersionSummary,
  WorkflowVersionDetail,
} from '../../core/api/workflows.service';

@Component({
  selector: 'app-workflow-versions-drawer',
  standalone: true,
  imports: [CommonModule, TranslocoModule],
  template: `
    <div class="fixed inset-0 z-50 bg-black/60 flex justify-end" (click)="close.emit()">
      <div
        class="bg-surface w-full max-w-4xl h-full overflow-y-auto p-6"
        (click)="$event.stopPropagation()"
      >
        <div class="flex justify-between items-center mb-4">
          <h2 class="text-lg font-semibold text-white">{{ 'workflows.versions.title' | transloco }}</h2>
          <button (click)="close.emit()" class="text-muted hover:text-white">✕</button>
        </div>

        @if (error()) {
          <div class="text-sm text-signal-rose mb-3">{{ error() | transloco }}</div>
        }

        @if (loading()) {
          <p class="text-sm text-muted">{{ 'workflows.versions.loading' | transloco }}</p>
        } @else if (versions().length === 0) {
          <p class="text-sm text-muted">{{ 'workflows.versions.empty' | transloco }}</p>
        } @else {
          <div class="space-y-2">
            @for (v of versions(); track v.id) {
              <div class="card bg-surface-2">
                <div class="flex justify-between items-start">
                  <div>
                    <p class="text-white text-sm font-medium">
                      v{{ v.version }}
                      @if (v.version === latestVersion()) {
                        <span class="text-xs text-relay-cyan ml-1">{{ 'workflows.versions.latest' | transloco }}</span>
                      }
                    </p>
                    <p class="text-xs text-muted mt-1">{{ v.message || ('workflows.versions.noMessage' | transloco) }}</p>
                    <p class="text-xs text-muted mt-1">{{ v.createdAt | date: 'medium' }}</p>
                  </div>
                  <div class="flex gap-2">
                    <button (click)="inspect(v)" class="text-xs text-relay-cyan hover:underline">{{ 'common.view' | transloco }}</button>
                    <button (click)="toggleCompare(v)" class="text-xs text-relay-cyan hover:underline">
                      {{ (isCompareSelected(v) ? 'workflows.versions.selected' : 'workflows.versions.compare') | transloco }}
                    </button>
                    @if (v.version !== latestVersion()) {
                      <button (click)="restore(v)" class="text-xs text-signal-amber hover:underline">{{ 'workflows.versions.restore' | transloco }}</button>
                    }
                  </div>
                </div>
              </div>
            }
          </div>
        }

        @if (compareMode()) {
          <div class="mt-6 space-y-3">
            <div class="flex justify-between items-center">
              <h3 class="text-sm font-medium text-white">
                {{ 'workflows.versions.diff' | transloco }}
                @if (compareA() && compareB()) {
                  <span class="text-xs text-muted ml-2">
                    v{{ compareA()!.version }} → v{{ compareB()!.version }}
                  </span>
                }
              </h3>
              <button (click)="exitCompare()" class="text-xs text-muted hover:text-white">{{ 'workflows.versions.exit' | transloco }}</button>
            </div>

            <p class="text-xs text-muted">
              {{ 'workflows.versions.selectHint' | transloco }}
            </p>

            @if (diffResult(); as d) {
              @if (d.identical) {
                <p class="text-sm text-muted">{{ 'workflows.versions.identical' | transloco }}</p>
              } @else {
                <div class="flex items-center gap-3 text-xs">
                  <span class="text-signal-green">+{{ d.stats.added }}</span>
                  <span class="text-signal-rose">-{{ d.stats.removed }}</span>
                  <div class="ml-auto flex gap-1">
                    <button
                      (click)="diffMode.set('split')"
                      class="px-2 py-0.5 rounded text-[10px]"
                      [ngClass]="{
                        'bg-relay-violet text-white': diffMode() === 'split',
                        'text-muted': diffMode() !== 'split'
                      }"
                    >{{ 'workflows.versions.split' | transloco }}</button>
                    <button
                      (click)="diffMode.set('unified')"
                      class="px-2 py-0.5 rounded text-[10px]"
                      [ngClass]="{
                        'bg-relay-violet text-white': diffMode() === 'unified',
                        'text-muted': diffMode() !== 'unified'
                      }"
                    >{{ 'workflows.versions.unified' | transloco }}</button>
                  </div>
                </div>

                @if (diffMode() === 'split') {
                  <div class="rounded overflow-auto max-h-[500px] bg-surface-2 font-mono text-[10px]">
                    <table class="w-full border-collapse">
                      <tbody>
                        @for (row of d.structured.split; track $index) {
                          <tr>
                            <td class="w-10 text-right pr-2 text-muted select-none border-r border-hairline">{{ row.left.lineNo ?? '' }}</td>
                            <td
                              class="px-2 whitespace-pre-wrap break-all"
                              [ngClass]="{
                                'bg-signal-rose/10 text-signal-rose': row.left.type === 'del',
                                'text-muted': row.left.type === 'blank'
                              }"
                            >{{ row.left.text || ' ' }}</td>
                            <td class="w-10 text-right pr-2 text-muted select-none border-l border-r border-hairline">{{ row.right.lineNo ?? '' }}</td>
                            <td
                              class="px-2 whitespace-pre-wrap break-all"
                              [ngClass]="{
                                'bg-signal-green/10 text-signal-green': row.right.type === 'add',
                                'text-muted': row.right.type === 'blank'
                              }"
                            >{{ row.right.text || ' ' }}</td>
                          </tr>
                        }
                      </tbody>
                    </table>
                  </div>
                } @else {
                  <pre class="bg-surface-2 p-3 rounded text-[10px] overflow-auto max-h-[500px] font-mono">@for (line of diffLines(); track $index) {<span
                    [class.text-signal-green]="line.startsWith('+') && !line.startsWith('+++')"
                    [class.text-signal-rose]="line.startsWith('-') && !line.startsWith('---')"
                    [class.text-relay-cyan]="line.startsWith('@@')"
                    [class.text-muted]="line.startsWith('+++') || line.startsWith('---')"
                    class="block"
                  >{{ line || ' ' }}</span>}</pre>
                }
              }
            } @else if (compareA() && compareB()) {
              <button (click)="runDiff()" [disabled]="diffing()" class="btn-primary text-xs">
                {{ (diffing() ? 'workflows.versions.computing' : 'workflows.versions.computeDiff') | transloco }}
              </button>
            }
          </div>
        } @else {
          @if (detail(); as d) {
            <div class="mt-6">
              <div class="flex justify-between items-center mb-2">
                <h3 class="text-sm font-medium text-white">{{ 'workflows.versions.snapshot' | transloco }} v{{ d.version }}</h3>
                <button (click)="detail.set(null)" class="text-xs text-muted hover:text-white">{{ 'common.close' | transloco }}</button>
              </div>
              <pre class="bg-surface-2 p-3 rounded text-xs overflow-x-auto text-relay-cyan">{{ d.snapshot | json }}</pre>
            </div>
          }
        }
      </div>
    </div>
  `,
})
export class WorkflowVersionsDrawerComponent implements OnInit {
  readonly workflowId = input.required<string>();
  readonly close = output<void>();
  readonly restored = output<void>();

  private svc = inject(WorkflowsService);
  private transloco = inject(TranslocoService);

  versions = signal<WorkflowVersionSummary[]>([]);
  detail = signal<WorkflowVersionDetail | null>(null);
  loading = signal(true);
  error = signal<string | null>(null);

  compareMode = signal(false);
  compareA = signal<WorkflowVersionDetail | null>(null);
  compareB = signal<WorkflowVersionDetail | null>(null);
  diffMode = signal<'split' | 'unified'>('split');

  diffResult = signal<{
    fromVersion: number;
    toVersion: number;
    identical: boolean;
    stats: { added: number; removed: number };
    unified: string;
    structured: {
      hunks: Array<{ oldStart: number; oldLines: number; newStart: number; newLines: number }>;
      split: Array<{
        left: { lineNo: number | null; text: string; type: 'ctx' | 'del' | 'blank' };
        right: { lineNo: number | null; text: string; type: 'ctx' | 'add' | 'blank' };
      }>;
    };
  } | null>(null);

  diffing = signal(false);

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
        this.error.set(err?.error?.message ?? 'workflows.versions.errors.loadFailed');
        this.loading.set(false);
      },
    });
  }

  inspect(v: WorkflowVersionSummary): void {
    this.svc.getVersion(this.workflowId(), v.version).subscribe({
      next: (d) => this.detail.set(d),
      error: (err) => this.error.set(err?.error?.message ?? 'workflows.versions.errors.loadOneFailed'),
    });
  }

  restore(v: WorkflowVersionSummary): void {
    const msg = this.transloco.translate('workflows.versions.restoreConfirm', { version: v.version });
    if (!confirm(msg)) {
      return;
    }

    this.svc.restoreVersion(this.workflowId(), v.version).subscribe({
      next: () => {
        this.detail.set(null);
        this.load();
        this.restored.emit();
      },
      error: (err) => this.error.set(err?.error?.message ?? 'workflows.versions.errors.restoreFailed'),
    });
  }

  toggleCompare(v: WorkflowVersionSummary): void {
    this.compareMode.set(true);
    this.diffResult.set(null);

    this.svc.getVersion(this.workflowId(), v.version).subscribe({
      next: (detail) => {
        if (!this.compareA() || this.compareA()?.version === v.version) {
          this.compareA.set(detail);
        } else if (!this.compareB() || this.compareB()?.version === v.version) {
          this.compareB.set(detail);
        } else {
          this.compareB.set(this.compareA());
          this.compareA.set(detail);
        }
      },
      error: (err) => this.error.set(err?.error?.message ?? 'workflows.versions.errors.loadOneFailed'),
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
        this.error.set(err?.error?.message ?? 'workflows.versions.errors.diffFailed');
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