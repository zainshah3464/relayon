import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export type PostType = 'discussion' | 'template' | 'article' | 'announcement';

export interface CommunityPostSummary {
  id: string;
  type: PostType;
  title: string;
  slug: string;
  tags: string[];
  likeCount: number;
  replyCount: number;
  viewCount: number;
  pinnedUntil: string | null;
  isPinned: boolean;
  isOfficial: boolean;
  createdAt: string;
  author: { id: string; name: string } | null;
  tenant: { name: string; slug: string } | null;
}

export interface CommunityReply {
  id: string;
  postId: string;
  authorId: string;
  parentId: string | null;
  content: string;
  isSolution: boolean;
  likeCount: number;
  hasLiked?: boolean;
  createdAt: string;
  author: { id: string; name: string };
}

export interface CommunityPostDetail extends CommunityPostSummary {
  content: string;
  hasLiked: boolean;
  metadata: Record<string, unknown>;
  replies: CommunityReply[];
}

@Injectable({ providedIn: 'root' })
export class CommunityApiService {
  private http = inject(HttpClient);
  private base = environment.apiUrl;

  list(
    opts: {
      type?: string;
      search?: string;
      tag?: string;
      sort?: 'recent' | 'popular' | 'top';
      limit?: number;
      cursor?: string;
    } = {},
  ): Observable<{
    items: CommunityPostSummary[];
    nextCursor: string | null;
  }> {
    let p = new HttpParams();
    for (const [k, v] of Object.entries(opts)) {
      if (v !== undefined && v !== null) p = p.set(k, String(v));
    }
    return this.http.get<{
      items: CommunityPostSummary[];
      nextCursor: string | null;
    }>(`${this.base}/api/community/posts`, { params: p });
  }

  get(idOrSlug: string): Observable<CommunityPostDetail> {
    return this.http.get<CommunityPostDetail>(
      `${this.base}/api/community/posts/${idOrSlug}`,
    );
  }

  createPost(payload: {
    type: PostType;
    title: string;
    content: string;
    tags?: string[];
    metadata?: Record<string, unknown>;
  }): Observable<{ id: string; slug: string }> {
    return this.http.post<{ id: string; slug: string }>(
      `${this.base}/api/community/posts`,
      payload,
    );
  }

  reply(payload: {
    postId: string;
    content: string;
    parentId?: string;
  }): Observable<CommunityReply> {
    return this.http.post<CommunityReply>(
      `${this.base}/api/community/replies`,
      payload,
    );
  }

  markSolution(replyId: string): Observable<CommunityReply> {
    return this.http.post<CommunityReply>(
      `${this.base}/api/community/replies/${replyId}/solution`,
      {},
    );
  }

  toggleLike(opts: {
    postId?: string;
    replyId?: string;
  }): Observable<{ liked: boolean }> {
    return this.http.post<{ liked: boolean }>(
      `${this.base}/api/community/like`,
      opts,
    );
  }

  flag(opts: {
    postId?: string;
    replyId?: string;
    reason: string;
    detail?: string;
  }): Observable<unknown> {
    return this.http.post(`${this.base}/api/community/flag`, opts);
  }

  previewTemplate(postId: string): Observable<{
    yaml: string;
    placeholders: string[];
  }> {
    return this.http.get<{ yaml: string; placeholders: string[] }>(
      `${this.base}/api/community/templates/${postId}/preview`,
    );
  }

  importTemplate(
    postId: string,
    yaml: string,
  ): Observable<{ workflowId: string; name: string }> {
    return this.http.post<{ workflowId: string; name: string }>(
      `${this.base}/api/community/templates/${postId}/import`,
      { yaml },
    );
  }

  announcements(
    limit = 3,
  ): Observable<
    Array<{ id: string; title: string; slug: string; content: string; createdAt: string }>
  > {
    return this.http.get<
      Array<{ id: string; title: string; slug: string; content: string; createdAt: string }>
    >(`${this.base}/api/community/announcements?limit=${limit}`);
  }
}