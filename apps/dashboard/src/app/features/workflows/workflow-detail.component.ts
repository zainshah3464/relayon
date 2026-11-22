import {
  Component,
  inject,
  signal,
  OnInit,
  input,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
  FormsModule,
} from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { TranslocoModule } from '@jsverse/transloco';
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
import { IconComponent } from '../../shared/ui/icon/icon.component';
import { ModalComponent } from '../../shared/ui/modal/modal.component';
import { ConfirmDialogService } from '../../shared/ui/confirm/confirm-dialog.service';
import { ToastService } from '../../shared/ui/toast/toast.service';

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
    IconComponent,
    ModalComponent,
  ],
  template: `
    <div class="space-y-5">
      <!-- ═══════════════ HEADER ═══════════════ -->
      <div>
        <a
          routerLink="/workflows"
          class="inline-flex items-center gap-1 text-xs text-muted transition-colors hover:text-foreground"
        >
          <app-icon name="arrow-left" [size]="12" [strokeWidth]="2.5" />
          <span>{{ 'workflows.detail.allWorkflows' | transloco }}</span>
        </a>

        <div class="mt-2 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div class="min-w-0">
            <h1 class="text-2xl font-bold tracking-tighter text-foreground sm:text-3xl">
              {{ workflow()?.name ?? ('common.loading' | transloco) }}
            </h1>
            @if (workflow(); as wf) {
              <p class="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                <span class="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] text-foreground">{{ wf.sourceType }}</span>
                <span class="text-muted-2">·</span>
                <span class="font-mono">ID {{ wf.id.slice(0, 8) }}</span>
              </p>
            }
          </div>

          <div class="flex flex-wrap gap-1.5">
            <button
              type="button"
              (click)="copyWebhookUrl()"
              class="btn-secondary text-xs"
              [disabled]="!workflow()"
            >
              <app-icon [name]="copied() ? 'check' : 'copy'" [size]="12" [strokeWidth]="2.5" />
              <span>{{ (copied() ? 'workflows.detail.copied' : 'workflows.detail.copyWebhookUrl') | transloco }}</span>
            </button>
            <button
              type="button"
              (click)="exportYaml()"
              [disabled]="exporting() || !workflow()"
              class="btn-secondary text-xs"
            >
              @if (exporting()) {
                <app-icon name="loader" [size]="12" [strokeWidth]="2.5" class="animate-spin" />
              } @else {
                <app-icon name="download" [size]="12" [strokeWidth]="2.5" />
              }
              <span>{{ (exporting() ? 'workflows.detail.exporting' : 'workflows.detail.exportYaml') | transloco }}</span>
            </button>
            <button
              type="button"
              (click)="openTestRun()"
              class="btn-primary text-xs"
              [disabled]="!workflow()"
            >
              <app-icon name="play" [size]="12" [strokeWidth]="2.5" />
              <span>{{ 'workflows.detail.testRun' | transloco }}</span>
            </button>
            <button
              type="button"
              (click)="showVersions.set(true)"
              class="btn-secondary text-xs"
              [disabled]="!workflow()"
            >
              <app-icon name="clock" [size]="12" [strokeWidth]="2.5" />
              <span>{{ 'workflows.detail.versionHistory' | transloco }}</span>
            </button>
          </div>
        </div>
      </div>

      @if (error()) {
        <div class="flex items-start gap-2.5 rounded-lg border border-signal-rose/30 bg-signal-rose/10 px-3 py-2.5 text-sm text-signal-rose">
          <app-icon name="alert-circle" [size]="16" [strokeWidth]="2" class="mt-0.5 shrink-0" />
          <span>{{ error() | transloco }}</span>
        </div>
      }

      @if (workflow(); as wf) {
        <!-- ═══════════ WEBHOOK URL ═══════════ -->
        <div class="card">
          <h2 class="text-[11px] font-medium uppercase tracking-wider text-muted-2">
            {{ 'workflows.detail.webhookUrl' | transloco }}
          </h2>
          <div class="mt-2 flex items-center gap-2 overflow-x-auto">
            <code class="min-w-0 flex-1 truncate rounded-md bg-surface-2 px-3 py-2 font-mono text-xs text-relay-cyan">
              {{ ingressUrl }}/webhook/{{ wf.tenantId }}/{{ wf.id }}
            </code>
            <button
              type="button"
              (click)="copyWebhookUrl()"
              class="btn-ghost shrink-0"
              [attr.aria-label]="'Copy webhook URL'"
            >
              <app-icon [name]="copied() ? 'check' : 'copy'" [size]="14" [strokeWidth]="2" />
            </button>
          </div>
        </div>

        <!-- ═══════════ SCHEDULE CARD ═══════════ -->
        <app-workflow-schedule-card [workflowId]="wf.id" />

        <!-- ═══════════ TRANSFORM EDITOR ═══════════ -->
        <div class="card">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <app-icon name="sparkles" [size]="14" [strokeWidth]="2" class="text-muted" />
              <h2 class="text-sm font-semibold text-foreground">
                {{ 'workflows.detail.transformExpression' | transloco }}
              </h2>
            </div>
            <button
              type="button"
              (click)="toggleTransform()"
              class="btn-ghost text-xs text-relay-cyan"
            >
              <app-icon [name]="showTransform() ? 'eye-off' : 'edit'" [size]="12" [strokeWidth]="2" />
              <span>{{ (showTransform() ? 'common.hide' : 'common.edit') | transloco }}</span>
            </button>
          </div>

          @if (showTransform()) {
            <textarea
              [(ngModel)]="transformExpr"
              rows="4"
              class="input mt-3 font-mono text-xs"
              placeholder="{ 'event_type': type, 'amount': data.amount / 100 }"
            ></textarea>

            <div class="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                (click)="previewTransform()"
                [disabled]="previewing()"
                class="btn-secondary text-xs"
              >
                @if (previewing()) {
                  <app-icon name="loader" [size]="12" [strokeWidth]="2.5" class="animate-spin" />
                } @else {
                  <app-icon name="play" [size]="12" [strokeWidth]="2.5" />
                }
                <span>{{ (previewing() ? 'workflows.detail.testing' : 'workflows.detail.testWithSample') | transloco }}</span>
              </button>
              <button
                type="button"
                (click)="saveTransform()"
                [disabled]="savingTransform()"
                class="btn-primary text-xs"
              >
                @if (savingTransform()) {
                  <app-icon name="loader" [size]="12" [strokeWidth]="2.5" class="animate-spin" />
                } @else {
                  <app-icon name="save" [size]="12" [strokeWidth]="2" />
                }
                <span>{{ (savingTransform() ? 'common.saving' : 'workflows.detail.saveExpression') | transloco }}</span>
              </button>
            </div>

            @if (previewResult(); as r) {
              <div
                class="mt-3 rounded-lg border p-3"
                [ngClass]="{
                  'border-signal-green/30': r.ok,
                  'bg-signal-green/[0.06]': r.ok,
                  'border-signal-rose/30': !r.ok,
                  'bg-signal-rose/[0.06]': !r.ok
                }"
              >
                @if (r.ok) {
                  <p class="flex items-center gap-1.5 text-xs text-signal-green">
                    <app-icon name="check-circle" [size]="13" [strokeWidth]="2" />
                    {{ 'workflows.detail.valid' | transloco }} · {{ r.durationMs }}ms
                  </p>
                  <pre class="mt-2 overflow-x-auto rounded bg-surface-2 p-2 font-mono text-xs text-relay-cyan">{{ r.result | json }}</pre>
                } @else {
                  <p class="flex items-center gap-1.5 text-xs text-signal-rose">
                    <app-icon name="x-circle" [size]="13" [strokeWidth]="2" />
                    {{ r.error | transloco }}
                  </p>
                }
              </div>
            }
          } @else {
            <div class="mt-3 rounded-md bg-surface-2 px-3 py-2">
              <code class="font-mono text-xs text-muted">{{ workflow()?.transformExpression || ('workflows.detail.noTransform' | transloco) }}</code>
            </div>
          }
        </div>

        <!-- ═══════════ CONFIG SUMMARY ═══════════ -->
        <div class="grid gap-3 sm:grid-cols-3">
          <div class="card">
            <p class="text-[10px] font-medium uppercase tracking-wider text-muted-2">
              {{ 'workflows.detail.aiEnrichment' | transloco }}
            </p>
            <div class="mt-1 flex items-center gap-1.5">
              <span
                class="inline-block h-1.5 w-1.5 rounded-full"
                [class.bg-signal-green]="wf.enrichmentEnabled"
                [class.bg-muted-2]="!wf.enrichmentEnabled"
              ></span>
              <p class="text-sm font-medium" [class.text-foreground]="wf.enrichmentEnabled" [class.text-muted]="!wf.enrichmentEnabled">
                {{ (wf.enrichmentEnabled ? 'common.enabled' : 'common.disabled') | transloco }}
              </p>
            </div>
          </div>

          <div class="card">
            <p class="text-[10px] font-medium uppercase tracking-wider text-muted-2">
              {{ 'workflows.detail.status' | transloco }}
            </p>
            <div class="mt-1 flex items-center gap-1.5">
              <span
                class="inline-block h-1.5 w-1.5 rounded-full"
                [class.bg-signal-green]="wf.isActive"
                [class.bg-muted-2]="!wf.isActive"
              ></span>
              <p class="text-sm font-medium text-foreground">
                {{ (wf.isActive ? 'common.active' : 'common.inactive') | transloco }}
              </p>
            </div>
          </div>

          <div class="card">
            <p class="text-[10px] font-medium uppercase tracking-wider text-muted-2">
              {{ 'workflows.detail.transform' | transloco }}
            </p>
            <p class="mt-1 truncate text-sm font-medium text-foreground">
              {{ (wf.transformExpression ? 'workflows.detail.customJsonata' : 'common.none') | transloco }}
            </p>
          </div>
        </div>

        <!-- ═══════════ DESTINATIONS ═══════════ -->
        <div>
          <div class="mb-3 flex items-end justify-between">
            <div>
              <h2 class="text-lg font-semibold text-foreground">
                {{ 'workflows.detail.destinations' | transloco }}
              </h2>
              <p class="mt-0.5 text-xs text-muted">
                Where events are routed after enrichment and transform.
              </p>
            </div>
            <button type="button" (click)="openCreateDest()" class="btn-primary text-xs">
              <app-icon name="plus" [size]="12" [strokeWidth]="2.5" />
              <span>{{ 'workflows.detail.addDestination' | transloco }}</span>
            </button>
          </div>

          @if (destinations().length === 0) {
            <div class="card flex flex-col items-center justify-center py-10 text-center">
              <div class="flex h-12 w-12 items-center justify-center rounded-xl border border-hairline bg-surface-2 text-muted">
                <app-icon name="send" [size]="22" [strokeWidth]="2" />
              </div>
              <p class="mt-3 text-sm text-muted">
                {{ 'workflows.detail.noDestinations' | transloco }}
              </p>
              <button type="button" (click)="openCreateDest()" class="btn-secondary mt-3 text-xs">
                <app-icon name="plus" [size]="12" [strokeWidth]="2.5" />
                <span>Add your first destination</span>
              </button>
            </div>
          } @else {
            <div class="space-y-2">
              @for (d of destinations(); track d.id) {
                <div class="card">
                  <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div class="min-w-0 flex-1">
                      <div class="flex flex-wrap items-center gap-1.5">
                        <span class="text-sm font-medium text-foreground">{{ d.name }}</span>
                        <span class="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] text-relay-cyan">{{ d.type }}</span>
                        @if (!d.enabled) {
                          <span class="badge badge-warning">{{ 'common.disabled' | transloco }}</span>
                        }
                        @if (d.lastValidationOk === true) {
                          <span
                            class="badge badge-success"
                            [title]="('workflows.detail.lastValidated' | transloco) + ': ' + (d.lastValidatedAt | date: 'short')"
                          >
                            <app-icon name="check" [size]="9" [strokeWidth]="3" />
                            {{ 'workflows.detail.verified' | transloco }}
                          </span>
                        } @else if (d.lastValidationOk === false) {
                          <span
                            class="badge badge-danger"
                            [title]="d.lastValidationError || ('workflows.detail.validationFailed' | transloco)"
                          >
                            <app-icon name="x" [size]="9" [strokeWidth]="3" />
                            {{ 'workflows.detail.failed' | transloco }}
                          </span>
                        }
                      </div>
                      <p class="mt-1 truncate font-mono text-[11px] text-muted">{{ destinationSummary(d) }}</p>
                    </div>

                    <div class="flex shrink-0 gap-1">
                      <button
                        type="button"
                        (click)="toggleDestination(d)"
                        class="btn-ghost text-xs"
                      >
                        <app-icon
                          [name]="d.enabled ? 'pause' : 'play'"
                          [size]="12"
                          [strokeWidth]="2"
                        />
                        <span class="hidden sm:inline">{{ (d.enabled ? 'common.disable' : 'common.enable') | transloco }}</span>
                      </button>
                      <button
                        type="button"
                        (click)="deleteDestination(d)"
                        class="btn-ghost text-xs text-signal-rose hover:bg-signal-rose/10"
                      >
                        <app-icon name="trash" [size]="12" [strokeWidth]="2" />
                        <span class="hidden sm:inline">{{ 'common.delete' | transloco }}</span>
                      </button>
                    </div>
                  </div>
                </div>
              }
            </div>
          }
        </div>
      }

      <!-- ═══════════ VERSIONS DRAWER ═══════════ -->
      @if (showVersions()) {
        <app-workflow-versions-drawer
          [workflowId]="id()"
          (close)="showVersions.set(false)"
          (restored)="onVersionRestored()"
        />
      }

      <!-- ═══════════ CREATE DESTINATION MODAL ═══════════ -->
      @if (showCreateDest()) {
        <app-modal
          title="{{ 'workflows.detail.createDestinationTitle' | transloco }}"
          subtitle="Configure where events are delivered."
          size="lg"
          (closed)="closeCreateDest()"
        >
          <form [formGroup]="destMetaForm" (ngSubmit)="submitDest()" class="space-y-4">
            <div class="grid gap-3 sm:grid-cols-2">
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
                <input
                  formControlName="name"
                  class="input"
                  [placeholder]="'workflows.detail.namePlaceholder' | transloco"
                />
              </div>
            </div>

            <div class="rounded-lg border border-hairline bg-surface-2/30 p-3" [formGroup]="configForm">
              <app-schema-form [fields]="configFields()" [form]="configForm" />
            </div>

            @if (validationResult(); as r) {
              <div
                class="rounded-lg border p-3 text-xs"
                [ngClass]="{
                  'border-signal-green/30': r.ok,
                  'bg-signal-green/[0.06]': r.ok,
                  'border-signal-rose/30': !r.ok,
                  'bg-signal-rose/[0.06]': !r.ok
                }"
              >
                <p
                  class="flex items-center gap-1.5 font-medium"
                  [class.text-signal-green]="r.ok"
                  [class.text-signal-rose]="!r.ok"
                >
                  <app-icon
                    [name]="r.ok ? 'check-circle' : 'x-circle'"
                    [size]="13"
                    [strokeWidth]="2"
                  />
                  {{ (r.ok ? 'workflows.detail.connectionVerified' : 'workflows.detail.validationFailedTitle') | transloco }}
                </p>
                @if (r.dryRun) {
                  <p class="mt-1 text-muted">{{ r.dryRun.detail }} · {{ r.dryRun.latencyMs }}ms</p>
                }
                @for (e of r.errors; track $index) {
                  <p class="mt-1 text-signal-rose">{{ e.field }}: {{ e.message }}</p>
                }
                @for (w of r.warnings; track $index) {
                  <p class="mt-1 text-signal-amber">{{ w }}</p>
                }
              </div>
            }

            @if (destError()) {
              <div class="flex items-start gap-2.5 rounded-lg border border-signal-rose/30 bg-signal-rose/10 px-3 py-2.5 text-sm text-signal-rose">
                <app-icon name="alert-circle" [size]="16" [strokeWidth]="2" class="mt-0.5 shrink-0" />
                <span>{{ destError() | transloco }}</span>
              </div>
            }
          </form>

          <div modal-footer class="flex-col-reverse sm:flex-row">
            <button
              type="button"
              (click)="validateDest()"
              [disabled]="validating() || destMetaForm.invalid"
              class="btn-secondary text-xs sm:mr-auto"
            >
              @if (validating()) {
                <app-icon name="loader" [size]="12" [strokeWidth]="2.5" class="animate-spin" />
              } @else {
                <app-icon name="zap" [size]="12" [strokeWidth]="2" />
              }
              <span>{{ (validating() ? 'workflows.detail.testing' : 'workflows.detail.testConnection') | transloco }}</span>
            </button>
            <div class="flex flex-col-reverse gap-2 sm:flex-row">
              <button type="button" (click)="closeCreateDest()" class="btn-secondary text-xs">
                {{ 'common.cancel' | transloco }}
              </button>
              <button
                type="button"
                (click)="submitDest()"
                [disabled]="destMetaForm.invalid || configForm.invalid || savingDest()"
                class="btn-primary text-xs"
              >
                @if (savingDest()) {
                  <app-icon name="loader" [size]="12" [strokeWidth]="2.5" class="animate-spin" />
                } @else {
                  <app-icon name="plus" [size]="12" [strokeWidth]="2.5" />
                }
                <span>{{ (savingDest() ? 'common.adding' : 'common.add') | transloco }}</span>
              </button>
            </div>
          </div>
        </app-modal>
      }

      <!-- ═══════════ TEST RUN MODAL ═══════════ -->
      @if (showTestRun()) {
        <app-modal
          title="{{ 'workflows.detail.testRunPipeline' | transloco }}"
          subtitle="{{ 'workflows.detail.testRunHint' | transloco }}"
          size="xl"
          [closeOnBackdrop]="false"
          (closed)="closeTestRun()"
        >
          <div class="space-y-4">
            <div>
              <label for="test-payload" class="label">{{ 'workflows.detail.samplePayload' | transloco }}</label>
              <textarea
                id="test-payload"
                [value]="testRunPayload()"
                (input)="testRunPayload.set($any($event.target).value)"
                rows="8"
                class="input font-mono text-xs"
              ></textarea>
            </div>

            <label class="flex cursor-pointer items-center gap-2.5 rounded-lg border border-hairline bg-surface-2/50 p-3">
              <input
                type="checkbox"
                [checked]="dryRunDestinations()"
                (change)="dryRunDestinations.set($any($event.target).checked)"
                class="h-4 w-4 rounded border-hairline-strong bg-surface-3 text-relay-violet"
              />
              <div class="min-w-0 flex-1">
                <p class="text-sm font-medium text-foreground">{{ 'workflows.detail.alsoDryRun' | transloco }}</p>
                <p class="text-[11px] text-muted">Adds ~1–2s per destination</p>
              </div>
            </label>

            @if (testRunError()) {
              <div class="flex items-start gap-2.5 rounded-lg border border-signal-rose/30 bg-signal-rose/10 px-3 py-2.5 text-sm text-signal-rose">
                <app-icon name="alert-circle" [size]="16" [strokeWidth]="2" class="mt-0.5 shrink-0" />
                <span>{{ testRunError() | transloco }}</span>
              </div>
            }

            @if (testRunResult(); as r) {
              <div class="space-y-3 pt-2">
                <!-- 1. Enrichment -->
                <div class="rounded-lg border border-hairline bg-surface-2 p-3">
                  <div class="flex items-center justify-between">
                    <h3 class="flex items-center gap-1.5 text-sm font-medium text-foreground">
                      <app-icon name="sparkles" [size]="13" [strokeWidth]="2" />
                      {{ 'workflows.detail.stepEnrichment' | transloco }}
                    </h3>
                    <span
                      class="text-xs"
                      [class.text-signal-green]="r.enrichment.enabled && !r.enrichment.error"
                      [class.text-muted]="!r.enrichment.enabled"
                      [class.text-signal-rose]="r.enrichment.error"
                    >
                      @if (!r.enrichment.enabled) { {{ 'common.disabled' | transloco }} }
                      @else if (r.enrichment.error) { {{ 'workflows.detail.error' | transloco }} · {{ r.enrichment.durationMs }}ms }
                      @else {
                        {{ 'workflows.detail.ok' | transloco }} · {{ r.enrichment.durationMs }}ms
                        @if (r.enrichment.cached) { · {{ 'workflows.detail.cached' | transloco }} }
                      }
                    </span>
                  </div>
                  @if (r.enrichment.error) {
                    <p class="mt-1.5 text-xs text-signal-rose">{{ r.enrichment.error }}</p>
                  } @else if (r.enrichment.result) {
                    <pre class="mt-2 max-h-40 overflow-auto rounded bg-midnight p-2 font-mono text-[11px] text-relay-cyan">{{ r.enrichment.result | json }}</pre>
                  }
                </div>

                <!-- 2. Transform -->
                <div class="rounded-lg border border-hairline bg-surface-2 p-3">
                  <div class="flex items-center justify-between">
                    <h3 class="flex items-center gap-1.5 text-sm font-medium text-foreground">
                      <app-icon name="edit" [size]="13" [strokeWidth]="2" />
                      {{ 'workflows.detail.stepTransform' | transloco }}
                    </h3>
                    <span
                      class="text-xs"
                      [class.text-signal-green]="r.transform.applied && !r.transform.error"
                      [class.text-muted]="!r.transform.applied"
                      [class.text-signal-rose]="r.transform.error"
                    >
                      @if (!r.transform.applied) { {{ 'workflows.detail.noTransform' | transloco }} }
                      @else if (r.transform.error) { {{ 'workflows.detail.error' | transloco }} · {{ r.transform.durationMs }}ms }
                      @else { {{ 'workflows.detail.applied' | transloco }} · {{ r.transform.durationMs }}ms }
                    </span>
                  </div>
                  @if (r.transform.error) {
                    <p class="mt-1.5 text-xs text-signal-rose">{{ r.transform.error }}</p>
                  }
                  <pre class="mt-2 max-h-40 overflow-auto rounded bg-midnight p-2 font-mono text-[11px] text-relay-cyan">{{ r.transform.result | json }}</pre>
                </div>

                <!-- 3. Routing -->
                <div class="rounded-lg border border-hairline bg-surface-2 p-3">
                  <div class="flex items-center justify-between">
                    <h3 class="flex items-center gap-1.5 text-sm font-medium text-foreground">
                      <app-icon name="send" [size]="13" [strokeWidth]="2" />
                      {{ 'workflows.detail.stepRouting' | transloco }}
                    </h3>
                    <span class="text-xs text-muted">{{ r.routing.reason }}</span>
                  </div>
                  @if (r.routing.destinationIds.length === 0) {
                    <p class="mt-1.5 flex items-center gap-1.5 text-xs text-signal-amber">
                      <app-icon name="alert-circle" [size]="12" [strokeWidth]="2" />
                      {{ 'workflows.detail.noDestinationReceives' | transloco }}
                    </p>
                  } @else {
                    <p class="mt-1.5 text-xs text-foreground">
                      {{ r.routing.destinationIds.length }} {{ 'workflows.detail.destinationsWouldReceive' | transloco }}
                    </p>
                    <div class="mt-2 flex flex-wrap gap-1">
                      @for (d of r.destinations; track d.id) {
                        @if (r.routing.destinationIds.includes(d.id)) {
                          <span class="badge badge-success font-mono">
                            {{ d.name }} · {{ d.type }}
                          </span>
                        }
                      }
                    </div>
                  }
                </div>

                <!-- 4. Dry runs -->
                @if (r.dryRuns.length > 0) {
                  <div class="rounded-lg border border-hairline bg-surface-2 p-3">
                    <div class="flex items-center justify-between">
                      <h3 class="flex items-center gap-1.5 text-sm font-medium text-foreground">
                        <app-icon name="zap" [size]="13" [strokeWidth]="2" />
                        {{ 'workflows.detail.stepDryRuns' | transloco }}
                      </h3>
                      <span class="text-xs text-muted">{{ r.dryRuns.length }} {{ 'workflows.detail.checked' | transloco }}</span>
                    </div>
                    <div class="mt-2 space-y-1">
                      @for (d of r.dryRuns; track d.destinationId) {
                        <div class="flex items-center justify-between text-xs">
                          <span class="font-mono text-foreground">{{ d.destinationType }}</span>
                          <span
                            class="flex items-center gap-1"
                            [class.text-signal-green]="d.ok"
                            [class.text-signal-rose]="!d.ok"
                          >
                            <app-icon
                              [name]="d.ok ? 'check' : 'x'"
                              [size]="11"
                              [strokeWidth]="3"
                            />
                            {{ d.statusCode > 0 ? 'HTTP ' + d.statusCode : '' }} · {{ d.latencyMs }}ms
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

          <div modal-footer>
            <button type="button" (click)="closeTestRun()" class="btn-secondary text-xs">
              {{ 'common.close' | transloco }}
            </button>
            <button
              type="button"
              (click)="runTestRun()"
              [disabled]="testRunLoading()"
              class="btn-primary text-xs"
            >
              @if (testRunLoading()) {
                <app-icon name="loader" [size]="12" [strokeWidth]="2.5" class="animate-spin" />
              } @else {
                <app-icon name="play" [size]="12" [strokeWidth]="2.5" />
              }
              <span>{{ (testRunLoading() ? 'workflows.detail.running' : 'workflows.detail.runPipeline') | transloco }}</span>
            </button>
          </div>
        </app-modal>
      }
    </div>
  `,
})
export class WorkflowDetailComponent implements OnInit {
  readonly id = input.required<string>();

  private readonly svc = inject(WorkflowsService);
  private readonly fb = inject(FormBuilder);
  private readonly http = inject(HttpClient);
  private readonly confirm = inject(ConfirmDialogService);
  private readonly toast = inject(ToastService);

  readonly ingressUrl = environment.ingressUrl;

  readonly workflow = signal<Workflow | null>(null);
  readonly destinations = signal<Destination[]>([]);
  readonly error = signal<string | null>(null);
  readonly copied = signal(false);
  readonly exporting = signal(false);

  readonly showVersions = signal(false);

  readonly showTransform = signal(false);
  transformExpr = '';
  readonly previewing = signal(false);
  readonly savingTransform = signal(false);
  readonly previewResult = signal<{
    ok: boolean;
    result: unknown;
    error: string | null;
    durationMs: number;
  } | null>(null);

  readonly adapterCatalog = signal<AdapterCatalogEntry[]>([]);
  readonly selectedAdapter = signal<AdapterCatalogEntry | null>(null);
  readonly configFields = signal<SchemaField[]>([]);

  readonly destMetaForm = this.fb.nonNullable.group({
    type: ['http' as DestinationType, Validators.required],
    name: ['', [Validators.required, Validators.minLength(2)]],
  });
  configForm = this.fb.group({});

  readonly showCreateDest = signal(false);
  readonly savingDest = signal(false);
  readonly destError = signal<string | null>(null);

  readonly validating = signal(false);
  readonly validationResult = signal<{
    ok: boolean;
    layer: string;
    errors: Array<{ field: string; message: string }>;
    warnings: string[];
    dryRun: {
      attempted: boolean;
      success: boolean;
      latencyMs: number;
      detail: string;
    } | null;
  } | null>(null);

  readonly showTestRun = signal(false);
  readonly testRunLoading = signal(false);
  readonly testRunPayload = signal<string>(
    JSON.stringify(
      {
        type: 'checkout.session.completed',
        data: {
          amount: 5000,
          currency: 'usd',
          customer: { email: 'test@example.com' },
        },
      },
      null,
      2,
    ),
  );
  readonly testRunError = signal<string | null>(null);
  readonly dryRunDestinations = signal(true);
  readonly testRunResult = signal<{
    enrichment: {
      enabled: boolean;
      result: unknown;
      cached: boolean;
      error: string | null;
      durationMs: number;
    };
    transform: {
      applied: boolean;
      result: unknown;
      error: string | null;
      durationMs: number;
    };
    routing: {
      destinationIds: string[];
      matchedRule: number | null;
      reason: string;
    };
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
    data: {
      amount: 5000,
      currency: 'usd',
      customer: { email: 'test@example.com' },
    },
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
      error: (err) =>
        this.error.set(
          err?.error?.message ?? 'workflows.detail.errors.loadFailed',
        ),
    });
  }

  loadDestinations(): void {
    this.svc.listDestinations(this.id()).subscribe({
      next: (d) => this.destinations.set(d),
      error: (err) =>
        this.error.set(
          err?.error?.message ?? 'workflows.detail.errors.loadDestFailed',
        ),
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
      this.toast.success('Webhook URL copied');
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
        this.toast.success('Workflow exported');
      },
      error: (err) => {
        this.error.set(
          err?.error?.message ?? 'workflows.detail.errors.exportFailed',
        );
        this.exporting.set(false);
        this.toast.error('Export failed');
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
            error:
              err?.error?.message ?? 'workflows.detail.errors.previewFailed',
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
        this.toast.success('Transform saved');
      },
      error: () => {
        this.savingTransform.set(false);
        this.toast.error('Failed to save transform');
      },
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
    if (typeof cfg['spreadsheetId'] === 'string')
      return `Sheets: ${cfg['spreadsheetId']}`;
    if (typeof cfg['baseId'] === 'string')
      return `Airtable: ${cfg['baseId']}`;
    if (typeof cfg['dataSourceId'] === 'string')
      return `Notion: ${cfg['dataSourceId']}`;
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
        errors: [
          {
            field: 'config',
            message: err instanceof Error ? err.message : String(err),
          },
        ],
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
          if (r.ok) this.toast.success('Connection verified');
        },
        error: (err) => {
          this.validationResult.set({
            ok: false,
            layer: 'schema',
            errors: [
              {
                field: 'request',
                message:
                  err?.error?.message ??
                  'workflows.detail.validationFailed',
              },
            ],
            warnings: [],
            dryRun: null,
          });
          this.validating.set(false);
        },
      });
  }

  submitDest(): void {
    if (
      this.destMetaForm.invalid ||
      this.configForm.invalid ||
      this.savingDest()
    )
      return;

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
          this.toast.success('Destination added');
          this.loadDestinations();
        },
        error: (err) => {
          this.savingDest.set(false);
          this.destError.set(
            err?.error?.message ?? 'workflows.detail.errors.addDestFailed',
          );
        },
      });
  }

  toggleDestination(d: Destination): void {
    this.svc.updateDestination(d.id, { enabled: !d.enabled }).subscribe({
      next: () => {
        this.toast.success(d.enabled ? 'Destination disabled' : 'Destination enabled');
        this.loadDestinations();
      },
      error: () => this.toast.error('Failed to update destination'),
    });
  }

  async deleteDestination(d: Destination): Promise<void> {
    const ok = await this.confirm.confirm({
      title: 'Delete destination',
      message: `Delete destination "${d.name}"? Events will stop being delivered here.`,
      confirmText: 'Delete',
      variant: 'danger',
      icon: 'trash',
    });
    if (!ok) return;

    this.svc.removeDestination(d.id).subscribe({
      next: () => {
        this.toast.success('Destination deleted');
        this.loadDestinations();
      },
      error: () => this.toast.error('Failed to delete destination'),
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
        this.testRunError.set(
          err?.error?.message ?? 'workflows.detail.errors.testRunFailed',
        );
        this.testRunLoading.set(false);
      },
    });
  }
}