import {
  Component,
  inject,
  signal,
  input,
  OnInit,
  ElementRef,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MarkdownComponent } from 'ngx-markdown';
import {
  CommunityApiService,
  type CommunityPostDetail,
} from '../../core/community/community.service';
import { AuthService } from '../../core/auth/auth.service';
import { IconComponent } from '../../shared/ui/icon/icon.component';
import { ModalComponent } from '../../shared/ui/modal/modal.component';
import { ConfirmDialogService } from '../../shared/ui/confirm/confirm-dialog.service';
import { ToastService } from '../../shared/ui/toast/toast.service';

type FlagReason = 'spam' | 'abuse' | 'off-topic' | 'other';

interface FlagOption {
  value: FlagReason;
  label: string;
  desc: string;
}

@Component({
  selector: 'app-post-detail',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    MarkdownComponent,
    IconComponent,
    ModalComponent,
  ],
  template: `
    <!-- ═══════════ LOADING ═══════════ -->
    @if (loading()) {
      <div class="mx-auto max-w-4xl space-y-4">
        <div class="skeleton h-3 w-32"></div>
        <div class="card">
          <div class="skeleton h-5 w-24"></div>
          <div class="skeleton mt-3 h-7 w-3/4"></div>
          <div class="skeleton mt-3 h-3 w-1/2"></div>
          <div class="skeleton mt-4 h-9 w-40"></div>
        </div>
        <div class="card">
          <div class="skeleton h-3 w-full"></div>
          <div class="skeleton mt-2 h-3 w-full"></div>
          <div class="skeleton mt-2 h-3 w-5/6"></div>
        </div>
      </div>
    } @else if (post()) {
      @if (post(); as p) {
        <div class="mx-auto max-w-4xl space-y-4">
          <!-- ═══════════ BACK LINK ═══════════ -->
          <a
            routerLink="/community"
            class="inline-flex items-center gap-1 text-xs text-muted transition-colors hover:text-foreground"
          >
            <app-icon name="arrow-left" [size]="12" [strokeWidth]="2.5" />
            <span>Back to community</span>
          </a>

          <!-- ═══════════ POST HEADER ═══════════ -->
          <article class="card">
            <div class="flex flex-wrap items-center gap-1.5">
              <span [ngClass]="typeBadgeClass(p.type)">
                <app-icon [name]="typeIcon(p.type)" [size]="9" [strokeWidth]="2.5" />
                {{ p.type }}
              </span>
              @if (p.isOfficial) {
                <span class="badge badge-warning">Official</span>
              }
              @if (p.isPinned) {
                <span class="badge badge-info">
                  <app-icon name="pin" [size]="9" [strokeWidth]="2.5" />
                  Pinned
                </span>
              }
            </div>

            <h1 class="mt-3 text-2xl font-bold leading-tight tracking-tight text-foreground sm:text-3xl">
              {{ p.title }}
            </h1>

            <div class="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
              <div class="flex items-center gap-2">
                <div class="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-relay-violet to-relay-cyan text-[10px] font-semibold text-white">
                  {{ initial(p.author?.name) }}
                </div>
                <span class="font-medium text-foreground">{{ p.author?.name || 'Relayon' }}</span>
                @if (p.tenant) {
                  <span class="text-muted-2">·</span>
                  <span>{{ p.tenant.name }}</span>
                }
              </div>
              <span class="text-muted-2">·</span>
              <span>{{ p.createdAt | date: 'medium' }}</span>
              <span class="text-muted-2">·</span>
              <span class="flex items-center gap-1">
                <app-icon name="eye" [size]="11" [strokeWidth]="2" />
                {{ p.viewCount }}
              </span>
            </div>

            <!-- Tags -->
            @if (p.tags && p.tags.length > 0) {
              <div class="mt-3 flex flex-wrap gap-1">
                @for (tag of p.tags; track tag) {
                  <span class="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] text-muted">
                    {{ tag }}
                  </span>
                }
              </div>
            }

            <!-- Actions -->
            <div class="mt-4 flex flex-wrap items-center gap-1.5 border-t border-hairline pt-3">
              <button
                type="button"
                (click)="like()"
                class="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors"
                [ngClass]="{
                  'bg-signal-rose/10': p.hasLiked,
                  'text-signal-rose': p.hasLiked,
                  'text-muted': !p.hasLiked,
                  'hover:bg-surface-2': !p.hasLiked
                }"
              >
                <app-icon
                  name="heart"
                  [size]="13"
                  [strokeWidth]="2"
                  [class.fill-current]="p.hasLiked"
                />
                <span class="tabular-nums">{{ p.likeCount }}</span>
              </button>

              @if (p.type === 'template') {
                <button
                  type="button"
                  (click)="openImport(p.id)"
                  class="btn-primary text-xs"
                >
                  <app-icon name="download" [size]="12" [strokeWidth]="2.5" />
                  <span>Use this template</span>
                </button>
              }

              <button
                type="button"
                (click)="openFlag()"
                class="ml-auto flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-muted transition-colors hover:bg-signal-rose/10 hover:text-signal-rose"
              >
                <app-icon name="flag" [size]="12" [strokeWidth]="2" />
                <span>Report</span>
              </button>
            </div>
          </article>

          <!-- ═══════════ POST CONTENT ═══════════ -->
          <div class="card prose prose-invert max-w-none">
            <markdown [data]="p.content" />
          </div>

          <!-- ═══════════ REPLIES ═══════════ -->
          <div>
            <h2 class="flex items-center gap-2 text-lg font-semibold text-foreground">
              <app-icon name="message-circle" [size]="16" [strokeWidth]="2" class="text-muted" />
              Replies
              <span class="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-xs text-muted">
                {{ p.replies.length }}
              </span>
            </h2>

            @if (p.replies.length === 0) {
              <div class="card mt-3 flex flex-col items-center justify-center py-10 text-center">
                <div class="flex h-12 w-12 items-center justify-center rounded-xl border border-hairline bg-surface-2 text-muted">
                  <app-icon name="message-circle" [size]="22" [strokeWidth]="1.75" />
                </div>
                <p class="mt-3 text-sm font-medium text-foreground">No replies yet</p>
                <p class="mt-1 text-xs text-muted">Be the first to respond.</p>
              </div>
            } @else {
              <div class="mt-3 space-y-2">
                @for (r of p.replies; track r.id) {
                  <div
                    class="card"
                    [ngClass]="{
                      'ms-4': r.parentId,
                      'sm:ms-8': r.parentId,
                      'border-signal-green/30': r.isSolution,
                      'bg-signal-green/[0.03]': r.isSolution
                    }"
                  >
                    <div class="flex items-start gap-2.5">
                      <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-relay-violet to-relay-cyan text-[11px] font-semibold text-white">
                        {{ initial(r.author.name) }}
                      </div>

                      <div class="min-w-0 flex-1">
                        <div class="flex flex-wrap items-center gap-1.5">
                          <span class="text-sm font-medium text-foreground">
                            {{ r.author.name }}
                          </span>
                          @if (r.isSolution) {
                            <span class="badge badge-success">
                              <app-icon name="check-circle" [size]="9" [strokeWidth]="2.5" />
                              Solution
                            </span>
                          }
                          <span class="text-[11px] text-muted-2">{{ r.createdAt | date: 'short' }}</span>
                        </div>

                        <div class="prose prose-invert mt-2 max-w-none text-sm">
                          <markdown [data]="r.content" />
                        </div>

                        <div class="mt-2 flex flex-wrap items-center gap-1">
                          <button
                            type="button"
                            (click)="likeReply(r.id)"
                            class="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors"
                            [class.text-signal-rose]="r.hasLiked"
                            [class.text-muted]="!r.hasLiked"
                            [class.hover:bg-surface-2]="!r.hasLiked"
                          >
                            <app-icon
                              name="heart"
                              [size]="11"
                              [strokeWidth]="2"
                              [class.fill-current]="r.hasLiked"
                            />
                            <span class="tabular-nums">{{ r.likeCount }}</span>
                          </button>

                          <button
                            type="button"
                            (click)="replyTo(r.id)"
                            class="rounded-md px-2 py-1 text-xs font-medium text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
                          >
                            Reply
                          </button>

                          @if (canMarkSolution() && !r.isSolution) {
                            <button
                              type="button"
                              (click)="markSolution(r.id)"
                              class="ml-auto rounded-md px-2 py-1 text-xs font-medium text-signal-green transition-colors hover:bg-signal-green/10"
                            >
                              <app-icon name="check" [size]="11" [strokeWidth]="2.5" class="mr-0.5 inline" />
                              Mark as solution
                            </button>
                          }
                        </div>
                      </div>
                    </div>
                  </div>
                }
              </div>
            }

            <!-- ═══════════ REPLY BOX ═══════════ -->
            <div class="card mt-4">
              <div class="flex items-center gap-2">
                <div class="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-relay-violet to-relay-cyan text-[11px] font-semibold text-white">
                  {{ initial(auth.displayName()) }}
                </div>
                <div class="min-w-0 flex-1">
                  @if (replyToId()) {
                    <p class="flex items-center gap-1.5 text-xs text-muted">
                      Replying to a comment
                      <button
                        type="button"
                        (click)="cancelReply()"
                        class="text-relay-cyan hover:underline"
                      >
                        Cancel
                      </button>
                    </p>
                  } @else {
                    <p class="text-xs font-medium text-foreground">Write a reply</p>
                  }
                </div>
              </div>

              <textarea
                #replyTextarea
                [(ngModel)]="replyContent"
                rows="3"
                class="input mt-3 font-mono text-sm"
                placeholder="Markdown supported…"
              ></textarea>

              <div class="mt-2 flex items-center justify-between">
                <p class="text-[11px] text-muted-2">
                  <app-icon name="sparkles" [size]="10" [strokeWidth]="2" class="mr-0.5 inline" />
                  Markdown supported
                </p>
                <button
                  type="button"
                  (click)="submitReply()"
                  [disabled]="!replyContent.trim() || submitting()"
                  class="btn-primary text-xs"
                >
                  @if (submitting()) {
                    <app-icon name="loader" [size]="12" [strokeWidth]="2.5" class="animate-spin" />
                  } @else {
                    <app-icon name="send" [size]="12" [strokeWidth]="2.5" />
                  }
                  <span>{{ submitting() ? 'Posting…' : 'Post reply' }}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      }
    }

    <!-- ═══════════ IMPORT TEMPLATE MODAL ═══════════ -->
    @if (importPreview(); as imp) {
      <app-modal
        title="Import template"
        subtitle="Fill in the placeholders to create a workflow from this template."
        size="lg"
        (closed)="closeImport()"
      >
        <div class="space-y-3">
          @for (ph of imp.placeholders; track ph) {
            <div>
              <label [for]="'ph-' + ph" class="label font-mono text-xs">{{ ph }}</label>
              <input
                [id]="'ph-' + ph"
                [value]="placeholderValues()[ph] || ''"
                (input)="setPlaceholder(ph, $any($event.target).value)"
                class="input font-mono text-sm"
                placeholder="Paste your value…"
                autocomplete="off"
              />
            </div>
          }
          @if (imp.placeholders.length === 0) {
            <p class="text-sm text-muted">
              No configuration needed — you can import this template as-is.
            </p>
          }

          @if (importError()) {
            <div class="flex items-start gap-2.5 rounded-lg border border-signal-rose/30 bg-signal-rose/10 px-3 py-2.5 text-sm text-signal-rose">
              <app-icon name="alert-circle" [size]="16" [strokeWidth]="2" class="mt-0.5 shrink-0" />
              <span>{{ importError() }}</span>
            </div>
          }
        </div>

        <div modal-footer>
          <button type="button" (click)="closeImport()" class="btn-secondary">
            Cancel
          </button>
          <button
            type="button"
            (click)="submitImport()"
            [disabled]="importing()"
            class="btn-primary"
          >
            @if (importing()) {
              <app-icon name="loader" [size]="13" [strokeWidth]="2.5" class="animate-spin" />
            } @else {
              <app-icon name="download" [size]="13" [strokeWidth]="2.5" />
            }
            <span>{{ importing() ? 'Importing…' : 'Import workflow' }}</span>
          </button>
        </div>
      </app-modal>
    }

    <!-- ═══════════ FLAG MODAL ═══════════ -->
    @if (showFlag()) {
      <app-modal
        title="Report this post"
        subtitle="Help keep the community safe — tell us why."
        size="sm"
        (closed)="closeFlag()"
      >
        <div class="space-y-1.5">
          @for (opt of flagOptions; track opt.value) {
            <button
              type="button"
              (click)="selectedReason.set(opt.value)"
              class="flex w-full items-start gap-2.5 rounded-lg border p-3 text-left transition-colors"
              [ngClass]="{
                'border-relay-violet': selectedReason() === opt.value,
                'bg-relay-violet/[0.06]': selectedReason() === opt.value,
                'border-hairline': selectedReason() !== opt.value,
                'hover:border-hairline-strong': selectedReason() !== opt.value
              }"
            >
              <app-icon
                [name]="selectedReason() === opt.value ? 'check-circle' : 'circle'"
                [size]="14"
                [strokeWidth]="2"
                [class.text-relay-violet]="selectedReason() === opt.value"
                [class.text-muted-2]="selectedReason() !== opt.value"
                class="mt-0.5 shrink-0"
              />
              <div class="min-w-0">
                <p class="text-sm font-medium text-foreground">{{ opt.label }}</p>
                <p class="mt-0.5 text-[11px] text-muted">{{ opt.desc }}</p>
              </div>
            </button>
          }
        </div>

        <div modal-footer>
          <button type="button" (click)="closeFlag()" class="btn-secondary">
            Cancel
          </button>
          <button
            type="button"
            (click)="submitFlag()"
            [disabled]="!selectedReason() || flagging()"
            class="btn-danger"
          >
            @if (flagging()) {
              <app-icon name="loader" [size]="13" [strokeWidth]="2.5" class="animate-spin" />
            }
            <span>{{ flagging() ? 'Reporting…' : 'Report post' }}</span>
          </button>
        </div>
      </app-modal>
    }
  `,
})
export class PostDetailComponent implements OnInit {
  readonly slug = input.required<string>();

  private readonly api = inject(CommunityApiService);
  readonly auth = inject(AuthService);
  private readonly confirm = inject(ConfirmDialogService);
  private readonly toast = inject(ToastService);

  @ViewChild('replyTextarea')
  replyTextarea?: ElementRef<HTMLTextAreaElement>;

  readonly post = signal<CommunityPostDetail | null>(null);
  readonly loading = signal(true);
  readonly submitting = signal(false);
  readonly replyToId = signal<string | null>(null);
  replyContent = '';

  readonly importPreview = signal<{ yaml: string; placeholders: string[] } | null>(null);
  readonly placeholderValues = signal<Record<string, string>>({});
  readonly importError = signal<string | null>(null);
  readonly importing = signal(false);

  readonly showFlag = signal(false);
  readonly selectedReason = signal<FlagReason | null>(null);
  readonly flagging = signal(false);

  readonly flagOptions: FlagOption[] = [
    { value: 'spam', label: 'Spam', desc: 'Unsolicited promotion or repetitive content' },
    { value: 'abuse', label: 'Abuse', desc: 'Harassment, hate speech, or threats' },
    { value: 'off-topic', label: 'Off-topic', desc: 'Unrelated to webhooks or Relayon' },
    { value: 'other', label: 'Other', desc: 'Something else that needs review' },
  ];

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

  initial(name?: string): string {
    if (!name) return '?';
    return name[0]!.toUpperCase();
  }

  typeIcon(type: string): 'code' | 'file-text' | 'message-square' {
    if (type === 'template') return 'code';
    if (type === 'article') return 'file-text';
    return 'message-square';
  }

  typeBadgeClass(type: string): string {
    const base =
      'inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-[10px] font-medium';
    if (type === 'template') return `${base} bg-relay-violet/15 text-relay-violet`;
    if (type === 'article') return `${base} bg-info/15 text-info`;
    return `${base} bg-surface-3 text-muted`;
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
      error: () => this.toast.error('Failed to like post'),
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
      error: () => this.toast.error('Failed to like reply'),
    });
  }

  replyTo(id: string): void {
    this.replyToId.set(id);
    setTimeout(() => this.replyTextarea?.nativeElement?.focus(), 0);
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
          this.toast.success('Reply posted');
          this.load();
        },
        error: () => {
          this.submitting.set(false);
          this.toast.error('Failed to post reply');
        },
      });
  }

  async markSolution(id: string): Promise<void> {
    const ok = await this.confirm.confirm({
      title: 'Mark as solution',
      message:
        'This will mark the reply as the accepted solution. You can change it later.',
      confirmText: 'Mark as solution',
      variant: 'default',
      icon: 'info',
    });
    if (!ok) return;

    this.api.markSolution(id).subscribe({
      next: () => {
        this.toast.success('Marked as solution');
        this.load();
      },
      error: () => this.toast.error('Failed to mark solution'),
    });
  }

  openFlag(): void {
    this.selectedReason.set(null);
    this.showFlag.set(true);
  }

  closeFlag(): void {
    if (!this.flagging()) this.showFlag.set(false);
  }

  submitFlag(): void {
    const p = this.post();
    const reason = this.selectedReason();
    if (!p || !reason || this.flagging()) return;

    this.flagging.set(true);
    this.api.flag({ postId: p.id, reason }).subscribe({
      next: () => {
        this.flagging.set(false);
        this.showFlag.set(false);
        this.toast.success('Report submitted — thank you');
      },
      error: () => {
        this.flagging.set(false);
        this.toast.error('Failed to submit report');
      },
    });
  }

  openImport(postId: string): void {
    this.importError.set(null);
    this.placeholderValues.set({});
    this.api.previewTemplate(postId).subscribe({
      next: (r) => this.importPreview.set(r),
      error: (err) =>
        this.toast.error(err?.error?.message ?? 'Failed to load template'),
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
        this.toast.success('Template imported');
        if (typeof window !== 'undefined') {
          window.location.href = `/workflows/${r.workflowId}`;
        }
      },
      error: (err) => {
        this.importing.set(false);
        this.importError.set(err?.error?.message ?? 'Import failed');
      },
    });
  }
}