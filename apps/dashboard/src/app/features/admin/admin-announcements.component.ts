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
import { IconComponent } from '../../shared/ui/icon/icon.component';
import { ModalComponent } from '../../shared/ui/modal/modal.component';
import { ToastService } from '../../shared/ui/toast/toast.service';

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
  imports: [CommonModule, FormsModule, IconComponent, ModalComponent],
  template: `
    <div class="space-y-4">
      <!-- Header -->
      <div class="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 class="text-2xl font-bold tracking-tighter text-foreground">Announcements</h1>
          <p class="mt-1 text-sm text-muted">Publish platform news and share to social</p>
        </div>
        <button type="button" (click)="openCreate()" class="btn-primary self-start">
          <app-icon name="plus" [size]="13" [strokeWidth]="2.5" />
          <span>New announcement</span>
        </button>
      </div>

      <!-- List -->
      @if (loading() && items().length === 0) {
        <div class="space-y-2">
          @for (i of [1, 2, 3]; track i) {
            <div class="card">
              <div class="skeleton h-4 w-48"></div>
              <div class="skeleton mt-2 h-3 w-32"></div>
            </div>
          }
        </div>
      } @else if (items().length === 0) {
        <div class="card flex flex-col items-center justify-center py-12 text-center">
          <div class="flex h-12 w-12 items-center justify-center rounded-xl border border-hairline bg-surface-2 text-muted">
            <app-icon name="megaphone" [size]="22" [strokeWidth]="1.75" />
          </div>
          <p class="mt-3 text-sm font-medium text-foreground">No announcements yet</p>
          <p class="mt-1 text-xs text-muted">Publish your first announcement.</p>
          <button type="button" (click)="openCreate()" class="btn-primary mt-4 text-xs">
            <app-icon name="plus" [size]="12" [strokeWidth]="2.5" />
            <span>Create first announcement</span>
          </button>
        </div>
      } @else {
        <div class="space-y-2">
          @for (a of items(); track a.id) {
            <div class="card">
              <div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div class="min-w-0 flex-1">
                  <p class="text-sm font-medium text-foreground">{{ a.title }}</p>
                  <p class="mt-0.5 text-[11px] text-muted-2">{{ a.createdAt | date: 'medium' }}</p>
                </div>
                <div class="flex shrink-0 gap-1.5">
                  <button type="button" (click)="shareTo('twitter', a)" class="btn-secondary text-xs">
                    <app-icon name="share" [size]="11" [strokeWidth]="2" />
                    <span>Tweet</span>
                  </button>
                  <button type="button" (click)="shareTo('linkedin', a)" class="btn-secondary text-xs">
                    <app-icon name="external-link" [size]="11" [strokeWidth]="2" />
                    <span>LinkedIn</span>
                  </button>
                </div>
              </div>
            </div>
          }
        </div>
      }

      <!-- Create modal -->
      @if (showCreate()) {
        <app-modal
          title="New announcement"
          subtitle="Markdown supported. Posted instantly to the community."
          size="lg"
          (closed)="closeCreate()"
        >
          <div class="space-y-3">
            <div>
              <label for="ann-title" class="label">Title</label>
              <input
                id="ann-title"
                [(ngModel)]="newTitle"
                class="input"
                placeholder="New feature: Scheduled workflows"
                autocomplete="off"
              />
            </div>

            <div>
              <label for="ann-content" class="label">Content (Markdown)</label>
              <textarea
                id="ann-content"
                [(ngModel)]="newContent"
                rows="10"
                class="input font-mono text-sm"
                placeholder="# What's new…"
              ></textarea>
            </div>

            @if (createError()) {
              <div class="flex items-start gap-2.5 rounded-lg border border-signal-rose/30 bg-signal-rose/10 px-3 py-2.5 text-sm text-signal-rose">
                <app-icon name="alert-circle" [size]="16" [strokeWidth]="2" class="mt-0.5 shrink-0" />
                <span>{{ createError() }}</span>
              </div>
            }
          </div>

          <div modal-footer>
            <button type="button" (click)="closeCreate()" class="btn-secondary">Cancel</button>
            <button
              type="button"
              (click)="submitCreate()"
              [disabled]="!newTitle.trim() || !newContent.trim() || creating()"
              class="btn-primary"
            >
              @if (creating()) {
                <app-icon name="loader" [size]="13" [strokeWidth]="2.5" class="animate-spin" />
              } @else {
                <app-icon name="megaphone" [size]="13" [strokeWidth]="2" />
              }
              <span>{{ creating() ? 'Publishing…' : 'Publish' }}</span>
            </button>
          </div>
        </app-modal>
      }

      <!-- Share modal -->
      @if (sharePreview(); as s) {
        <app-modal
          title="Share to {{ sharePlatform() === 'twitter' ? 'Twitter / X' : 'LinkedIn' }}"
          subtitle="Customize the message before posting."
          size="md"
          (closed)="closeShare()"
        >
          <div class="space-y-3">
            @if (sharePlatform() === 'twitter') {
              <p class="flex items-start gap-1.5 text-xs text-muted">
                <app-icon
                  [name]="s.twitter.apiAvailable ? 'check-circle' : 'info'"
                  [size]="12"
                  [strokeWidth]="2"
                  [class.text-signal-green]="s.twitter.apiAvailable"
                  class="mt-0.5 shrink-0"
                />
                <span>
                  @if (s.twitter.apiAvailable) {
                    API configured — will post directly.
                  } @else {
                    API not configured — will open Twitter with pre-filled text.
                  }
                </span>
              </p>
            } @else {
              <p class="flex items-start gap-1.5 text-xs text-muted">
                <app-icon name="info" [size]="12" [strokeWidth]="2" class="mt-0.5 shrink-0" />
                <span>LinkedIn doesn't allow direct posting — will open the share dialog in a new tab.</span>
              </p>
            }

            <textarea
              [(ngModel)]="customText"
              rows="4"
              class="input text-sm"
              aria-label="Share text"
            ></textarea>

            @if (shareResult(); as r) {
              <div
                class="rounded-lg border p-3 text-xs"
                [ngClass]="{
                  'border-signal-green/30': r.posted,
                  'bg-signal-green/[0.06]': r.posted,
                  'border-signal-amber/30': !r.posted,
                  'bg-signal-amber/[0.06]': !r.posted
                }"
              >
                @if (r.posted) {
                  <p class="flex items-center gap-1.5 font-medium text-signal-green">
                    <app-icon name="check-circle" [size]="12" [strokeWidth]="2" />
                    Posted!
                    @if (r.tweetId) {
                      <span class="font-mono text-muted"> · {{ r.tweetId }}</span>
                    }
                  </p>
                } @else {
                  <p class="flex items-center gap-1.5 font-medium text-signal-amber">
                    <app-icon name="info" [size]="12" [strokeWidth]="2" />
                    Intent opened — complete sharing in the new tab.
                  </p>
                }
              </div>
            }
          </div>

          <div modal-footer>
            <button type="button" (click)="closeShare()" class="btn-secondary">Close</button>
            <button type="button" (click)="doShare()" [disabled]="sharing()" class="btn-primary">
              @if (sharing()) {
                <app-icon name="loader" [size]="13" [strokeWidth]="2.5" class="animate-spin" />
              } @else {
                <app-icon name="share" [size]="13" [strokeWidth]="2" />
              }
              <span>
                {{ sharing() ? 'Sharing…' : (sharePlatform() === 'twitter' && sharePreview()!.twitter.apiAvailable ? 'Post tweet' : 'Open share intent') }}
              </span>
            </button>
          </div>
        </app-modal>
      }
    </div>
  `,
})
export class AdminAnnouncementsComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly social = inject(SocialApiService);
  private readonly toast = inject(ToastService);

  readonly items = signal<Announcement[]>([]);
  readonly loading = signal(true);

  readonly showCreate = signal(false);
  newTitle = '';
  newContent = '';
  readonly creating = signal(false);
  readonly createError = signal<string | null>(null);

  readonly sharePreview = signal<ShareIntents | null>(null);
  readonly sharePlatform = signal<'twitter' | 'linkedin'>('twitter');
  readonly shareAnnouncementId = signal<string | null>(null);
  customText = '';
  readonly sharing = signal(false);
  readonly shareResult = signal<ShareResult | null>(null);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.http
      .get<Announcement[]>(`${environment.apiUrl}/api/community/announcements?limit=50`)
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
          this.toast.success('Announcement published');
          this.load();
        },
        error: (err) => {
          this.creating.set(false);
          this.createError.set(err?.error?.message ?? 'Failed to publish');
        },
      });
  }

  shareTo(platform: 'twitter' | 'linkedin', a: Announcement): void {
    this.shareAnnouncementId.set(a.id);
    this.sharePlatform.set(platform);
    this.shareResult.set(null);

    this.social.getIntents(a.id).subscribe({
      next: (s) => {
        this.customText = s.defaultText;
        this.sharePreview.set(s);
      },
      error: () => this.toast.error('Failed to load share intent'),
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
        } else {
          this.toast.success('Posted successfully');
        }
      },
      error: () => {
        this.sharing.set(false);
        this.toast.error('Share failed');
      },
    });
  }
}