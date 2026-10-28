import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export type SourceType = 'stripe' | 'github' | 'shopify' | 'slack' | 'generic';
export type DestinationType =
  | 'http'
  | 'slack'
  | 'email'
  | 'sheets'
  | 'discord'
  | 'airtable'
  | 'notion'
  | 'postgres'
  | 'mongodb';

export interface WorkflowSchedule {
  id: string;
  workflowId: string;
  cronExpression: string;
  timezone: string;
  payloadTemplate: Record<string, unknown>;
  isActive: boolean;
  lastRunAt: string | null;
  nextRunAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface Workflow {
  id: string;
  tenantId: string;
  name: string;
  sourceType: SourceType;
  sourceConfig: Record<string, unknown>;
  enrichmentEnabled: boolean;
  enrichmentPrompt: string | null;
  transformExpression: string | null;
  routingRules: unknown;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  schedule?: WorkflowSchedule | null;
  _count?: { destinations: number };
}

export interface Destination {
  id: string;
  workflowId: string;
  type: DestinationType;
  name: string;
  config: Record<string, unknown>;
  enabled: boolean;
  retryPolicy: Record<string, unknown>;
  lastValidatedAt: string | null;
  lastValidationOk: boolean | null;
  lastValidationError: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowVersionSummary {
  id: string;
  version: number;
  message: string | null;
  createdBy: string | null;
  createdAt: string;
}

export interface WorkflowVersionDetail extends WorkflowVersionSummary {
  snapshot: Record<string, unknown>;
}

export interface CreateWorkflowPayload {
  name: string;
  sourceType: SourceType;
  sourceConfig?: Record<string, unknown>;
  enrichmentEnabled?: boolean;
  enrichmentPrompt?: string;
  transformExpression?: string;
  routingRules?: Array<{ when: string; destinationIds: string[] }>;
  isActive?: boolean;
}

export interface CreateDestinationPayload {
  type: DestinationType;
  name: string;
  config: Record<string, unknown>;
  enabled?: boolean;
}

export interface UpsertSchedulePayload {
  cronExpression: string;
  timezone?: string;
  payloadTemplate?: Record<string, unknown>;
  isActive?: boolean;
}

// ✅ NEW — Adapter SDK types
export interface AdapterField {
  key: string;
  label: string;
  type:
    | 'text'
    | 'url'
    | 'password'
    | 'email'
    | 'textarea'
    | 'number'
    | 'boolean'
    | 'select'
    | 'json'
    | 'string-array';
  required: boolean;
  placeholder?: string;
  help?: string;
  sensitive?: boolean;
  defaultValue?: string | number | boolean;
  options?: Array<{ value: string; label: string }>;
}

export interface AdapterCatalogEntry {
  type: string;
  displayName: string;
  fields: AdapterField[];
  testPayload: unknown;
}

export interface TestRunResult {
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
}

@Injectable({ providedIn: 'root' })
export class WorkflowsService {
  private http = inject(HttpClient);
  private base = environment.apiUrl;

  list(): Observable<Workflow[]> {
    return this.http.get<Workflow[]>(`${this.base}/api/workflows`);
  }

  get(id: string): Observable<Workflow> {
    return this.http.get<Workflow>(`${this.base}/api/workflows/${id}`);
  }

  create(payload: CreateWorkflowPayload): Observable<Workflow> {
    return this.http.post<Workflow>(`${this.base}/api/workflows`, payload);
  }

  update(id: string, payload: Partial<CreateWorkflowPayload>): Observable<Workflow> {
    return this.http.patch<Workflow>(`${this.base}/api/workflows/${id}`, payload);
  }

  remove(id: string): Observable<{ deleted: boolean; id: string }> {
    return this.http.delete<{ deleted: boolean; id: string }>(
      `${this.base}/api/workflows/${id}`,
    );
  }

  exportYaml(id: string): Observable<string> {
    return this.http.get(`${this.base}/api/workflows/${id}/export`, {
      responseType: 'text',
    });
  }

  importYaml(
    yaml: string,
  ): Observable<{ id: string; name: string; destinationsCreated: number }> {
    return this.http.post<{ id: string; name: string; destinationsCreated: number }>(
      `${this.base}/api/workflows/import`,
      { yaml },
    );
  }

  // ── Destinations ─────────────────────────────────────────────

  listDestinations(workflowId: string): Observable<Destination[]> {
    return this.http.get<Destination[]>(
      `${this.base}/api/workflows/${workflowId}/destinations`,
    );
  }

  createDestination(
    workflowId: string,
    payload: CreateDestinationPayload,
  ): Observable<Destination> {
    return this.http.post<Destination>(
      `${this.base}/api/workflows/${workflowId}/destinations`,
      payload,
    );
  }

  updateDestination(
    id: string,
    payload: Partial<CreateDestinationPayload>,
  ): Observable<Destination> {
    return this.http.patch<Destination>(
      `${this.base}/api/destinations/${id}`,
      payload,
    );
  }

  removeDestination(id: string): Observable<{ deleted: boolean; id: string }> {
    return this.http.delete<{ deleted: boolean; id: string }>(
      `${this.base}/api/destinations/${id}`,
    );
  }

  validateDestination(payload: {
    type: DestinationType;
    config: Record<string, unknown>;
    dryRun?: boolean;
    destinationId?: string;
  }): Observable<{
    ok: boolean;
    layer: 'schema' | 'connectivity' | 'both';
    errors: Array<{ field: string; message: string }>;
    warnings: string[];
    dryRun: {
      attempted: boolean;
      success: boolean;
      latencyMs: number;
      detail: string;
    } | null;
  }> {
    return this.http.post<{
      ok: boolean;
      layer: 'schema' | 'connectivity' | 'both';
      errors: Array<{ field: string; message: string }>;
      warnings: string[];
      dryRun: {
        attempted: boolean;
        success: boolean;
        latencyMs: number;
        detail: string;
      } | null;
    }>(`${this.base}/api/destinations/validate`, payload);
  }

  // ── Pipeline test-run ────────────────────────────────────────

  testRun(
    workflowId: string,
    payload: Record<string, unknown>,
    dryRunDestinations = false,
  ): Observable<TestRunResult> {
    return this.http.post<TestRunResult>(
      `${this.base}/api/workflows/${workflowId}/test`,
      { payload, dryRunDestinations },
    );
  }

  // ── Adapters catalog ─────────────────────────────────────────

  listAdapters(): Observable<{ adapters: AdapterCatalogEntry[]; warning?: string }> {
    return this.http.get<{ adapters: AdapterCatalogEntry[]; warning?: string }>(
      `${this.base}/api/destinations/adapters`,
    );
  }

  // ── Versions ─────────────────────────────────────────────────

  listVersions(workflowId: string): Observable<WorkflowVersionSummary[]> {
    return this.http.get<WorkflowVersionSummary[]>(
      `${this.base}/api/workflows/${workflowId}/versions`,
    );
  }

  getVersion(workflowId: string, version: number): Observable<WorkflowVersionDetail> {
    return this.http.get<WorkflowVersionDetail>(
      `${this.base}/api/workflows/${workflowId}/versions/${version}`,
    );
  }

  restoreVersion(workflowId: string, version: number): Observable<Workflow> {
    return this.http.post<Workflow>(
      `${this.base}/api/workflows/${workflowId}/versions/${version}/restore`,
      {},
    );
  }

  diffVersions(
    workflowId: string,
    fromVersion: number,
    toVersion: number,
  ): Observable<{
    fromVersion: number;
    toVersion: number;
    identical: boolean;
    stats: { added: number; removed: number };
    unified: string;
    structured: {
      hunks: Array<{
        oldStart: number;
        oldLines: number;
        newStart: number;
        newLines: number;
      }>;
      split: Array<{
        left: { lineNo: number | null; text: string; type: 'ctx' | 'del' | 'blank' };
        right: { lineNo: number | null; text: string; type: 'ctx' | 'add' | 'blank' };
      }>;
    };
  }> {
    return this.http.get<{
      fromVersion: number;
      toVersion: number;
      identical: boolean;
      stats: { added: number; removed: number };
      unified: string;
      structured: {
        hunks: Array<{
          oldStart: number;
          oldLines: number;
          newStart: number;
          newLines: number;
        }>;
        split: Array<{
          left: { lineNo: number | null; text: string; type: 'ctx' | 'del' | 'blank' };
          right: { lineNo: number | null; text: string; type: 'ctx' | 'add' | 'blank' };
        }>;
      };
    }>(
      `${this.base}/api/workflows/${workflowId}/versions/${fromVersion}/diff/${toVersion}`,
    );
  }

  // ── Schedule ─────────────────────────────────────────────────

  getSchedule(workflowId: string): Observable<WorkflowSchedule | null> {
    return this.http.get<WorkflowSchedule | null>(
      `${this.base}/api/workflows/${workflowId}/schedule`,
    );
  }

  upsertSchedule(
    workflowId: string,
    payload: UpsertSchedulePayload,
  ): Observable<WorkflowSchedule> {
    return this.http.put<WorkflowSchedule>(
      `${this.base}/api/workflows/${workflowId}/schedule`,
      payload,
    );
  }

  deleteSchedule(workflowId: string): Observable<{ deleted: boolean }> {
    return this.http.delete<{ deleted: boolean }>(
      `${this.base}/api/workflows/${workflowId}/schedule`,
    );
  }

  runScheduleNow(workflowId: string): Observable<{
    triggered: boolean;
    workflowId: string;
    correlationId: string | null;
    timestamp: string;
  }> {
    return this.http.post<{
      triggered: boolean;
      workflowId: string;
      correlationId: string | null;
      timestamp: string;
    }>(`${this.base}/api/workflows/${workflowId}/schedule/run-now`, {});
  }

  // ── Bulk schedule operations ─────────────────────────────────

  bulkPauseSchedules(): Observable<{ updated: number }> {
    return this.http.post<{ updated: number }>(
      `${this.base}/api/schedules/bulk/pause-all`,
      {},
    );
  }

  bulkResumeSchedules(): Observable<{ updated: number }> {
    return this.http.post<{ updated: number }>(
      `${this.base}/api/schedules/bulk/resume-all`,
      {},
    );
  }

  bulkDeleteSchedules(): Observable<{ deleted: number }> {
    return this.http.post<{ deleted: number }>(
      `${this.base}/api/schedules/bulk/delete`,
      {},
    );
  }
}