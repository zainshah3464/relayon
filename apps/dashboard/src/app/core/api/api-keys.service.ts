import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export type ApiKeyScope =
  | 'events:read'
  | 'workflows:read'
  | 'workflows:write'
  | 'destinations:read'
  | 'destinations:write'
  | 'dlq:read'
  | 'dlq:write'
  | 'analytics:read';

export interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  scopes: ApiKeyScope[];
  environment: 'live' | 'test';
  lastUsedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

export interface IssuedApiKey extends ApiKey {
  rawKey: string;
}

export interface CreateApiKeyPayload {
  name: string;
  scopes: ApiKeyScope[];
  environment?: 'live' | 'test';
  neverExpires?: boolean;
}

@Injectable({ providedIn: 'root' })
export class ApiKeysService {
  private http = inject(HttpClient);
  private base = environment.apiUrl;

  list(): Observable<ApiKey[]> {
    return this.http.get<ApiKey[]>(`${this.base}/api/api-keys`);
  }

  create(payload: CreateApiKeyPayload): Observable<IssuedApiKey> {
    return this.http.post<IssuedApiKey>(`${this.base}/api/api-keys`, payload);
  }

  revoke(id: string): Observable<{ revoked: boolean; id: string }> {
    return this.http.delete<{ revoked: boolean; id: string }>(
      `${this.base}/api/api-keys/${id}`,
    );
  }
}