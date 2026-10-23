import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export type EventStatus = 'received' | 'processing' | 'processed' | 'failed';
export type DeliveryStatus = 'pending' | 'delivering' | 'delivered' | 'dlq';

export interface EventSummary {
  _id: string;
  correlationId: string;
  workflowId: string;
  sourceType: string;
  status: EventStatus;
  receivedAt: string;
  processedAt: string | null;
  hasEnrichment: boolean;
  hasError: boolean;
}

export interface DeliveryAttempt {
  at: string;
  statusCode: number | null;
  latencyMs: number;
  error: string | null;
}

export interface Delivery {
  _id: string;
  tenantId: string;
  eventId: string;
  correlationId: string;
  destinationId: string;
  destinationType: string;
  status: DeliveryStatus;
  attemptCount: number;
  nextAttemptAt: string;
  lastAttemptAt: string | null;
  lastResponse: {
    statusCode: number;
    bodySnippet: string;
    latencyMs: number;
  } | null;
  attempts: DeliveryAttempt[];
  error: { code: string; message: string } | null;
  dlqReason: string | null;
  dlqAt: string | null;
  createdAt: string;
  deliveredAt: string | null;
}

export interface EventDetail extends EventSummary {
  rawPayload: unknown;
  enrichedPayload: unknown | null;
  transformedPayload: unknown | null;
  enrichment: {
    enabled: boolean;
    cached: boolean;
    model: string | null;
    durationMs: number;
    error: string | null;
  } | null;
  error: { stage: string; code: string; message: string } | null;
  deliveries: Delivery[];
}

export interface ListResponse<T> {
  items: T[];
  nextCursor: string | null;
}

export interface BulkReplayResult {
  total: number;
  replayed: number;
  failed: number;
  failures: Array<{ id: string; reason: string }>;
}

@Injectable({ providedIn: 'root' })
export class EventsService {
  private http = inject(HttpClient);
  private base = environment.apiUrl;

  list(opts: {
    workflowId?: string;
    status?: string;
    limit?: number;
    cursor?: string;
  } = {}): Observable<ListResponse<EventSummary>> {
    let params = new HttpParams();
    if (opts.workflowId) params = params.set('workflowId', opts.workflowId);
    if (opts.status) params = params.set('status', opts.status);
    if (opts.limit) params = params.set('limit', String(opts.limit));
    if (opts.cursor) params = params.set('cursor', opts.cursor);
    return this.http.get<ListResponse<EventSummary>>(`${this.base}/api/events`, {
      params,
    });
  }

  get(id: string): Observable<EventDetail> {
    return this.http.get<EventDetail>(`${this.base}/api/events/${id}`);
  }

  listDlq(opts: { limit?: number; cursor?: string } = {}): Observable<ListResponse<Delivery>> {
    let params = new HttpParams();
    if (opts.limit) params = params.set('limit', String(opts.limit));
    if (opts.cursor) params = params.set('cursor', opts.cursor);
    return this.http.get<ListResponse<Delivery>>(`${this.base}/api/dlq`, {
      params,
    });
  }

  replayDlq(id: string): Observable<{ replayed: boolean; deliveryId: string }> {
    return this.http.post<{ replayed: boolean; deliveryId: string }>(
      `${this.base}/api/dlq/${id}/replay`,
      {},
    );
  }

  bulkReplayDlq(ids: string[]): Observable<BulkReplayResult> {
    return this.http.post<BulkReplayResult>(
      `${this.base}/api/dlq/bulk-replay`,
      { ids },
    );
  }

  discardDlq(id: string): Observable<{ discarded: boolean; deliveryId: string }> {
    return this.http.delete<{ discarded: boolean; deliveryId: string }>(
      `${this.base}/api/dlq/${id}`,
    );
  }

  bulkDiscardDlq(
    ids: string[],
  ): Observable<{ total: number; discarded: number; failed: number }> {
    return this.http.post<{
      total: number;
      discarded: number;
      failed: number;
    }>(`${this.base}/api/dlq/bulk-discard`, { ids });
  }
}