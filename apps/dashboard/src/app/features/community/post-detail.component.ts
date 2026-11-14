import { Component, inject, signal, input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MarkdownComponent } from 'ngx-markdown';
import {
  CommunityApiService,
  type CommunityPostDetail,
} from '../../core/community/community.service';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-post-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, MarkdownComponent],
  template: `
    @if (loading()) {
      <div class="card text-sm text-muted">Loading post...</div>
    } @else {
      @if (post(); as p) {
        <div class="space-y-6 max-w-4xl">
          <a routerLink="/community" class="text-xs text-muted hover:text-white">← Back to community</a>

          <div class="card">
            <div class="flex items-center gap-2 mb-3">
              <span class="text-xs px-2 py-0.5 rounded bg-surface-2 font-mono text-relay-cyan">{{ p.type }}</span>
              @if (p.isOfficial) {
                <span class="text-xs px-2 py-0.5 rounded bg-signal-amber/20 text-signal-amber">Official</span>
              }
            </div>
            <h1 class="text-2xl font-bold text-white">{{ p.title }}</h1>
            <p class="text-sm text-muted mt-2">
              by {{ p.author?.name || 'Relayon' }}
              @if (p.tenant) { · {{ p.tenant.name }} }
              · {{ p.createdAt | date: 'medium' }}
              · {{ p.viewCount }} views
            </p>

            <div class="flex gap-2 mt-4">
              <button
                (click)="like()"
                class="btn-secondary text-xs"
                [class.border-relay-violet]="p.hasLiked"
                [class.text-relay-violet]="p.hasLiked"
              >
                ♥ {{ p.likeCount }}
              </button>
              @if (p.type === 'template') {
                <button (click)="openImport(p.id)" class="btn-primary text-xs">Use this template</button>
              }
              <button (click)="flag()" class="btn-secondary text-xs text-signal-rose">Report</button>
            </div>
          </div>

          <div class="card prose prose-invert max-w-none">
            <markdown [data]="p.content"></markdown>
          </div>

          <div>
            <h2 class="text-lg font-semibold text-white mb-3">Replies ({{ p.replies.length }})</h2>

            @if (p.replies.length === 0) {
              <div class="card text-sm text-muted">No replies yet. Be the first!</div>
            } @else {
              <div class="space-y-2">
                @for (r of p.replies; track r.id) {
                  <div
                    class="card"
                    [ngClass]="{
                      'ms-8': r.parentId,
                      'border-signal-green/30': r.isSolution
                    }"
                  >
                    <div class="flex justify-between items-start">
                      <p class="text-sm font-medium text-white">
                        {{ r.author.name }}
                        @if (r.isSolution) {
                          <span class="text-xs ms-2 text-signal-green">✓ Solution</span>
                        }
                      </p>
                      <p class="text-xs text-muted">{{ r.createdAt | date: 'short' }}</p>
                    </div>
                    <div class="prose prose-invert max-w-none text-sm mt-2">
                      <markdown [data]="r.content"></markdown>
                    </div>
                    <div class="flex gap-2 mt-3">
                      <button
                        (click)="likeReply(r.id)"
                        class="text-xs"
                        [class.text-relay-violet]="r.hasLiked"
                        [class.text-muted]="!r.hasLiked"
                      >♥ {{ r.likeCount }}</button>
                      <button (click)="replyTo(r.id)" class="text-xs text-muted hover:text-white">Reply</button>
                      @if (canMarkSolution() && !r.isSolution) {
                        <button (click)="markSolution(r.id)" class="text-xs text-signal-green hover:underline">Mark as solution</button>
                      }
                    </div>
                  </div>
                }
              </div>
            }

            <div class="card mt-4">
              @if (replyToId()) {
                <p class="text-xs text-muted mb-1">
                  Replying to a comment ·
                  <button (click)="cancelReply()" class="text-relay-cyan hover:underline">Cancel</button>
                </p>
              }
              <textarea
                [(ngModel)]="replyContent"
                rows="3"
                class="input font-mono text-sm"
                placeholder="Write a reply (Markdown supported)..."
              ></textarea>
              <div class="flex justify-end mt-2">
                <button
                  (click)="submitReply()"
                  [disabled]="!replyContent.trim() || submitting()"
                  class="btn-primary text-xs"
                >
                  {{ submitting() ? 'Posting...' : 'Post reply' }}
                </button>
              </div>
            </div>
          </div>
        </div>
      }
    }

    @if (importPreview(); as imp) {
      <div class="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" (click)="closeImport()">
        <div class="card w-full max-w-3xl max-h-[90vh] overflow-y-auto" (click)="$event.stopPropagation()">
          <h2 class="text-lg font-semibold text-white mb-3">Import template</h2>
          <p class="text-xs text-muted mb-3">Fill in the placeholders below.</p>

          @for (ph of imp.placeholders; track ph) {
            <div class="mb-3">
              <label class="label font-mono text-xs">{{ ph }}</label>
              <input
                [value]="placeholderValues()[ph] || ''"
                (input)="setPlaceholder(ph, $any($event.target).value)"
                class="input font-mono text-sm"
                placeholder="Paste your value..."
              />
            </div>
          }

          @if (importError()) {
            <div class="text-sm text-signal-rose mt-2">{{ importError() }}</div>
          }

          <div class="flex justify-end gap-2 mt-4">
            <button (click)="closeImport()" class="btn-secondary text-xs">Cancel</button>
            <button (click)="submitImport()" [disabled]="importing()" class="btn-primary text-xs">
              {{ importing() ? 'Importing...' : 'Import workflow' }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class PostDetailComponent implements OnInit {
  readonly slug = input.required<string>();

  private api = inject(CommunityApiService);
  private auth = inject(AuthService);

  post = signal<CommunityPostDetail | null>(null);
  loading = signal(true);
  submitting = signal(false);
  replyContent = '';
  replyToId = signal<string | null>(null);

  importPreview = signal<{ yaml: string; placeholders: string[] } | null>(null);
  placeholderValues = signal<Record<string, string>>({});
  importError = signal<string | null>(null);
  importing = signal(false);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.api.get(this.slug()).subscribe({
      next: (p) => {
        this.post.set(p);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  canMarkSolution(): boolean {
    const p = this.post();
    return !!p && p.author?.id === this.auth.user()?.id;
  }

  like(): void {
    const p = this.post();
    if (!p) return;
    this.api.toggleLike({ postId: p.id }).subscribe({
      next: (r) => {
        this.post.set({
          ...p,
          hasLiked: r.liked,
          likeCount: p.likeCount + (r.liked ? 1 : -1),
        });
      },
    });
  }

  likeReply(id: string): void {
    const p = this.post();
    if (!p) return;
    this.api.toggleLike({ replyId: id }).subscribe({
      next: (r) => {
        this.post.set({
          ...p,
          replies: p.replies.map((x) =>
            x.id === id
              ? {
                  ...x,
                  hasLiked: r.liked,
                  likeCount: x.likeCount + (r.liked ? 1 : -1),
                }
              : x,
          ),
        });
      },
    });
  }

  replyTo(id: string): void {
    this.replyToId.set(id);
    document.querySelector<HTMLTextAreaElement>('textarea')?.focus();
  }

  cancelReply(): void {
    this.replyToId.set(null);
  }

  submitReply(): void {
    const p = this.post();
    if (!p || !this.replyContent.trim() || this.submitting()) return;

    this.submitting.set(true);
    this.api
      .reply({
        postId: p.id,
        content: this.replyContent.trim(),
        parentId: this.replyToId() ?? undefined,
      })
      .subscribe({
        next: () => {
          this.replyContent = '';
          this.replyToId.set(null);
          this.submitting.set(false);
          this.load();
        },
        error: () => this.submitting.set(false),
      });
  }

  markSolution(id: string): void {
    this.api.markSolution(id).subscribe({ next: () => this.load() });
  }

  flag(): void {
    const p = this.post();
    if (!p) return;
    const reason = prompt(
      'Reason: spam / abuse / off-topic / other',
    ) as 'spam' | 'abuse' | 'off-topic' | 'other' | null;
    if (!reason) return;
    this.api.flag({ postId: p.id, reason }).subscribe({
      next: () => alert('Reported. Thanks.'),
    });
  }

  openImport(postId: string): void {
    this.importError.set(null);
    this.placeholderValues.set({});
    this.api.previewTemplate(postId).subscribe({
      next: (r) => this.importPreview.set(r),
      error: (err) =>
        this.importError.set(err?.error?.message ?? 'Failed to load template'),
    });
  }

  closeImport(): void {
    if (!this.importing()) this.importPreview.set(null);
  }

  setPlaceholder(key: string, value: string): void {
    this.placeholderValues.set({ ...this.placeholderValues(), [key]: value });
  }

  submitImport(): void {
    const p = this.post();
    const imp = this.importPreview();
    if (!p || !imp || this.importing()) return;

    let yaml = imp.yaml;
    for (const key of imp.placeholders) {
      const value = this.placeholderValues()[key] ?? '';
      if (!value.trim()) {
        this.importError.set(`Please fill "${key}"`);
        return;
      }
      yaml = yaml.replace(new RegExp(`\\$\\{${key}\\}`, 'g'), value);
    }

    this.importing.set(true);
    this.importError.set(null);
    this.api.importTemplate(p.id, yaml).subscribe({
      next: (r) => {
        this.importing.set(false);
        this.importPreview.set(null);
        window.location.href = `/workflows/${r.workflowId}`;
      },
      error: (err) => {
        this.importing.set(false);
        this.importError.set(err?.error?.message ?? 'Import failed');
      },
    });
  }
}