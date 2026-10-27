import { Component, inject, input, output, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  WorkflowsService,
  WorkflowVersionSummary,
  WorkflowVersionDetail,
} from '../../core/api/workflows.service';

@Component({
  selector: 'app-workflow-versions-drawer',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="fixed inset-0 z-50 bg-black/60 flex justify-end" (click)="close.emit()">
      <div
        class="bg-surface w-full max-w-xl h-full overflow-y-auto p-6"
        (click)="$event.stopPropagation()"
      >
        <div class="flex justify-between items-center mb-4">
          <h2 class="text-lg font-semibold text-white">Version history</h2>
          <button (click)="close.emit()" class="text-muted hover:text-white">✕</button>
        </div>

        @if (error()) {
          <div class="text-sm text-signal-rose mb-3">{{ error() }}</div>
        }

        @if (loading()) {
          <p class="text-sm text-muted">Loading versions...</p>
        } @else if (versions().length === 0) {
          <p class="text-sm text-muted">No versions yet.</p>
        } @else {
          <div class="space-y-2">
            @for (v of versions(); track v.id) {
              <div class="card bg-surface-2">
                <div class="flex justify-between items-start">
                  <div>
                    <p class="text-white text-sm font-medium">
                      v{{ v.version }}
                      @if (v.version === latestVersion()) {
                        <span class="text-xs text-relay-cyan ml-1">latest</span>
                      }
                    </p>
                    <p class="text-xs text-muted mt-1">{{ v.message || 'No message' }}</p>
                    <p class="text-xs text-muted mt-1">{{ v.createdAt | date: 'medium' }}</p>
                  </div>
                  <div class="flex gap-2">
                    <button (click)="inspect(v)" class="text-xs text-relay-cyan hover:underline">View</button>
                    <button (click)="toggleCompare(v)" class="text-xs text-relay-cyan hover:underline">
                      {{ isCompareSelected(v) ? 'Selected' : 'Compare' }}
                    </button>
                    @if (v.version !== latestVersion()) {
                      <button (click)="restore(v)" class="text-xs text-signal-amber hover:underline">Restore</button>
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
                Diff
                @if (compareA() && compareB()) {
                  <span class="text-xs text-muted ml-2">
                    v{{ compareA()!.version }} → v{{ compareB()!.version }}
                  </span>
                }
              </h3>
              <button (click)="exitCompare()" class="text-xs text-muted hover:text-white">Exit</button>
            </div>

            <p class="text-xs text-muted">
              Select two versions from the list — first click is A, second is B.
            </p>

            @if (diffResult(); as d) {
              @if (d.identical) {
                <p class="text-sm text-muted">Versions are identical.</p>
              } @else {
                <div class="flex gap-3 text-xs">
                  <span class="text-signal-green">+{{ d.stats.added }}</span>
                  <span class="text-signal-rose">-{{ d.stats.removed }}</span>
                </div>
                <pre class="bg-surface-2 p-3 rounded text-[10px] overflow-auto max-h-[500px] font-mono">@for (line of diffLines(); track $index) {<span
                  [class.text-signal-green]="line.startsWith('+') && !line.startsWith('+++')"
                  [class.text-signal-rose]="line.startsWith('-') && !line.startsWith('---')"
                  [class.text-relay-cyan]="line.startsWith('@@')"
                  [class.text-muted]="line.startsWith('+++') || line.startsWith('---')"
                  class="block"
                >{{ line || ' ' }}</span>}</pre>
              }
            } @else if (compareA() && compareB()) {
              <button (click)="runDiff()" [disabled]="diffing()" class="btn-primary text-xs">
                {{ diffing() ? 'Computing...' : 'Compute diff' }}
              </button>
            }
          </div>
        } @else {
          @if (detail(); as d) {
            <div class="mt-6">
              <div class="flex justify-between items-center mb-2">
                <h3 class="text-sm font-medium text-white">Snapshot v{{ d.version }}</h3>
                <button (click)="detail.set(null)" class="text-xs text-muted hover:text-white">Close</button>
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

  versions = signal<WorkflowVersionSummary[]>([]);
  detail = signal<WorkflowVersionDetail | null>(null);
  loading = signal(true);
  error = signal<string | null>(null);

  compareMode = signal(false);
  compareA = signal<WorkflowVersionDetail | null>(null);
  compareB = signal<WorkflowVersionDetail | null>(null);

  diffResult = signal<{
    fromVersion: number;
    toVersion: number;
    identical: boolean;
    stats: { added: number; removed: number };
    unified: string;
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
        this.error.set(err?.error?.message ?? 'Failed to load versions');
        this.loading.set(false);
      },
    });
  }

  inspect(v: WorkflowVersionSummary): void {
    this.svc.getVersion(this.workflowId(), v.version).subscribe({
      next: (d) => this.detail.set(d),
      error: (err) => this.error.set(err?.error?.message ?? 'Failed to load version'),
    });
  }

  restore(v: WorkflowVersionSummary): void {
    if (
      !confirm(
        `Restore to v${v.version}? Current destinations will be replaced. A new version will be created.`,
      )
    ) {
      return;
    }

    this.svc.restoreVersion(this.workflowId(), v.version).subscribe({
      next: () => {
        this.detail.set(null);
        this.load();
        this.restored.emit();
      },
      error: (err) => this.error.set(err?.error?.message ?? 'Restore failed'),
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
      error: (err) => this.error.set(err?.error?.message ?? 'Failed to load version'),
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
        this.error.set(err?.error?.message ?? 'Diff failed');
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