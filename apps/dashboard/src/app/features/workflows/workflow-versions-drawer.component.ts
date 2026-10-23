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
                    @if (v.version !== latestVersion()) {
                      <button (click)="restore(v)" class="text-xs text-signal-amber hover:underline">Restore</button>
                    }
                  </div>
                </div>
              </div>
            }
          </div>
        }

        @if (detail(); as d) {
          <div class="mt-6">
            <div class="flex justify-between items-center mb-2">
              <h3 class="text-sm font-medium text-white">Snapshot v{{ d.version }}</h3>
              <button (click)="detail.set(null)" class="text-xs text-muted hover:text-white">Close</button>
            </div>
            <pre class="bg-surface-2 p-3 rounded text-xs overflow-x-auto text-relay-cyan">{{ d.snapshot | json }}</pre>
          </div>
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
}