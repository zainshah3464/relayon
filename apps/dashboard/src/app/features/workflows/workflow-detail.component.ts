import { Component, inject, signal, OnInit, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators, FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import {
  WorkflowsService,
  Workflow,
  Destination,
  DestinationType,
} from '../../core/api/workflows.service';
import { environment } from '../../../environments/environment';
import { WorkflowScheduleCardComponent } from './workflow-schedule-card.component';
import { WorkflowVersionsDrawerComponent } from './workflow-versions-drawer.component';
import { SchemaFormComponent } from '../../shared/forms/schema-form.component';
import {
  buildSchemaForm,
  readSchemaForm,
  type SchemaField,
} from '../../shared/forms/schema-form.types';
import type { AdapterCatalogEntry } from '../../core/api/workflows.service';

@Component({
  selector: 'app-workflow-detail',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    ReactiveFormsModule,
    FormsModule,
    TranslocoModule,
    WorkflowScheduleCardComponent,
    WorkflowVersionsDrawerComponent,
    SchemaFormComponent,
  ],
  template: `
    <div class="space-y-6">
      <!-- Header -->
      <div class="flex items-center justify-between">
        <div>
          <a routerLink="/workflows" class="text-xs text-muted hover:text-white">{{ 'workflows.detail.allWorkflows' | transloco }}</a>
          <h1 class="text-2xl font-bold tracking-tightest text-white mt-1">
            {{ workflow()?.name ?? ('common.loading' | transloco) }}
          </h1>
          @if (workflow(); as wf) {
            <p class="text-xs text-muted font-mono mt-1">{{ wf.sourceType }} · {{ 'workflows.detail.id' | transloco }} {{ wf.id.slice(0, 8) }}</p>
          }
        </div>
        <div class="flex gap-2">
          <button (click)="copyWebhookUrl()" class="btn-secondary">
            {{ (copied() ? 'workflows.detail.copied' : 'workflows.detail.copyWebhookUrl') | transloco }}
          </button>
          <button (click)="exportYaml()" [disabled]="exporting()" class="btn-secondary">
            {{ (exporting() ? 'workflows.detail.exporting' : 'workflows.detail.exportYaml') | transloco }}
          </button>
          <button (click)="openTestRun()" class="btn-primary text-xs">{{ 'workflows.detail.testRun' | transloco }}</button>
          <button (click)="showVersions.set(true)" class="btn-secondary">
            {{ 'workflows.detail.versionHistory' | transloco }}
          </button>
        </div>
      </div>

      @if (error()) {
        <div class="card text-sm text-signal-rose">{{ error() | transloco }}</div>
      }

      @if (workflow(); as wf) {
        <!-- Webhook URL -->
        <div class="card">
          <h2 class="text-sm font-medium text-white mb-2">{{ 'workflows.detail.webhookUrl' | transloco }}</h2>
          <code class="block text-xs font-mono text-relay-cyan bg-surface-2 p-3 rounded overflow-x-auto">
            {{ ingressUrl }}/webhook/{{ wf.tenantId }}/{{ wf.id }}
          </code>
        </div>

        <!-- Schedule Card -->
        <app-workflow-schedule-card [workflowId]="wf.id" />

        <!-- Transform editor -->
        <div class="card">
          <div class="flex justify-between items-center mb-3">
            <h2 class="text-sm font-medium text-white">{{ 'workflows.detail.transformExpression' | transloco }}</h2>
            <button (click)="toggleTransform()" class="text-xs text-relay-cyan hover:underline">
              {{ (showTransform() ? 'common.hide' : 'common.edit') | transloco }}
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
                {{ (previewing() ? 'workflows.detail.testing' : 'workflows.detail.testWithSample') | transloco }}
              </button>
              <button (click)="saveTransform()" [disabled]="savingTransform()" class="btn-primary text-xs">
                {{ (savingTransform() ? 'common.saving' : 'workflows.detail.saveExpression') | transloco }}
              </button>
            </div>

            @if (previewResult(); as r) {
              <div class="mt-3">
                @if (r.ok) {
                  <p class="text-xs text-signal-green mb-1">✓ {{ 'workflows.detail.valid' | transloco }} · {{ r.durationMs }}ms</p>
                  <pre class="bg-surface-2 p-3 rounded text-xs overflow-x-auto text-relay-cyan">{{ r.result | json }}</pre>
                } @else {
                  <p class="text-xs text-signal-rose">✗ {{ r.error | transloco }}</p>
                }
              </div>
            }
          } @else {
            <code class="text-xs text-muted font-mono">{{ workflow()?.transformExpression || ('workflows.detail.noTransform' | transloco) }}</code>
          }
        </div>

        <!-- Config summary -->
        <div class="card grid grid-cols-3 gap-4">
          <div>
            <p class="text-xs text-muted uppercase tracking-wider">{{ 'workflows.detail.aiEnrichment' | transloco }}</p>
            <p class="text-sm text-white mt-1">{{ (wf.enrichmentEnabled ? 'common.enabled' : 'common.disabled') | transloco }}</p>
          </div>
          <div>
            <p class="text-xs text-muted uppercase tracking-wider">{{ 'workflows.detail.status' | transloco }}</p>
            <p class="text-sm text-white mt-1">{{ (wf.isActive ? 'common.active' : 'common.inactive') | transloco }}</p>
          </div>
          <div>
            <p class="text-xs text-muted uppercase tracking-wider">{{ 'workflows.detail.transform' | transloco }}</p>
            <p class="text-sm text-white mt-1 truncate">{{ (wf.transformExpression ? 'workflows.detail.customJsonata' : 'common.none') | transloco }}</p>
          </div>
        </div>

        <!-- Destinations -->
        <div>
          <div class="flex items-center justify-between mb-3">
            <h2 class="text-lg font-semibold text-white">{{ 'workflows.detail.destinations' | transloco }}</h2>
            <button (click)="openCreateDest()" class="btn-primary">{{ 'workflows.detail.addDestination' | transloco }}</button>
          </div>

          @if (destinations().length === 0) {
            <div class="card text-center py-8">
              <p class="text-sm text-muted">{{ 'workflows.detail.noDestinations' | transloco }}</p>
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
                        <span class="text-xs px-2 py-0.5 rounded bg-signal-rose/20 text-signal-rose">{{ 'common.disabled' | transloco }}</span>
                      }
                      @if (d.lastValidationOk === true) {
                        <span class="text-xs px-2 py-0.5 rounded bg-signal-green/20 text-signal-green" [title]="('workflows.detail.lastValidated' | transloco) + ': ' + (d.lastValidatedAt | date: 'short')">
                          ✓ {{ 'workflows.detail.verified' | transloco }}
                        </span>
                      } @else if (d.lastValidationOk === false) {
                        <span class="text-xs px-2 py-0.5 rounded bg-signal-rose/20 text-signal-rose" [title]="d.lastValidationError || ('workflows.detail.validationFailed' | transloco)">
                          ✗ {{ 'workflows.detail.failed' | transloco }}
                        </span>
                      }
                    </div>
                    <p class="text-xs text-muted font-mono mt-1">{{ destinationSummary(d) }}</p>
                  </div>
                  <div class="flex gap-2">
                    <button (click)="toggleDestination(d)" class="text-xs text-muted hover:text-white">
                      {{ (d.enabled ? 'common.disable' : 'common.enable') | transloco }}
                    </button>
                    <button (click)="deleteDestination(d)" class="text-xs text-signal-rose hover:underline">{{ 'common.delete' | transloco }}</button>
                  </div>
                </div>
              }
            </div>
          }
        </div>

        <!-- Version Drawer -->
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
            <h2 class="text-lg font-semibold text-white mb-4">{{ 'workflows.detail.createDestinationTitle' | transloco }}</h2>
            <form [formGroup]="destMetaForm" (ngSubmit)="submitDest()" class="space-y-4">
              <div>
                <label class="label">{{ 'common.type' | transloco }}</label>
                <select
                  formControlName="type"
                  (change)="onAdapterTypeChange(destMetaForm.controls.type.value)"
                  class="input"
                >
                  @for (a of adapterCatalog(); track a.type) {
                    <option [value]="a.type">{{ a.displayName }}</option>
                  }
                </select>
              </div>
              <div>
                <label class="label">{{ 'common.name' | transloco }}</label>
                <input formControlName="name" class="input" [placeholder]="'workflows.detail.namePlaceholder' | transloco" />
              </div>

              <div [formGroup]="configForm">
                <app-schema-form [fields]="configFields()" [form]="configForm" />
              </div>

              @if (destError()) {
                <div class="text-sm text-signal-rose">{{ destError() | transloco }}</div>
              }

              <div class="flex justify-between gap-2 pt-2">
                <button
                  type="button"
                  (click)="validateDest()"
                  [disabled]="validating() || destMetaForm.invalid"
                  class="btn-secondary"
                >
                  {{ (validating() ? 'workflows.detail.testing' : 'workflows.detail.testConnection') | transloco }}
                </button>
                <div class="flex gap-2">
                  <button type="button" (click)="closeCreateDest()" class="btn-secondary">{{ 'common.cancel' | transloco }}</button>
                  <button type="submit" [disabled]="destMetaForm.invalid || configForm.invalid || savingDest()" class="btn-primary">
                    {{ (savingDest() ? 'common.adding' : 'common.add') | transloco }}
                  </button>
                </div>
              </div>

              @if (validationResult(); as r) {
                <div
                  class="rounded-lg border p-3 text-xs mt-2"
                  [ngClass]="{
                    'border-signal-green/30': r.ok,
                    'bg-signal-green/5': r.ok,
                    'border-signal-rose/30': !r.ok,
                    'bg-signal-rose/5': !r.ok
                  }"
                >
                  <p [ngClass]="r.ok ? 'text-signal-green' : 'text-signal-rose'" class="font-medium">
                    {{ (r.ok ? 'workflows.detail.connectionVerified' : 'workflows.detail.validationFailedTitle') | transloco }}
                  </p>
                  @if (r.dryRun) {
                    <p class="text-muted mt-1">{{ r.dryRun.detail }} · {{ r.dryRun.latencyMs }}ms</p>
                  }
                  @for (e of r.errors; track $index) {
                    <p class="text-signal-rose mt-1">{{ e.field }}: {{ e.message }}</p>
                  }
                  @for (w of r.warnings; track $index) {
                    <p class="text-signal-amber mt-1">⚠ {{ w }}</p>
                  }
                </div>
              }
            </form>
          </div>
        </div>
      }

      <!-- Test run modal -->
      @if (showTestRun()) {
        <div class="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" (click)="closeTestRun()">
          <div class="card w-full max-w-3xl max-h-[90vh] overflow-y-auto" (click)="$event.stopPropagation()">
            <div class="flex justify-between items-center mb-4">
              <div>
                <h2 class="text-lg font-semibold text-white">{{ 'workflows.detail.testRunPipeline' | transloco }}</h2>
                <p class="text-xs text-muted mt-1">{{ 'workflows.detail.testRunHint' | transloco }}</p>
              </div>
              <button (click)="closeTestRun()" class="text-muted hover:text-white">✕</button>
            </div>

            <label class="label">{{ 'workflows.detail.samplePayload' | transloco }}</label>
            <textarea
              [value]="testRunPayload()"
              (input)="testRunPayload.set($any($event.target).value)"
              rows="8"
              class="input font-mono text-xs"
            ></textarea>

            <label class="flex items-center gap-2 text-sm text-white mt-3">
              <input
                type="checkbox"
                [checked]="dryRunDestinations()"
                (change)="dryRunDestinations.set($any($event.target).checked)"
                class="rounded border-hairline"
              />
              <span>{{ 'workflows.detail.alsoDryRun' | transloco }}</span>
            </label>

            <div class="flex justify-end gap-2 mt-3">
              <button (click)="closeTestRun()" class="btn-secondary">{{ 'common.close' | transloco }}</button>
              <button (click)="runTestRun()" [disabled]="testRunLoading()" class="btn-primary">
                {{ (testRunLoading() ? 'workflows.detail.running' : 'workflows.detail.runPipeline') | transloco }}
              </button>
            </div>

            @if (testRunError()) {
              <div class="text-sm text-signal-rose mt-3">{{ testRunError() | transloco }}</div>
            }

            @if (testRunResult(); as r) {
              <div class="mt-6 space-y-4">
                <div class="card bg-surface-2">
                  <div class="flex justify-between items-center mb-2">
                    <h3 class="text-sm font-medium text-white">{{ 'workflows.detail.stepEnrichment' | transloco }}</h3>
                    <span class="text-xs"
                      [class.text-signal-green]="r.enrichment.enabled && !r.enrichment.error"
                      [class.text-muted]="!r.enrichment.enabled"
                      [class.text-signal-rose]="r.enrichment.error">
                      @if (!r.enrichment.enabled) { {{ 'common.disabled' | transloco }} }
                      @else if (r.enrichment.error) { {{ 'workflows.detail.error' | transloco }} · {{ r.enrichment.durationMs }}ms }
                      @else { {{ 'workflows.detail.ok' | transloco }} · {{ r.enrichment.durationMs }}ms @if (r.enrichment.cached) { · {{ 'workflows.detail.cached' | transloco }} } }
                    </span>
                  </div>
                  @if (r.enrichment.error) {
                    <p class="text-xs text-signal-rose">{{ r.enrichment.error }}</p>
                  } @else if (r.enrichment.result) {
                    <pre class="text-xs bg-midnight p-2 rounded overflow-x-auto text-relay-cyan">{{ r.enrichment.result | json }}</pre>
                  }
                </div>

                <div class="card bg-surface-2">
                  <div class="flex justify-between items-center mb-2">
                    <h3 class="text-sm font-medium text-white">{{ 'workflows.detail.stepTransform' | transloco }}</h3>
                    <span class="text-xs"
                      [class.text-signal-green]="r.transform.applied && !r.transform.error"
                      [class.text-muted]="!r.transform.applied"
                      [class.text-signal-rose]="r.transform.error">
                      @if (!r.transform.applied) { {{ 'workflows.detail.noTransform' | transloco }} }
                      @else if (r.transform.error) { {{ 'workflows.detail.error' | transloco }} · {{ r.transform.durationMs }}ms }
                      @else { {{ 'workflows.detail.applied' | transloco }} · {{ r.transform.durationMs }}ms }
                    </span>
                  </div>
                  @if (r.transform.error) {
                    <p class="text-xs text-signal-rose">{{ r.transform.error }}</p>
                  }
                  <pre class="text-xs bg-midnight p-2 rounded overflow-x-auto text-relay-cyan">{{ r.transform.result | json }}</pre>
                </div>

                <div class="card bg-surface-2">
                  <div class="flex justify-between items-center mb-2">
                    <h3 class="text-sm font-medium text-white">{{ 'workflows.detail.stepRouting' | transloco }}</h3>
                    <span class="text-xs text-muted">{{ r.routing.reason }}</span>
                  </div>
                  @if (r.routing.destinationIds.length === 0) {
                    <p class="text-xs text-signal-amber">{{ 'workflows.detail.noDestinationReceives' | transloco }}</p>
                  } @else {
                    <p class="text-xs text-white mb-2">
                      {{ r.routing.destinationIds.length }} {{ 'workflows.detail.destinationsWouldReceive' | transloco }}
                    </p>
                    <div class="flex gap-1 flex-wrap">
                      @for (d of r.destinations; track d.id) {
                        @if (r.routing.destinationIds.includes(d.id)) {
                          <span class="text-xs px-2 py-0.5 rounded bg-signal-green/20 text-signal-green font-mono">
                            {{ d.name }} ({{ d.type }})
                          </span>
                        }
                      }
                    </div>
                  }
                </div>

                @if (r.dryRuns.length > 0) {
                  <div class="card bg-surface-2">
                    <div class="flex justify-between items-center mb-2">
                      <h3 class="text-sm font-medium text-white">{{ 'workflows.detail.stepDryRuns' | transloco }}</h3>
                      <span class="text-xs text-muted">{{ r.dryRuns.length }} {{ 'workflows.detail.checked' | transloco }}</span>
                    </div>
                    <div class="space-y-1">
                      @for (d of r.dryRuns; track d.destinationId) {
                        <div class="flex justify-between text-xs">
                          <span class="font-mono text-white">{{ d.destinationType }}</span>
                          <span [ngClass]="d.ok ? 'text-signal-green' : 'text-signal-rose'">
                            {{ d.ok ? '✓' : '✗' }}
                            {{ d.statusCode > 0 ? 'HTTP ' + d.statusCode : '' }}
                            · {{ d.latencyMs }}ms
                            @if (d.error) { · {{ d.error }} }
                          </span>
                        </div>
                      }
                    </div>
                  </div>
                }
              </div>
            }
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
  private transloco = inject(TranslocoService);

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

  adapterCatalog = signal<AdapterCatalogEntry[]>([]);
  selectedAdapter = signal<AdapterCatalogEntry | null>(null);
  configFields = signal<SchemaField[]>([]);

  destMetaForm = this.fb.nonNullable.group({
    type: ['http' as DestinationType, Validators.required],
    name: ['', [Validators.required, Validators.minLength(2)]],
  });
  configForm = this.fb.group({});

  showCreateDest = signal(false);
  savingDest = signal(false);
  destError = signal<string | null>(null);

  validating = signal(false);
  validationResult = signal<{
    ok: boolean;
    layer: string;
    errors: Array<{ field: string; message: string }>;
    warnings: string[];
    dryRun: { attempted: boolean; success: boolean; latencyMs: number; detail: string } | null;
  } | null>(null);

  showTestRun = signal(false);
  testRunLoading = signal(false);
  testRunPayload = signal<string>(
    JSON.stringify(
      {
        type: 'checkout.session.completed',
        data: { amount: 5000, currency: 'usd', customer: { email: 'test@example.com' } },
      },
      null,
      2,
    ),
  );
  testRunError = signal<string | null>(null);
  dryRunDestinations = signal(true);
  testRunResult = signal<{
    enrichment: { enabled: boolean; result: unknown; cached: boolean; error: string | null; durationMs: number };
    transform: { applied: boolean; result: unknown; error: string | null; durationMs: number };
    routing: { destinationIds: string[]; matchedRule: number | null; reason: string };
    destinations: Array<{ id: string; name: string; type: string }>;
    dryRuns: Array<{
      destinationId: string;
      destinationType: string;
      ok: boolean;
      statusCode: number;
      latencyMs: number;
      error: string | null;
    }>;
  } | null>(null);

  private readonly samplePayload = {
    type: 'checkout.session.completed',
    data: { amount: 5000, currency: 'usd', customer: { email: 'test@example.com' } },
  };

  ngOnInit(): void {
    this.load();
    this.loadAdapters();
  }

  load(): void {
    this.svc.get(this.id()).subscribe({
      next: (wf) => {
        this.workflow.set(wf);
        this.loadDestinations();
      },
      error: (err) => this.error.set(err?.error?.message ?? 'workflows.detail.errors.loadFailed'),
    });
  }

  loadDestinations(): void {
    this.svc.listDestinations(this.id()).subscribe({
      next: (d) => this.destinations.set(d),
      error: (err) => this.error.set(err?.error?.message ?? 'workflows.detail.errors.loadDestFailed'),
    });
  }

  private loadAdapters(): void {
    this.svc.listAdapters().subscribe({
      next: (res) => {
        this.adapterCatalog.set(res.adapters);
        if (res.adapters.length > 0) {
          this.onAdapterTypeChange(res.adapters[0]!.type);
        }
      },
      error: () => this.adapterCatalog.set([]),
    });
  }

  onAdapterTypeChange(type: string): void {
    const adapter = this.adapterCatalog().find((a) => a.type === type) ?? null;
    this.selectedAdapter.set(adapter);
    const fields = adapter?.fields ?? [];
    this.configFields.set(fields);
    this.configForm = buildSchemaForm(fields, this.fb);
    this.validationResult.set(null);
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
        this.error.set(err?.error?.message ?? 'workflows.detail.errors.exportFailed');
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
            error: err?.error?.message ?? 'workflows.detail.errors.previewFailed',
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
      return (cfg['webhookUrl'] as string).startsWith('enc:v')
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
    this.destMetaForm.reset({ type: 'http', name: '' });
    this.onAdapterTypeChange('http');
    this.destError.set(null);
    this.validationResult.set(null);
    this.showCreateDest.set(true);
  }

  closeCreateDest(): void {
    if (!this.savingDest()) this.showCreateDest.set(false);
  }

  private buildConfigFromForm(): Record<string, unknown> {
    return readSchemaForm(this.configFields(), this.configForm);
  }

  validateDest(): void {
    if (this.destMetaForm.invalid || this.validating()) return;

    let config: Record<string, unknown>;
    try {
      config = this.buildConfigFromForm();
    } catch (err) {
      this.validationResult.set({
        ok: false,
        layer: 'schema',
        errors: [{ field: 'config', message: err instanceof Error ? err.message : String(err) }],
        warnings: [],
        dryRun: null,
      });
      return;
    }

    this.validating.set(true);
    this.validationResult.set(null);

    this.svc
      .validateDestination({
        type: this.destMetaForm.controls.type.value,
        config,
        dryRun: true,
      })
      .subscribe({
        next: (r) => {
          this.validationResult.set(r);
          this.validating.set(false);
        },
        error: (err) => {
          this.validationResult.set({
            ok: false,
            layer: 'schema',
            errors: [{ field: 'request', message: err?.error?.message ?? 'workflows.detail.validationFailed' }],
            warnings: [],
            dryRun: null,
          });
          this.validating.set(false);
        },
      });
  }

  submitDest(): void {
    if (this.destMetaForm.invalid || this.configForm.invalid || this.savingDest()) return;

    let config: Record<string, unknown>;
    try {
      config = this.buildConfigFromForm();
    } catch (err) {
      this.destError.set(err instanceof Error ? err.message : String(err));
      return;
    }

    this.savingDest.set(true);
    this.destError.set(null);

    this.svc
      .createDestination(this.id(), {
        type: this.destMetaForm.controls.type.value,
        name: this.destMetaForm.controls.name.value,
        config,
      })
      .subscribe({
        next: () => {
          this.savingDest.set(false);
          this.showCreateDest.set(false);
          this.loadDestinations();
        },
        error: (err) => {
          this.savingDest.set(false);
          this.destError.set(err?.error?.message ?? 'workflows.detail.errors.addDestFailed');
        },
      });
  }

  toggleDestination(d: Destination): void {
    this.svc.updateDestination(d.id, { enabled: !d.enabled }).subscribe({
      next: () => this.loadDestinations(),
    });
  }

  deleteDestination(d: Destination): void {
    const msg = this.transloco.translate('workflows.detail.confirmDeleteDest', { name: d.name });
    if (!confirm(msg)) return;
    this.svc.removeDestination(d.id).subscribe({
      next: () => this.loadDestinations(),
    });
  }

  onVersionRestored(): void {
    this.showVersions.set(false);
    this.load();
  }

  openTestRun(): void {
    this.testRunResult.set(null);
    this.testRunError.set(null);
    this.showTestRun.set(true);
  }

  closeTestRun(): void {
    if (!this.testRunLoading()) this.showTestRun.set(false);
  }

  runTestRun(): void {
    const wf = this.workflow();
    if (!wf || this.testRunLoading()) return;

    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(this.testRunPayload()) as Record<string, unknown>;
    } catch {
      this.testRunError.set('workflows.detail.errors.invalidJson');
      return;
    }

    this.testRunLoading.set(true);
    this.testRunError.set(null);
    this.testRunResult.set(null);

    this.svc.testRun(wf.id, payload, this.dryRunDestinations()).subscribe({
      next: (r) => {
        this.testRunResult.set(r);
        this.testRunLoading.set(false);
      },
      error: (err) => {
        this.testRunError.set(err?.error?.message ?? 'workflows.detail.errors.testRunFailed');
        this.testRunLoading.set(false);
      },
    });
  }
}