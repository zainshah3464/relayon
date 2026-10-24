import { Component, inject, signal, OnInit, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators, FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import {
  WorkflowsService,
  Workflow,
  Destination,
  DestinationType,
} from '../../core/api/workflows.service';
import { environment } from '../../../environments/environment';
import { WorkflowScheduleCardComponent } from './workflow-schedule-card.component';
import { WorkflowVersionsDrawerComponent } from './workflow-versions-drawer.component';

@Component({
  selector: 'app-workflow-detail',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    ReactiveFormsModule,
    FormsModule,
    WorkflowScheduleCardComponent,
    WorkflowVersionsDrawerComponent,
  ],
  template: `
    <div class="space-y-6">
      <!-- Header -->
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
          <button (click)="copyWebhookUrl()" class="btn-secondary">
            {{ copied() ? 'Copied!' : 'Copy webhook URL' }}
          </button>
          <button (click)="exportYaml()" [disabled]="exporting()" class="btn-secondary">
            {{ exporting() ? 'Exporting...' : 'Export YAML' }}
          </button>
          <button (click)="showVersions.set(true)" class="btn-secondary">
            Version history
          </button>
        </div>
      </div>

      @if (error()) {
        <div class="card text-sm text-signal-rose">{{ error() }}</div>
      }

      @if (workflow(); as wf) {
        <!-- Webhook URL -->
        <div class="card">
          <h2 class="text-sm font-medium text-white mb-2">Webhook URL</h2>
          <code class="block text-xs font-mono text-relay-cyan bg-surface-2 p-3 rounded overflow-x-auto">
            {{ ingressUrl }}/webhook/{{ wf.tenantId }}/{{ wf.id }}
          </code>
        </div>

        <!-- v1.3: Schedule Card -->
        <app-workflow-schedule-card [workflowId]="wf.id" />

        <!-- Transform editor -->
        <div class="card">
          <div class="flex justify-between items-center mb-3">
            <h2 class="text-sm font-medium text-white">Transform expression (JSONata)</h2>
            <button (click)="toggleTransform()" class="text-xs text-relay-cyan hover:underline">
              {{ showTransform() ? 'Hide' : 'Edit' }}
            </button>
          </div>

          @if (showTransform()) {
            <textarea
              [(ngModel)]="transformExpr"
              rows="4"
              class="input font-mono text-xs"
              placeholder="&#123; 'event_type': type, 'amount': data.amount / 100 &#125;"
            ></textarea>
            <div class="flex gap-2 mt-2">
              <button (click)="previewTransform()" [disabled]="previewing()" class="btn-secondary text-xs">
                {{ previewing() ? 'Testing...' : 'Test with sample payload' }}
              </button>
              <button (click)="saveTransform()" [disabled]="savingTransform()" class="btn-primary text-xs">
                {{ savingTransform() ? 'Saving...' : 'Save expression' }}
              </button>
            </div>

            @if (previewResult(); as r) {
              <div class="mt-3">
                @if (r.ok) {
                  <p class="text-xs text-signal-green mb-1">✓ Valid · {{ r.durationMs }}ms</p>
                  <pre class="bg-surface-2 p-3 rounded text-xs overflow-x-auto text-relay-cyan">{{ r.result | json }}</pre>
                } @else {
                  <p class="text-xs text-signal-rose">✗ {{ r.error }}</p>
                }
              </div>
            }
          } @else {
            <code class="text-xs text-muted font-mono">{{ workflow()?.transformExpression || 'No transform configured' }}</code>
          }
        </div>

        <!-- Config summary -->
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

        <!-- Destinations -->
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

        <!-- v1.3: Version Drawer -->
        @if (showVersions()) {
          <app-workflow-versions-drawer
            [workflowId]="id()"
            (close)="showVersions.set(false)"
            (restored)="onVersionRestored()"
          />
        }
      }

      <!-- Create destination modal -->
      @if (showCreateDest()) {
        <div class="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" (click)="closeCreateDest()">
          <div class="card w-full max-w-lg max-h-[90vh] overflow-y-auto" (click)="$event.stopPropagation()">
            <h2 class="text-lg font-semibold text-white mb-4">Add destination</h2>
            <form [formGroup]="destForm" (ngSubmit)="submitDest()" class="space-y-4">
              <div>
                <label class="label">Type</label>
                <select formControlName="type" class="input">
                  <option value="http">HTTP webhook</option>
                  <option value="slack">Slack</option>
                  <option value="email">Email (Resend)</option>
                  <option value="sheets">Google Sheets</option>
                  <option value="discord">Discord</option>
                  <option value="airtable">Airtable</option>
                  <option value="notion">Notion</option>
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
                @case ('discord') {
                  <div>
                    <label class="label">Discord webhook URL</label>
                    <input formControlName="webhookUrl" class="input font-mono" placeholder="https://discord.com/api/webhooks/..." />
                  </div>
                }
                @case ('airtable') {
                  <div>
                    <label class="label">Personal access token</label>
                    <input formControlName="apiKey" class="input font-mono" placeholder="pat..." />
                  </div>
                  <div>
                    <label class="label">Base ID</label>
                    <input formControlName="baseId" class="input font-mono" placeholder="appXXXXXXXXXXXXXX" />
                  </div>
                  <div>
                    <label class="label">Table name</label>
                    <input formControlName="tableName" class="input" placeholder="Leads" />
                  </div>
                }
                @case ('notion') {
                  <div>
                    <label class="label">Integration token</label>
                    <input formControlName="apiKey" class="input font-mono" placeholder="secret_..." />
                  </div>
                  <div>
                    <label class="label">Data source ID</label>
                    <input formControlName="dataSourceId" class="input font-mono" />
                  </div>
                  <div>
                    <label class="label">Title property name</label>
                    <input formControlName="titleProperty" class="input" placeholder="Name" />
                  </div>
                  <p class="text-xs text-muted">Share the database with your Notion integration, otherwise the API returns 404.</p>
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
  private http = inject(HttpClient);

  readonly ingressUrl = environment.ingressUrl;

  workflow = signal<Workflow | null>(null);
  destinations = signal<Destination[]>([]);
  error = signal<string | null>(null);
  copied = signal(false);
  exporting = signal(false);

  showVersions = signal(false);

  showTransform = signal(false);
  transformExpr = '';
  previewing = signal(false);
  savingTransform = signal(false);
  previewResult = signal<{
    ok: boolean;
    result: unknown;
    error: string | null;
    durationMs: number;
  } | null>(null);

  showCreateDest = signal(false);
  savingDest = signal(false);
  destError = signal<string | null>(null);

  private readonly samplePayload = {
    type: 'checkout.session.completed',
    data: {
      amount: 5000,
      currency: 'usd',
      customer: { email: 'test@example.com' },
    },
  };

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
    baseId: [''],
    tableName: [''],
    dataSourceId: [''],
    titleProperty: [''],
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

  toggleTransform(): void {
    const wf = this.workflow();
    if (!this.showTransform() && wf) {
      this.transformExpr = wf.transformExpression ?? '';
      this.previewResult.set(null);
    }
    this.showTransform.set(!this.showTransform());
  }

  previewTransform(): void {
    const wf = this.workflow();
    if (!wf) return;
    this.previewing.set(true);
    this.previewResult.set(null);

    this.http
      .post<{
        ok: boolean;
        result: unknown;
        error: string | null;
        durationMs: number;
      }>(`${environment.apiUrl}/api/workflows/${wf.id}/preview-transform`, {
        expression: this.transformExpr,
        samplePayload: this.samplePayload,
      })
      .subscribe({
        next: (r) => {
          this.previewResult.set(r);
          this.previewing.set(false);
        },
        error: (err) => {
          this.previewResult.set({
            ok: false,
            result: null,
            error: err?.error?.message ?? 'Preview failed',
            durationMs: 0,
          });
          this.previewing.set(false);
        },
      });
  }

  saveTransform(): void {
    const wf = this.workflow();
    if (!wf) return;
    this.savingTransform.set(true);

    this.svc.update(wf.id, { transformExpression: this.transformExpr }).subscribe({
      next: (updated) => {
        this.workflow.set(updated);
        this.savingTransform.set(false);
        this.showTransform.set(false);
      },
      error: () => this.savingTransform.set(false),
    });
  }

  destinationSummary(d: Destination): string {
    const cfg = d.config as Record<string, unknown>;
    if (typeof cfg['url'] === 'string') return cfg['url'] as string;
    if (typeof cfg['webhookUrl'] === 'string')
      return (cfg['webhookUrl'] as string).startsWith('enc:v1:')
        ? '•••••••• (encrypted)'
        : 'Slack/Discord webhook';
    if (typeof cfg['to'] === 'string') return cfg['to'] as string;
    if (Array.isArray(cfg['to'])) return (cfg['to'] as string[]).join(', ');
    if (typeof cfg['spreadsheetId'] === 'string') return `Sheets: ${cfg['spreadsheetId']}`;
    if (typeof cfg['baseId'] === 'string') return `Airtable: ${cfg['baseId']}`;
    if (typeof cfg['dataSourceId'] === 'string') return `Notion: ${cfg['dataSourceId']}`;
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
      case 'discord':
        config = { webhookUrl: v.webhookUrl };
        break;
      case 'airtable':
        config = {
          apiKey: v.apiKey,
          baseId: v.baseId,
          tableName: v.tableName,
        };
        break;
      case 'notion':
        config = {
          apiKey: v.apiKey,
          dataSourceId: v.dataSourceId,
          titleProperty: v.titleProperty,
        };
        break;
    }

    this.savingDest.set(true);
    this.destError.set(null);

    this.svc.createDestination(this.id(), { type: v.type, name: v.name, config }).subscribe({
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

  onVersionRestored(): void {
    this.showVersions.set(false);
    this.load();
  }
}