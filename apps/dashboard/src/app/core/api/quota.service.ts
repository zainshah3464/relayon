import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface QuotaSnapshot {
  period: string;
  mode: 'hard' | 'soft';
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
    quotaMode?: 'hard' | 'soft';
  }): Observable<{
    id: string;
    quotaEventsPerMonth: number;
    quotaAiTokensPerMonth: number;
    quotaMode: string;
  }> {
    return this.http.patch<{
      id: string;
      quotaEventsPerMonth: number;
      quotaAiTokensPerMonth: number;
      quotaMode: string;
    }>(`${this.base}/api/tenants/me/quota`, payload);
  }
}