import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface ModerationFlag {
  id: string;
  reason: string;
  detail: string | null;
  status: string;
  createdAt: string;
  reporter: { id: string; email: string; name: string } | null;
  post: {
    id: string;
    title: string;
    slug: string;
    status: string;
    autoHidden: boolean;
    content: string;
    authorName: string | null;
  } | null;
  reply: {
    id: string;
    content: string;
    postId: string;
    authorName: string | null;
  } | null;
}

@Injectable({ providedIn: 'root' })
export class ModerationApiService {
  private http = inject(HttpClient);
  private base = environment.apiUrl;

  listFlags(status?: string): Observable<{
    items: ModerationFlag[];
    nextCursor: string | null;
  }> {
    let p = new HttpParams();
    if (status) p = p.set('status', status);
    return this.http.get<{
      items: ModerationFlag[];
      nextCursor: string | null;
    }>(`${this.base}/api/admin/moderation/flags`, { params: p });
  }

  resolveFlag(
    id: string,
    resolution: 'dismiss' | 'action',
    reason?: string,
  ): Observable<{ resolved: boolean }> {
    return this.http.post<{ resolved: boolean }>(
      `${this.base}/api/admin/moderation/flags/${id}/resolve`,
      { resolution, reason },
    );
  }

  hidePost(postId: string, reason?: string): Observable<{ hidden: boolean }> {
    return this.http.post<{ hidden: boolean }>(
      `${this.base}/api/admin/moderation/posts/${postId}/hide`,
      { reason },
    );
  }

  restorePost(
    postId: string,
    reason?: string,
  ): Observable<{ restored: boolean }> {
    return this.http.post<{ restored: boolean }>(
      `${this.base}/api/admin/moderation/posts/${postId}/restore`,
      { reason },
    );
  }

  removePost(
    postId: string,
    reason?: string,
  ): Observable<{ removed: boolean }> {
    return this.http.post<{ removed: boolean }>(
      `${this.base}/api/admin/moderation/posts/${postId}/remove`,
      { reason },
    );
  }
}