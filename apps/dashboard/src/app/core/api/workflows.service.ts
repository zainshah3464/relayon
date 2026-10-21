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
  | 'postgres'
  | 'mongodb';

export interface Workflow {
  id: string;
  tenantId: string;
  name: string;
  sourceType: SourceType;
  sourceConfig: Record<string, unknown>;
  enrichmentEnabled: boolean;
  enrichmentPrompt: string | null;
  transformExpression: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
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
  createdAt: string;
  updatedAt: string;
}

export interface CreateWorkflowPayload {
  name: string;
  sourceType: SourceType;
  sourceConfig?: Record<string, unknown>;
  enrichmentEnabled?: boolean;
  enrichmentPrompt?: string;
  transformExpression?: string;
  isActive?: boolean;
}

export interface CreateDestinationPayload {
  type: DestinationType;
  name: string;
  config: Record<string, unknown>;
  enabled?: boolean;
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
}