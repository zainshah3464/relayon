import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface QuotaSnapshot {
  period: string;
  metrics: Record<
    'events' | 'ai_tokens' | 'deliveries',
    { used: number; limit: number; remaining: number; resetAt: string }
  >;
}

@Injectable({ providedIn: 'root' })
export class QuotaService {
  private http = inject(HttpClient);
  private base = environment.apiUrl;

  snapshot(): Observable<QuotaSnapshot> {
    return this.http.get<QuotaSnapshot>(`${this.base}/api/quota`);
  }

  updateQuota(payload: {
    eventsPerMonth?: number;
    aiTokensPerMonth?: number;
  }): Observable<{
    id: string;
    quotaEventsPerMonth: number;
    quotaAiTokensPerMonth: number;
  }> {
    return this.http.patch<{
      id: string;
      quotaEventsPerMonth: number;
      quotaAiTokensPerMonth: number;
    }>(`${this.base}/api/tenants/me/quota`, payload);
  }
}