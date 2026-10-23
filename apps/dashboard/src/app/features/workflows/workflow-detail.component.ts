import { Component, inject, signal, OnInit, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  WorkflowsService,
  Workflow,
  Destination,
  DestinationType,
} from '../../core/api/workflows.service';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-workflow-detail',
  standalone: true,
  imports: [CommonModule, RouterLink, ReactiveFormsModule],
  template: `
    <div class="space-y-6">
      <div class="flex items-center justify-between">
        <div>
          <a routerLink="/workflows" class="text-xs text-muted hover:text-white">← All workflows</a>
          <h1 class="text-2xl font-bold tracking-tightest text-white mt-1">
            {{ workflow()?.name ?? 'Loading...' }}
          </h1>
          @if (workflow(); as wf) {
            <p class="text-xs text-muted font-mono mt-1">{{ wf.sourceType }} · ID {{ wf.id.slice(0, 8) }}</p>
          }
        </div>
        <div class="flex gap-2">
          <button (click)="copyWebhookUrl()" class="btn-secondary">{{ copied() ? 'Copied!' : 'Copy webhook URL' }}</button>
          <button (click)="exportYaml()" [disabled]="exporting()" class="btn-secondary">
            {{ exporting() ? 'Exporting...' : 'Export YAML' }}
          </button>
        </div>
      </div>

      @if (error()) {
        <div class="card text-sm text-signal-rose">{{ error() }}</div>
      }

      @if (workflow(); as wf) {
        <div class="card">
          <h2 class="text-sm font-medium text-white mb-2">Webhook URL</h2>
          <code class="block text-xs font-mono text-relay-cyan bg-surface-2 p-3 rounded overflow-x-auto">
            {{ ingressUrl }}/webhook/{{ wf.tenantId }}/{{ wf.id }}
          </code>
        </div>

        <div class="card grid grid-cols-3 gap-4">
          <div>
            <p class="text-xs text-muted uppercase tracking-wider">AI Enrichment</p>
            <p class="text-sm text-white mt-1">{{ wf.enrichmentEnabled ? 'Enabled' : 'Disabled' }}</p>
          </div>
          <div>
            <p class="text-xs text-muted uppercase tracking-wider">Status</p>
            <p class="text-sm text-white mt-1">{{ wf.isActive ? 'Active' : 'Inactive' }}</p>
          </div>
          <div>
            <p class="text-xs text-muted uppercase tracking-wider">Transform</p>
            <p class="text-sm text-white mt-1 truncate">{{ wf.transformExpression ? 'Custom JSONata' : 'None' }}</p>
          </div>
        </div>

        <div>
          <div class="flex items-center justify-between mb-3">
            <h2 class="text-lg font-semibold text-white">Destinations</h2>
            <button (click)="openCreateDest()" class="btn-primary">+ Add destination</button>
          </div>

          @if (destinations().length === 0) {
            <div class="card text-center py-8">
              <p class="text-sm text-muted">No destinations yet.</p>
            </div>
          } @else {
            <div class="space-y-2">
              @for (d of destinations(); track d.id) {
                <div class="card flex items-center justify-between">
                  <div>
                    <div class="flex items-center gap-2">
                      <span class="text-white font-medium">{{ d.name }}</span>
                      <span class="text-xs px-2 py-0.5 rounded bg-surface-2 text-relay-cyan font-mono">{{ d.type }}</span>
                      @if (!d.enabled) {
                        <span class="text-xs px-2 py-0.5 rounded bg-signal-rose/20 text-signal-rose">Disabled</span>
                      }
                    </div>
                    <p class="text-xs text-muted font-mono mt-1">{{ destinationSummary(d) }}</p>
                  </div>
                  <div class="flex gap-2">
                    <button (click)="toggleDestination(d)" class="text-xs text-muted hover:text-white">
                      {{ d.enabled ? 'Disable' : 'Enable' }}
                    </button>
                    <button (click)="deleteDestination(d)" class="text-xs text-signal-rose hover:underline">Delete</button>
                  </div>
                </div>
              }
            </div>
          }
        </div>
      }

      @if (showCreateDest()) {
        <div class="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" (click)="closeCreateDest()">
          <div class="card w-full max-w-lg" (click)="$event.stopPropagation()">
            <h2 class="text-lg font-semibold text-white mb-4">Add destination</h2>
            <form [formGroup]="destForm" (ngSubmit)="submitDest()" class="space-y-4">
              <div>
                <label class="label">Type</label>
                <select formControlName="type" class="input">
                  <option value="http">HTTP webhook</option>
                  <option value="slack">Slack</option>
                  <option value="email">Email (Resend)</option>
                  <option value="sheets">Google Sheets</option>
                </select>
              </div>
              <div>
                <label class="label">Name</label>
                <input formControlName="name" class="input" placeholder="Production alerts" />
              </div>
              @switch (destForm.controls.type.value) {
                @case ('http') {
                  <div>
                    <label class="label">URL</label>
                    <input formControlName="url" class="input font-mono" placeholder="https://api.example.com/webhook" />
                  </div>
                }
                @case ('slack') {
                  <div>
                    <label class="label">Slack webhook URL</label>
                    <input formControlName="webhookUrl" class="input font-mono" placeholder="https://hooks.slack.com/services/..." />
                  </div>
                }
                @case ('email') {
                  <div>
                    <label class="label">Resend API key</label>
                    <input formControlName="apiKey" class="input font-mono" placeholder="re_..." />
                  </div>
                  <div>
                    <label class="label">To (comma-separated)</label>
                    <input formControlName="to" class="input" placeholder="you@example.com" />
                  </div>
                  <div>
                    <label class="label">From</label>
                    <input formControlName="from" class="input" />
                  </div>
                }
                @case ('sheets') {
                  <div>
                    <label class="label">Spreadsheet ID</label>
                    <input formControlName="spreadsheetId" class="input font-mono" />
                  </div>
                  <div>
                    <label class="label">Range</label>
                    <input formControlName="range" class="input" placeholder="Sheet1!A:Z" />
                  </div>
                  <div>
                    <label class="label">Service account email</label>
                    <input formControlName="serviceAccountEmail" class="input font-mono" />
                  </div>
                  <div>
                    <label class="label">Private key (PEM)</label>
                    <textarea formControlName="privateKey" rows="4" class="input font-mono text-xs"></textarea>
                  </div>
                }
              }
              @if (destError()) {
                <div class="text-sm text-signal-rose">{{ destError() }}</div>
              }
              <div class="flex justify-end gap-2 pt-2">
                <button type="button" (click)="closeCreateDest()" class="btn-secondary">Cancel</button>
                <button type="submit" [disabled]="destForm.invalid || savingDest()" class="btn-primary">
                  {{ savingDest() ? 'Adding...' : 'Add' }}
                </button>
              </div>
            </form>
          </div>
        </div>
      }
    </div>
  `,
})
export class WorkflowDetailComponent implements OnInit {
  readonly id = input.required<string>();
  private svc = inject(WorkflowsService);
  private fb = inject(FormBuilder);

  readonly ingressUrl = environment.ingressUrl;

  workflow = signal<Workflow | null>(null);
  destinations = signal<Destination[]>([]);
  error = signal<string | null>(null);
  copied = signal(false);
  exporting = signal(false);

  showCreateDest = signal(false);
  savingDest = signal(false);
  destError = signal<string | null>(null);

  destForm = this.fb.nonNullable.group({
    type: ['http' as DestinationType, Validators.required],
    name: ['', [Validators.required, Validators.minLength(2)]],
    url: [''],
    webhookUrl: [''],
    apiKey: [''],
    to: [''],
    from: [''],
    spreadsheetId: [''],
    range: [''],
    serviceAccountEmail: [''],
    privateKey: [''],
  });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.svc.get(this.id()).subscribe({
      next: (wf) => {
        this.workflow.set(wf);
        this.loadDestinations();
      },
      error: (err) => this.error.set(err?.error?.message ?? 'Failed to load workflow'),
    });
  }

  loadDestinations(): void {
    this.svc.listDestinations(this.id()).subscribe({
      next: (d) => this.destinations.set(d),
      error: (err) => this.error.set(err?.error?.message ?? 'Failed to load destinations'),
    });
  }

  copyWebhookUrl(): void {
    const wf = this.workflow();
    if (!wf) return;
    const url = `${environment.ingressUrl}/webhook/${wf.tenantId}/${wf.id}`;
    navigator.clipboard.writeText(url).then(() => {
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 1500);
    });
  }

  exportYaml(): void {
    const wf = this.workflow();
    if (!wf) return;
    this.exporting.set(true);
    this.svc.exportYaml(wf.id).subscribe({
      next: (yaml) => {
        const blob = new Blob([yaml], { type: 'application/x-yaml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `workflow-${wf.id.slice(0, 8)}.yaml`;
        a.click();
        URL.revokeObjectURL(url);
        this.exporting.set(false);
      },
      error: (err) => {
        this.error.set(err?.error?.message ?? 'Export failed');
        this.exporting.set(false);
      },
    });
  }

  destinationSummary(d: Destination): string {
    const cfg = d.config as Record<string, unknown>;
    if (typeof cfg['url'] === 'string') return cfg['url'] as string;
    if (typeof cfg['webhookUrl'] === 'string') return 'Slack webhook';
    if (typeof cfg['to'] === 'string') return cfg['to'] as string;
    if (typeof cfg['spreadsheetId'] === 'string') return `Sheets: ${cfg['spreadsheetId']}`;
    return '—';
  }

  openCreateDest(): void {
    this.destForm.reset();
    this.destError.set(null);
    this.showCreateDest.set(true);
  }

  closeCreateDest(): void {
    if (!this.savingDest()) this.showCreateDest.set(false);
  }

  submitDest(): void {
    if (this.destForm.invalid || this.savingDest()) return;
    const v = this.destForm.getRawValue();

    let config: Record<string, unknown> = {};
    switch (v.type) {
      case 'http':
        config = { url: v.url, method: 'POST' };
        break;
      case 'slack':
        config = { webhookUrl: v.webhookUrl };
        break;
      case 'email':
        config = {
          apiKey: v.apiKey,
          to: v.to.split(',').map((s) => s.trim()).filter(Boolean),
          from: v.from,
        };
        break;
      case 'sheets':
        config = {
          spreadsheetId: v.spreadsheetId,
          range: v.range,
          serviceAccountEmail: v.serviceAccountEmail,
          privateKey: v.privateKey,
        };
        break;
    }

    this.savingDest.set(true);
    this.destError.set(null);

    this.svc
      .createDestination(this.id(), { type: v.type, name: v.name, config })
      .subscribe({
        next: () => {
          this.savingDest.set(false);
          this.showCreateDest.set(false);
          this.loadDestinations();
        },
        error: (err) => {
          this.savingDest.set(false);
          this.destError.set(err?.error?.message ?? 'Failed to add destination');
        },
      });
  }

  toggleDestination(d: Destination): void {
    this.svc.updateDestination(d.id, { enabled: !d.enabled }).subscribe({
      next: () => this.loadDestinations(),
    });
  }

  deleteDestination(d: Destination): void {
    if (!confirm(`Delete destination "${d.name}"?`)) return;
    this.svc.removeDestination(d.id).subscribe({
      next: () => this.loadDestinations(),
    });
  }
}