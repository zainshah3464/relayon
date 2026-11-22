import {
  Component,
  inject,
  input,
  signal,
  OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslocoModule } from '@jsverse/transloco';
import {
  WorkflowsService,
  WorkflowSchedule,
} from '../../core/api/workflows.service';
import { IconComponent } from '../../shared/ui/icon/icon.component';
import { ConfirmDialogService } from '../../shared/ui/confirm/confirm-dialog.service';
import { ToastService } from '../../shared/ui/toast/toast.service';

interface Preset {
  labelKey: string;
  cron: string;
}

const PRESETS: Preset[] = [
  { labelKey: 'workflows.schedule.presets.every15', cron: '*/15 * * * *' },
  { labelKey: 'workflows.schedule.presets.hourly', cron: '0 * * * *' },
  { labelKey: 'workflows.schedule.presets.daily9', cron: '0 9 * * *' },
  { labelKey: 'workflows.schedule.presets.weekdays9', cron: '0 9 * * 1-5' },
  { labelKey: 'workflows.schedule.presets.weeklyMon9', cron: '0 9 * * 1' },
];

@Component({
  selector: 'app-workflow-schedule-card',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslocoModule, IconComponent],
  template: `
    <div class="card">
      <div class="flex items-start justify-between gap-3">
        <div class="flex items-start gap-3">
          <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-relay-cyan/10 text-relay-cyan">
            <app-icon name="calendar" [size]="16" [strokeWidth]="2" />
          </div>
          <div>
            <h2 class="text-sm font-semibold text-foreground">
              {{ 'workflows.schedule.title' | transloco }}
            </h2>
            <p class="mt-0.5 text-xs text-muted">
              {{ 'workflows.schedule.subtitle' | transloco }}
            </p>
          </div>
        </div>

        @if (schedule(); as s) {
          <span [ngClass]="s.isActive ? 'badge-success' : 'badge'" class="badge">
            <span
              class="inline-block h-1.5 w-1.5 rounded-full"
              [class.bg-signal-green]="s.isActive"
              [class.bg-muted-2]="!s.isActive"
            ></span>
            {{ (s.isActive ? 'workflows.schedule.active' : 'workflows.schedule.paused') | transloco }}
          </span>
        }
      </div>

      @if (error()) {
        <div class="mt-3 flex items-start gap-2 rounded-lg border border-signal-rose/30 bg-signal-rose/10 px-3 py-2 text-xs text-signal-rose">
          <app-icon name="alert-circle" [size]="14" [strokeWidth]="2" class="mt-0.5 shrink-0" />
          <span>{{ error() }}</span>
        </div>
      }

      <!-- ═══════════ NO SCHEDULE ═══════════ -->
      @if (!editing() && !schedule()) {
        <div class="mt-4 flex flex-col items-start gap-2 rounded-lg border border-dashed border-hairline bg-surface-2/40 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p class="text-sm text-muted">No schedule yet.</p>
          <button type="button" (click)="startCreate()" class="btn-primary text-xs">
            <app-icon name="plus" [size]="12" [strokeWidth]="2.5" />
            <span>{{ 'workflows.schedule.addSchedule' | transloco }}</span>
          </button>
        </div>
      }

      <!-- ═══════════ VIEW MODE ═══════════ -->
      @if (!editing() && schedule(); as s) {
        <div class="mt-4 grid gap-3 sm:grid-cols-3">
          <div class="rounded-lg border border-hairline bg-surface-2/50 p-2.5">
            <p class="text-[10px] font-medium uppercase tracking-wider text-muted-2">
              {{ 'workflows.schedule.cron' | transloco }}
            </p>
            <code class="mt-1 block font-mono text-xs text-foreground">{{ s.cronExpression }}</code>
          </div>
          <div class="rounded-lg border border-hairline bg-surface-2/50 p-2.5">
            <p class="text-[10px] font-medium uppercase tracking-wider text-muted-2">
              {{ 'workflows.schedule.timezone' | transloco }}
            </p>
            <p class="mt-1 text-xs text-foreground">{{ s.timezone }}</p>
          </div>
          <div class="rounded-lg border border-hairline bg-surface-2/50 p-2.5">
            <p class="text-[10px] font-medium uppercase tracking-wider text-muted-2">
              {{ 'workflows.schedule.nextRun' | transloco }}
            </p>
            <p class="mt-1 text-xs text-foreground">{{ s.nextRunAt | date: 'short' }}</p>
          </div>
        </div>

        <div class="mt-3 flex flex-wrap gap-2">
          <button type="button" (click)="startEdit(s)" class="btn-secondary text-xs">
            <app-icon name="edit" [size]="12" [strokeWidth]="2" />
            <span>{{ 'common.edit' | transloco }}</span>
          </button>
          <button type="button" (click)="runNow(s)" [disabled]="running()" class="btn-primary text-xs">
            @if (running()) {
              <app-icon name="loader" [size]="12" [strokeWidth]="2.5" class="animate-spin" />
            } @else {
              <app-icon name="play" [size]="12" [strokeWidth]="2.5" />
            }
            <span>{{ (running() ? 'workflows.schedule.running' : 'workflows.schedule.runNow') | transloco }}</span>
          </button>
          <button type="button" (click)="toggleActive(s)" class="btn-secondary text-xs">
            <app-icon
              [name]="s.isActive ? 'pause' : 'play'"
              [size]="12"
              [strokeWidth]="2.5"
            />
            <span>{{ (s.isActive ? 'workflows.schedule.pause' : 'workflows.schedule.resume') | transloco }}</span>
          </button>
          <button type="button" (click)="remove()" class="btn-secondary text-xs text-signal-rose">
            <app-icon name="trash" [size]="12" [strokeWidth]="2" />
            <span>{{ 'common.delete' | transloco }}</span>
          </button>
        </div>

        @if (runResult(); as r) {
          <div
            class="mt-3 flex items-start gap-2 rounded-lg border px-3 py-2 text-xs"
            [ngClass]="{
              'border-signal-green/30': r.triggered,
              'bg-signal-green/10': r.triggered,
              'text-signal-green': r.triggered,
              'border-signal-rose/30': !r.triggered,
              'bg-signal-rose/10': !r.triggered,
              'text-signal-rose': !r.triggered
            }"
          >
            <app-icon
              [name]="r.triggered ? 'check-circle' : 'x-circle'"
              [size]="13"
              [strokeWidth]="2"
              class="mt-0.5 shrink-0"
            />
            <span>
              @if (r.triggered) {
                {{ 'workflows.schedule.triggered' | transloco }}
                · <code class="font-mono">{{ r.correlationId?.slice(0, 8) }}…</code>
              } @else {
                {{ r.error }}
              }
            </span>
          </div>
        }
      }

      <!-- ═══════════ EDIT MODE ═══════════ -->
      @if (editing()) {
        <div class="mt-4 space-y-3">
          <div>
            <label class="label">{{ 'workflows.schedule.preset' | transloco }}</label>
            <select (change)="applyPreset($event)" class="input">
              <option value="">{{ 'workflows.schedule.custom' | transloco }}</option>
              @for (p of presets; track p.cron) {
                <option [value]="p.cron">{{ p.labelKey | transloco }} — {{ p.cron }}</option>
              }
            </select>
          </div>

          <div class="grid gap-3 sm:grid-cols-2">
            <div>
              <label class="label">{{ 'workflows.schedule.cronExpression' | transloco }}</label>
              <input [(ngModel)]="cronExpression" class="input font-mono text-xs" placeholder="0 9 * * *" />
            </div>
            <div>
              <label class="label">{{ 'workflows.schedule.timezone' | transloco }}</label>
              <input [(ngModel)]="timezone" class="input" placeholder="UTC" />
            </div>
          </div>

          <div>
            <label class="label">{{ 'workflows.schedule.payloadTemplate' | transloco }}</label>
            <textarea
              [(ngModel)]="payloadTemplate"
              rows="3"
              class="input font-mono text-xs"
              placeholder='{ "report": "daily" }'
            ></textarea>
          </div>

          <div class="flex gap-2">
            <button type="button" (click)="save()" [disabled]="saving()" class="btn-primary text-xs">
              @if (saving()) {
                <app-icon name="loader" [size]="12" [strokeWidth]="2.5" class="animate-spin" />
              }
              <span>{{ (saving() ? 'workflows.schedule.saving' : 'workflows.schedule.saveSchedule') | transloco }}</span>
            </button>
            <button type="button" (click)="cancelEdit()" class="btn-secondary text-xs">
              {{ 'common.cancel' | transloco }}
            </button>
          </div>
        </div>
      }
    </div>
  `,
})
export class WorkflowScheduleCardComponent implements OnInit {
  readonly workflowId = input.required<string>();
  private readonly svc = inject(WorkflowsService);
  private readonly confirm = inject(ConfirmDialogService);
  private readonly toast = inject(ToastService);

  readonly presets = PRESETS;

  readonly schedule = signal<WorkflowSchedule | null>(null);
  readonly editing = signal(false);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  readonly running = signal(false);
  readonly runResult = signal<{
    triggered: boolean;
    correlationId?: string | null;
    error?: string;
  } | null>(null);

  cronExpression = '';
  timezone = 'UTC';
  payloadTemplate = '{}';

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.svc.getSchedule(this.workflowId()).subscribe({
      next: (s) => this.schedule.set(s),
      error: () => this.schedule.set(null),
    });
  }

  startCreate(): void {
    this.cronExpression = '0 9 * * *';
    this.timezone = 'UTC';
    this.payloadTemplate = '{}';
    this.error.set(null);
    this.editing.set(true);
  }

  startEdit(s: WorkflowSchedule): void {
    this.cronExpression = s.cronExpression;
    this.timezone = s.timezone;
    this.payloadTemplate = JSON.stringify(s.payloadTemplate ?? {}, null, 2);
    this.error.set(null);
    this.editing.set(true);
  }

  cancelEdit(): void {
    this.editing.set(false);
    this.error.set(null);
  }

  applyPreset(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    if (value) this.cronExpression = value;
  }

  save(): void {
    if (this.saving()) return;

    let template: Record<string, unknown> = {};
    if (this.payloadTemplate.trim()) {
      try {
        template = JSON.parse(this.payloadTemplate) as Record<string, unknown>;
      } catch {
        this.error.set('Invalid JSON payload template');
        return;
      }
    }

    this.saving.set(true);
    this.error.set(null);

    this.svc
      .upsertSchedule(this.workflowId(), {
        cronExpression: this.cronExpression.trim(),
        timezone: this.timezone.trim() || 'UTC',
        payloadTemplate: template,
        isActive: true,
      })
      .subscribe({
        next: (s) => {
          this.schedule.set(s);
          this.saving.set(false);
          this.editing.set(false);
          this.toast.success('Schedule saved');
        },
        error: (err) => {
          this.saving.set(false);
          this.error.set(
            err?.error?.message ?? 'Failed to save schedule',
          );
        },
      });
  }

  toggleActive(s: WorkflowSchedule): void {
    this.svc
      .upsertSchedule(this.workflowId(), {
        cronExpression: s.cronExpression,
        timezone: s.timezone,
        payloadTemplate: s.payloadTemplate,
        isActive: !s.isActive,
      })
      .subscribe({
        next: (updated) => {
          this.schedule.set(updated);
          this.toast.success(updated.isActive ? 'Schedule resumed' : 'Schedule paused');
        },
        error: () => this.toast.error('Failed to update schedule'),
      });
  }

  async remove(): Promise<void> {
    const ok = await this.confirm.confirm({
      title: 'Delete schedule',
      message:
        'Delete this schedule? Events will stop being generated on the cron.',
      confirmText: 'Delete',
      variant: 'danger',
      icon: 'trash',
    });
    if (!ok) return;

    this.svc.deleteSchedule(this.workflowId()).subscribe({
      next: () => {
        this.schedule.set(null);
        this.toast.success('Schedule deleted');
      },
      error: () => this.toast.error('Failed to delete schedule'),
    });
  }

  runNow(s: WorkflowSchedule): void {
    if (this.running()) return;
    this.running.set(true);
    this.runResult.set(null);

    this.svc.runScheduleNow(this.workflowId()).subscribe({
      next: (r) => {
        this.running.set(false);
        this.runResult.set({ triggered: true, correlationId: r.correlationId });
        this.toast.success('Schedule triggered');
        void s;
        this.load();
      },
      error: (err) => {
        this.running.set(false);
        this.runResult.set({
          triggered: false,
          error: err?.error?.message ?? 'Run-now failed',
        });
        this.toast.error('Failed to trigger schedule');
      },
    });
  }
}