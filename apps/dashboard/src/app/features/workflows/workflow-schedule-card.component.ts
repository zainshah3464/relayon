import { Component, inject, input, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  WorkflowsService,
  WorkflowSchedule,
} from '../../core/api/workflows.service';

interface Preset {
  label: string;
  cron: string;
}

const PRESETS: Preset[] = [
  { label: 'Every 15 minutes', cron: '*/15 * * * *' },
  { label: 'Hourly', cron: '0 * * * *' },
  { label: 'Daily at 09:00', cron: '0 9 * * *' },
  { label: 'Weekdays at 09:00', cron: '0 9 * * 1-5' },
  { label: 'Weekly (Monday 09:00)', cron: '0 9 * * 1' },
];

@Component({
  selector: 'app-workflow-schedule-card',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="card">
      <div class="flex justify-between items-start mb-3">
        <div>
          <h2 class="text-sm font-medium text-white">Scheduled trigger</h2>
          <p class="text-xs text-muted mt-1">
            Relayon generates an event on this cron. It flows through enrichment, transform, and routing like any webhook.
          </p>
        </div>
        @if (schedule(); as s) {
          <span
            class="text-xs px-2 py-0.5 rounded"
            [class.bg-signal-green/20]="s.isActive"
            [class.text-signal-green]="s.isActive"
            [class.bg-surface-2]="!s.isActive"
            [class.text-muted]="!s.isActive"
          >{{ s.isActive ? 'Active' : 'Paused' }}</span>
        }
      </div>

      @if (error()) {
        <div class="text-sm text-signal-rose mb-3">{{ error() }}</div>
      }

      @if (!editing()) {
        @if (schedule(); as s) {
          <div class="grid grid-cols-3 gap-4 mb-3">
            <div>
              <p class="text-xs uppercase text-muted">Cron</p>
              <p class="text-sm text-white font-mono mt-1">{{ s.cronExpression }}</p>
            </div>
            <div>
              <p class="text-xs uppercase text-muted">Timezone</p>
              <p class="text-sm text-white mt-1">{{ s.timezone }}</p>
            </div>
            <div>
              <p class="text-xs uppercase text-muted">Next run</p>
              <p class="text-sm text-white mt-1">{{ s.nextRunAt | date: 'medium' }}</p>
            </div>
          </div>
          <div class="flex gap-2">
            <button (click)="startEdit(s)" class="btn-secondary text-xs">Edit</button>
            <button (click)="toggleActive(s)" class="btn-secondary text-xs">
              {{ s.isActive ? 'Pause' : 'Resume' }}
            </button>
            <button (click)="remove()" class="btn-secondary text-xs text-signal-rose">Delete</button>
          </div>
        } @else {
          <button (click)="startCreate()" class="btn-primary text-xs">+ Add schedule</button>
        }
      } @else {
        <div class="space-y-3">
          <div>
            <label class="label">Preset</label>
            <select (change)="applyPreset($event)" class="input">
              <option value="">Custom…</option>
              @for (p of presets; track p.cron) {
                <option [value]="p.cron">{{ p.label }} — {{ p.cron }}</option>
              }
            </select>
          </div>
          <div>
            <label class="label">Cron expression</label>
            <input [(ngModel)]="cronExpression" class="input font-mono" placeholder="0 9 * * *" />
          </div>
          <div>
            <label class="label">Timezone</label>
            <input [(ngModel)]="timezone" class="input" placeholder="UTC" />
          </div>
          <div>
            <label class="label">Payload template (JSON)</label>
            <textarea
              [(ngModel)]="payloadTemplate"
              rows="3"
              class="input font-mono text-xs"
              placeholder='&#123; "report": "daily" &#125;'
            ></textarea>
          </div>
          <div class="flex gap-2">
            <button (click)="save()" [disabled]="saving()" class="btn-primary text-xs">
              {{ saving() ? 'Saving...' : 'Save schedule' }}
            </button>
            <button (click)="cancelEdit()" class="btn-secondary text-xs">Cancel</button>
          </div>
        </div>
      }
    </div>
  `,
})
export class WorkflowScheduleCardComponent implements OnInit {
  readonly workflowId = input.required<string>();
  private svc = inject(WorkflowsService);

  readonly presets = PRESETS;

  schedule = signal<WorkflowSchedule | null>(null);
  editing = signal(false);
  saving = signal(false);
  error = signal<string | null>(null);

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
        this.error.set('Payload template is not valid JSON');
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
          this.error.set(err?.error?.message ?? 'Failed to save schedule');
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
    if (!confirm('Delete this schedule? Events will stop being generated.')) return;
    this.svc.deleteSchedule(this.workflowId()).subscribe({
      next: () => this.schedule.set(null),
    });
  }
}