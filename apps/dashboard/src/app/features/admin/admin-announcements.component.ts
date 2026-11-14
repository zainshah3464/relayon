import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import {
  SocialApiService,
  type ShareIntents,
  type ShareResult,
} from '../../core/admin/social.service';

interface Announcement {
  id: string;
  title: string;
  slug: string;
  content: string;
  createdAt: string;
}

@Component({
  selector: 'app-admin-announcements',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="space-y-6">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold text-white">Announcements</h1>
          <p class="text-sm text-muted mt-1">Publish platform news and share to social</p>
        </div>
        <button (click)="openCreate()" class="btn-primary text-sm">+ New announcement</button>
      </div>

      @if (loading()) {
        <div class="card text-sm text-muted">Loading...</div>
      } @else if (items().length === 0) {
        <div class="card text-center py-12">
          <p class="text-sm text-muted">No announcements yet</p>
          <button (click)="openCreate()" class="btn-primary text-xs mt-3">Create the first one</button>
        </div>
      } @else {
        <div class="space-y-2">
          @for (a of items(); track a.id) {
            <div class="card">
              <div class="flex justify-between items-start">
                <div class="flex-1">
                  <p class="text-white font-medium">{{ a.title }}</p>
                  <p class="text-xs text-muted mt-1">{{ a.createdAt | date: 'medium' }}</p>
                </div>
                <div class="flex gap-2 shrink-0">
                  <button (click)="shareToTwitter(a)" class="btn-secondary text-xs">🐦 Tweet</button>
                  <button (click)="shareToLinkedIn(a)" class="btn-secondary text-xs">💼 LinkedIn</button>
                </div>
              </div>
            </div>
          }
        </div>
      }

      @if (showCreate()) {
        <div class="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" (click)="closeCreate()">
          <div class="card w-full max-w-2xl max-h-[90vh] overflow-y-auto" (click)="$event.stopPropagation()">
            <h2 class="text-lg font-semibold text-white mb-4">New announcement</h2>
            <div class="space-y-3">
              <div>
                <label class="label">Title</label>
                <input [(ngModel)]="newTitle" class="input" placeholder="🚀 New feature: Scheduled workflows" />
              </div>
              <div>
                <label class="label">Content (Markdown)</label>
                <textarea [(ngModel)]="newContent" rows="10" class="input font-mono text-sm" placeholder="# What's new..."></textarea>
              </div>
              @if (createError()) {
                <p class="text-sm text-signal-rose">{{ createError() }}</p>
              }
            </div>
            <div class="flex justify-end gap-2 mt-4">
              <button (click)="closeCreate()" class="btn-secondary text-xs">Cancel</button>
              <button (click)="submitCreate()" [disabled]="creating()" class="btn-primary text-xs">
                {{ creating() ? 'Publishing...' : 'Publish' }}
              </button>
            </div>
          </div>
        </div>
      }

      @if (sharePreview(); as s) {
        <div class="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" (click)="closeShare()">
          <div class="card w-full max-w-lg" (click)="$event.stopPropagation()">
            <h2 class="text-lg font-semibold text-white mb-2">
              Share to {{ sharePlatform() === 'twitter' ? 'Twitter/X' : 'LinkedIn' }}
            </h2>
            @if (sharePlatform() === 'twitter') {
              <p class="text-xs text-muted mb-3">
                @if (s.twitter.apiAvailable) {
                  ✓ API configured — will post directly.
                } @else {
                  ⓘ API not configured — will open Twitter with pre-filled text.
                }
              </p>
              <textarea [(ngModel)]="customText" rows="3" class="input text-sm"></textarea>
            } @else {
              <p class="text-xs text-muted mb-3">
                LinkedIn doesn't allow direct posting — will open LinkedIn share in new tab.
              </p>
              <textarea [(ngModel)]="customText" rows="3" class="input text-sm"></textarea>
            }

            @if (shareResult(); as r) {
              <div class="mt-3 text-sm">
                @if (r.posted) {
                  <p class="text-signal-green">
                    ✓ Posted!
                    @if (r.tweetId) {
                      Tweet ID: <code class="text-xs">{{ r.tweetId }}</code>
                    }
                  </p>
                } @else {
                  <p class="text-signal-amber">Intent opened. Complete sharing in the new tab.</p>
                }
              </div>
            }

            <div class="flex justify-end gap-2 mt-4">
              <button (click)="closeShare()" class="btn-secondary text-xs">Close</button>
              <button (click)="doShare()" [disabled]="sharing()" class="btn-primary text-xs">
                {{ sharing() ? 'Sharing...' : (sharePlatform() === 'twitter' && sharePreview()!.twitter.apiAvailable ? 'Post tweet' : 'Open share intent') }}
              </button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
})
export class AdminAnnouncementsComponent implements OnInit {
  private http = inject(HttpClient);
  private social = inject(SocialApiService);

  items = signal<Announcement[]>([]);
  loading = signal(true);

  showCreate = signal(false);
  newTitle = '';
  newContent = '';
  creating = signal(false);
  createError = signal<string | null>(null);

  sharePreview = signal<ShareIntents | null>(null);
  sharePlatform = signal<'twitter' | 'linkedin'>('twitter');
  shareAnnouncementId = signal<string | null>(null);
  customText = '';
  sharing = signal(false);
  shareResult = signal<ShareResult | null>(null);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.http
      .get<
        Array<{
          id: string;
          title: string;
          slug: string;
          content: string;
          createdAt: string;
        }>
      >(`${environment.apiUrl}/api/community/announcements?limit=50`)
      .subscribe({
        next: (r) => {
          this.items.set(r);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  openCreate(): void {
    this.newTitle = '';
    this.newContent = '';
    this.createError.set(null);
    this.showCreate.set(true);
  }

  closeCreate(): void {
    if (!this.creating()) this.showCreate.set(false);
  }

  submitCreate(): void {
    if (!this.newTitle.trim() || !this.newContent.trim() || this.creating()) return;
    this.creating.set(true);
    this.createError.set(null);

    this.http
      .post(`${environment.apiUrl}/api/admin/announcements`, {
        title: this.newTitle,
        content: this.newContent,
      })
      .subscribe({
        next: () => {
          this.creating.set(false);
          this.showCreate.set(false);
          this.load();
        },
        error: (err) => {
          this.creating.set(false);
          this.createError.set(err?.error?.message ?? 'Failed to publish');
        },
      });
  }

  shareToTwitter(a: Announcement): void {
    this.shareAnnouncementId.set(a.id);
    this.sharePlatform.set('twitter');
    this.shareResult.set(null);
    this.social.getIntents(a.id).subscribe({
      next: (s) => {
        this.customText = s.defaultText;
        this.sharePreview.set(s);
      },
    });
  }

  shareToLinkedIn(a: Announcement): void {
    this.shareAnnouncementId.set(a.id);
    this.sharePlatform.set('linkedin');
    this.shareResult.set(null);
    this.social.getIntents(a.id).subscribe({
      next: (s) => {
        this.customText = s.defaultText;
        this.sharePreview.set(s);
      },
    });
  }

  closeShare(): void {
    if (!this.sharing()) {
      this.sharePreview.set(null);
      this.shareResult.set(null);
    }
  }

  doShare(): void {
    const id = this.shareAnnouncementId();
    if (!id || this.sharing()) return;

    this.sharing.set(true);
    this.social.share(id, this.sharePlatform(), this.customText).subscribe({
      next: (r) => {
        this.sharing.set(false);
        this.shareResult.set(r);
        if (r.mode === 'intent' || !r.posted) {
          window.open(r.intentUrl, '_blank', 'noopener');
        }
      },
      error: () => this.sharing.set(false),
    });
  }
}