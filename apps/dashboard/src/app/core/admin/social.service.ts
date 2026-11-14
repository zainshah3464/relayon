import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface ShareIntents {
  twitter: { intentUrl: string; apiAvailable: boolean };
  linkedin: { intentUrl: string };
  defaultText: string;
}

export interface ShareResult {
  posted: boolean;
  intentUrl: string;
  tweetId?: string | null;
  mode: 'api' | 'intent';
}

@Injectable({ providedIn: 'root' })
export class SocialApiService {
  private http = inject(HttpClient);
  private base = environment.apiUrl;

  getIntents(announcementId: string): Observable<ShareIntents> {
    return this.http.get<ShareIntents>(
      `${this.base}/api/admin/social/announcements/${announcementId}/intents`,
    );
  }

  share(
    announcementId: string,
    platform: 'twitter' | 'linkedin',
    customText?: string,
  ): Observable<ShareResult> {
    return this.http.post<ShareResult>(
      `${this.base}/api/admin/social/announcements/${announcementId}/share`,
      { platform, customText },
    );
  }

  getHistory(announcementId: string): Observable<
    Array<{
      id: string;
      platform: string;
      status: string;
      externalId: string | null;
      error: string | null;
      createdAt: string;
    }>
  > {
    return this.http.get<
      Array<{
        id: string;
        platform: string;
        status: string;
        externalId: string | null;
        error: string | null;
        createdAt: string;
      }>
    >(
      `${this.base}/api/admin/social/announcements/${announcementId}/shares`,
    );
  }
}