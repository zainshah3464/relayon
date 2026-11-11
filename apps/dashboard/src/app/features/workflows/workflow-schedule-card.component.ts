import { Component, inject, input, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import {
  WorkflowsService,
  WorkflowSchedule,
} from '../../core/api/workflows.service';

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
  imports: [CommonModule, FormsModule, TranslocoModule],
  template: `
    <div class="card">
      <div class="flex justify-between items-start mb-3">
        <div>
          <h2 class="text-sm font-medium text-white">{{ 'workflows.schedule.title' | transloco }}</h2>
          <p class="text-xs text-muted mt-1">
            {{ 'workflows.schedule.subtitle' | transloco }}
          </p>
        </div>
        @if (schedule(); as s) {
          <span
            class="text-xs px-2 py-0.5 rounded"
            [ngClass]="{
              'bg-signal-green/20': s.isActive,
              'text-signal-green': s.isActive,
              'bg-surface-2': !s.isActive,
              'text-muted': !s.isActive
            }"
          >{{ (s.isActive ? 'workflows.schedule.active' : 'workflows.schedule.paused') | transloco }}</span>
        }
      </div>

      @if (error()) {
        <div class="text-sm text-signal-rose mb-3">{{ error() | transloco }}</div>
      }

      @if (!editing()) {
        @if (schedule(); as s) {
          <div class="grid grid-cols-3 gap-4 mb-3">
            <div>
              <p class="text-xs uppercase text-muted">{{ 'workflows.schedule.cron' | transloco }}</p>
              <p class="text-sm text-white font-mono mt-1">{{ s.cronExpression }}</p>
            </div>
            <div>
              <p class="text-xs uppercase text-muted">{{ 'workflows.schedule.timezone' | transloco }}</p>
              <p class="text-sm text-white mt-1">{{ s.timezone }}</p>
            </div>
            <div>
              <p class="text-xs uppercase text-muted">{{ 'workflows.schedule.nextRun' | transloco }}</p>
              <p class="text-sm text-white mt-1">{{ s.nextRunAt | date: 'medium' }}</p>
            </div>
          </div>
          <div class="flex gap-2">
            <button (click)="startEdit(s)" class="btn-secondary text-xs">{{ 'common.edit' | transloco }}</button>
            <button (click)="runNow(s)" [disabled]="running()" class="btn-primary text-xs">
              {{ (running() ? 'workflows.schedule.running' : 'workflows.schedule.runNow') | transloco }}
            </button>
            <button (click)="toggleActive(s)" class="btn-secondary text-xs">
              {{ (s.isActive ? 'workflows.schedule.pause' : 'workflows.schedule.resume') | transloco }}
            </button>
            <button (click)="remove()" class="btn-secondary text-xs text-signal-rose">{{ 'common.delete' | transloco }}</button>
          </div>
          @if (runResult(); as r) {
            <p
              class="text-xs mt-2"
              [class.text-signal-green]="r.triggered"
              [class.text-signal-rose]="!r.triggered"
            >
              @if (r.triggered) {
                ✓ {{ 'workflows.schedule.triggered' | transloco }} — {{ 'workflows.detail.id' | transloco }} {{ r.correlationId?.slice(0, 8) }}…
              } @else {
                ✗ {{ r.error | transloco }}
              }
            </p>
          }
        } @else {
          <button (click)="startCreate()" class="btn-primary text-xs">{{ 'workflows.schedule.addSchedule' | transloco }}</button>
        }
      } @else {
        <div class="space-y-3">
          <div>
            <label class="label">{{ 'workflows.schedule.preset' | transloco }}</label>
            <select (change)="applyPreset($event)" class="input">
              <option value="">{{ 'workflows.schedule.custom' | transloco }}</option>
              @for (p of presets; track p.cron) {
                <option [value]="p.cron">{{ p.labelKey | transloco }} — {{ p.cron }}</option>
              }
            </select>
          </div>
          <div>
            <label class="label">{{ 'workflows.schedule.cronExpression' | transloco }}</label>
            <input [(ngModel)]="cronExpression" class="input font-mono" placeholder="0 9 * * *" />
          </div>
          <div>
            <label class="label">{{ 'workflows.schedule.timezone' | transloco }}</label>
            <input [(ngModel)]="timezone" class="input" placeholder="UTC" />
          </div>
          <div>
            <label class="label">{{ 'workflows.schedule.payloadTemplate' | transloco }}</label>
            <textarea
              [(ngModel)]="payloadTemplate"
              rows="3"
              class="input font-mono text-xs"
              placeholder='&#123; "report": "daily" &#125;'
            ></textarea>
          </div>
          <div class="flex gap-2">
            <button (click)="save()" [disabled]="saving()" class="btn-primary text-xs">
              {{ (saving() ? 'workflows.schedule.saving' : 'workflows.schedule.saveSchedule') | transloco }}
            </button>
            <button (click)="cancelEdit()" class="btn-secondary text-xs">{{ 'common.cancel' | transloco }}</button>
          </div>
        </div>
      }
    </div>
  `,
})
export class WorkflowScheduleCardComponent implements OnInit {
  readonly workflowId = input.required<string>();
  private svc = inject(WorkflowsService);
  private transloco = inject(TranslocoService);

  readonly presets = PRESETS;

  schedule = signal<WorkflowSchedule | null>(null);
  editing = signal(false);
  saving = signal(false);
  error = signal<string | null>(null);

  running = signal(false);
  runResult = signal<{
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
        this.error.set('workflows.schedule.errors.invalidJson');
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
        },
        error: (err) => {
          this.saving.set(false);
          this.error.set(err?.error?.message ?? 'workflows.schedule.errors.saveFailed');
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
        next: (updated) => this.schedule.set(updated),
      });
  }

  remove(): void {
    const msg = this.transloco.translate('workflows.schedule.confirmDelete');
    if (!confirm(msg)) return;
    this.svc.deleteSchedule(this.workflowId()).subscribe({
      next: () => this.schedule.set(null),
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
        void s;
        this.load();
      },
      error: (err) => {
        this.running.set(false);
        this.runResult.set({
          triggered: false,
          error: err?.error?.message ?? 'workflows.schedule.errors.runFailed',
        });
      },
    });
  }
}