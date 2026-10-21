import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface Overview {
  events24h: number;
  events7d: number;
  eventsProcessed: number;
  eventsFailed: number;
  deliveries: {
    delivered: number;
    dlq: number;
    pending: number;
    successRate: number | null;
  };
}

export interface DeliveryByDestination {
  _id: string;
  destinationType: string;
  total: number;
  delivered: number;
  dlq: number;
  avgLatencyMs: number | null;
}

export interface DeliveryStats {
  byStatus: { status: string; count: number }[];
  byDestination: DeliveryByDestination[];
}

@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  private http = inject(HttpClient);
  private base = environment.apiUrl;

  overview(): Observable<Overview> {
    return this.http.get<Overview>(`${this.base}/api/analytics/overview`);
  }

  delivery(): Observable<DeliveryStats> {
    return this.http.get<DeliveryStats>(`${this.base}/api/analytics/delivery`);
  }
}