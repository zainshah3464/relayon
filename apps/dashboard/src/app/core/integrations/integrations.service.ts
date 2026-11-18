import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export type Provider = 'groq' | 'openai' | 'anthropic' | 'resend';

export interface Integration {
  id: string;
  provider: Provider;
  apiKey: string; // always "••••••••"
  model: string | null;
  isActive: boolean;
  lastValidatedAt: string | null;
  lastValidationOk: boolean | null;
  validationError: string | null;
  lastUsedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProviderStatus {
  source: 'tenant' | 'platform' | 'none';
  hasIntegration: boolean;
  isActive: boolean;
  model: string | null;
  lastValidationOk: boolean | null;
}

export interface TestResult {
  ok: boolean;
  models?: string[];
  error?: string;
}

@Injectable({ providedIn: 'root' })
export class IntegrationsApiService {
  private http = inject(HttpClient);
  private base = environment.apiUrl;

  list(): Observable<Integration[]> {
    return this.http.get<Integration[]>(`${this.base}/api/settings/integrations`);
  }

  status(): Observable<Record<string, ProviderStatus>> {
    return this.http.get<Record<string, ProviderStatus>>(
      `${this.base}/api/settings/integrations/status`,
    );
  }

  upsert(payload: {
    provider: Provider;
    apiKey: string;
    model?: string;
  }): Observable<Integration> {
    return this.http.post<Integration>(
      `${this.base}/api/settings/integrations`,
      payload,
    );
  }

  test(provider: Provider, apiKey: string): Observable<TestResult> {
    return this.http.post<TestResult>(
      `${this.base}/api/settings/integrations/test`,
      { provider, apiKey },
    );
  }

  toggle(provider: Provider): Observable<{ isActive: boolean }> {
    return this.http.post<{ isActive: boolean }>(
      `${this.base}/api/settings/integrations/${provider}/toggle`,
      {},
    );
  }

  remove(provider: Provider): Observable<{ deleted: boolean }> {
    return this.http.delete<{ deleted: boolean }>(
      `${this.base}/api/settings/integrations/${provider}`,
    );
  }
}