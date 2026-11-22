import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  ModerationApiService,
  type ModerationFlag,
} from '../../core/admin/moderation.service';
import { IconComponent } from '../../shared/ui/icon/icon.component';
import { ModalComponent } from '../../shared/ui/modal/modal.component';
import { ConfirmDialogService } from '../../shared/ui/confirm/confirm-dialog.service';
import { ToastService } from '../../shared/ui/toast/toast.service';

type Status = 'pending' | 'dismissed' | 'actioned';
type ModerationAction = 'dismiss' | 'hide' | 'restore' | 'remove';

interface ActionMeta {
  label: string;
  title: string;
  confirmText: string;
  requiresReason: boolean;
  variant: 'default' | 'danger';
}

const ACTION_META: Record<ModerationAction, ActionMeta> = {
  dismiss: {
    label: 'Dismiss',
    title: 'Dismiss report',
    confirmText: 'Dismiss',
    requiresReason: false,
    variant: 'default',
  },
  hide: {
    label: 'Hide content',
    title: 'Hide content',
    confirmText: 'Hide',
    requiresReason: true,
    variant: 'default',
  },
  restore: {
    label: 'Restore content',
    title: 'Restore content',
    confirmText: 'Restore',
    requiresReason: false,
    variant: 'default',
  },
  remove: {
    label: 'Remove content',
    title: 'Remove content',
    confirmText: 'Remove',
    requiresReason: true,
    variant: 'danger',
  },
};

@Component({
  selector: 'app-admin-moderation',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, IconComponent, ModalComponent],
  template: `
    <div class="space-y-4">
      <div class="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 class="text-2xl font-bold tracking-tighter text-foreground">Moderation queue</h1>
          <p class="mt-1 text-sm text-muted">Reported posts and replies awaiting review</p>
        </div>
        <button type="button" (click)="load()" [disabled]="loading()" class="btn-secondary self-start">
          <app-icon name="refresh" [size]="12" [strokeWidth]="2.5" [class.animate-spin]="loading()" />
          <span>Refresh</span>
        </button>
      </div>

      <!-- Status tabs -->
      <div class="-mx-4 overflow-x-auto border-b border-hairline px-4 sm:mx-0 sm:px-0">
        <div class="flex min-w-max gap-1">
          @for (s of statuses; track s.value) {
            <button
              type="button"
              (click)="setStatus(s.value)"
              class="border-b-2 px-3 py-2.5 text-sm font-medium transition-colors"
              [class.border-relay-violet]="statusFilter() === s.value"
              [class.text-foreground]="statusFilter() === s.value"
              [class.border-transparent]="statusFilter() !== s.value"
              [class.text-muted]="statusFilter() !== s.value"
              [class.hover:text-foreground]="statusFilter() !== s.value"
            >
              {{ s.label }}
            </button>
          }
        </div>
      </div>

      @if (loading() && flags().length === 0) {
        <div class="space-y-2">
          @for (i of [1, 2, 3]; track i) {
            <div class="card">
              <div class="skeleton h-4 w-24"></div>
              <div class="skeleton mt-2 h-3 w-48"></div>
              <div class="skeleton mt-3 h-20 w-full"></div>
            </div>
          }
        </div>
      } @else if (flags().length === 0) {
        <div class="card flex flex-col items-center justify-center py-12 text-center">
          <div class="flex h-12 w-12 items-center justify-center rounded-xl border border-signal-green/30 bg-signal-green/10 text-signal-green">
            <app-icon name="check-circle" [size]="22" [strokeWidth]="1.75" />
          </div>
          <p class="mt-3 text-sm font-medium text-foreground">All clear</p>
          <p class="mt-1 text-xs text-muted">No {{ statusFilter() }} flags.</p>
        </div>
      } @else {
        <div class="space-y-2">
          @for (f of flags(); track f.id) {
            <div class="card">
              <div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div class="min-w-0">
                  <div class="flex flex-wrap items-center gap-1.5">
                    <span class="badge badge-warning font-mono">{{ f.reason }}</span>
                    <span class="text-[11px] text-muted-2">{{ f.createdAt | date: 'short' }}</span>
                    @if (f.post?.autoHidden) {
                      <span class="badge badge-danger">Auto-hidden</span>
                    }
                  </div>
                  <p class="mt-1 text-xs text-muted">
                    Reported by
                    <span class="text-foreground">{{ f.reporter?.name || f.reporter?.email || 'unknown' }}</span>
                  </p>
                </div>
              </div>

              @if (f.detail) {
                <p class="mt-2 rounded-md border-s-2 border-signal-amber/40 bg-surface-2/50 px-2.5 py-1.5 text-xs italic text-muted">
                  "{{ f.detail }}"
                </p>
              }

              @if (f.post) {
                <div class="mt-3 rounded-lg border border-hairline bg-surface-2 p-3">
                  <p class="text-[10px] font-medium uppercase tracking-wider text-muted-2">
                    Post by {{ f.post.authorName || 'unknown' }} · {{ f.post.status }}
                  </p>
                  <a
                    [routerLink]="['/community', f.post.slug]"
                    class="mt-1 block text-sm font-medium text-foreground transition-colors hover:text-relay-cyan"
                  >
                    {{ f.post.title }}
                  </a>
                  <p class="mt-1 line-clamp-3 text-xs text-muted">{{ f.post.content }}</p>
                </div>
              }

              @if (f.reply) {
                <div class="mt-3 rounded-lg border border-hairline bg-surface-2 p-3">
                  <p class="text-[10px] font-medium uppercase tracking-wider text-muted-2">
                    Reply by {{ f.reply.authorName || 'unknown' }}
                  </p>
                  <p class="mt-1 line-clamp-3 text-xs text-foreground">{{ f.reply.content }}</p>
                </div>
              }

              @if (statusFilter() === 'pending') {
                <div class="mt-3 flex flex-wrap gap-1.5">
                  <button type="button" (click)="openAction('dismiss', f)" class="btn-secondary text-xs">
                    {{ ACTION_META.dismiss.label }}
                  </button>
                  @if (f.post) {
                    <button type="button" (click)="openAction('hide', f)" class="btn-secondary text-xs text-signal-amber">
                      {{ ACTION_META.hide.label }}
                    </button>
                    <button type="button" (click)="openAction('restore', f)" class="btn-secondary text-xs text-signal-green">
                      {{ ACTION_META.restore.label }}
                    </button>
                  }
                  <button type="button" (click)="openAction('remove', f)" class="btn-secondary text-xs text-signal-rose">
                    {{ ACTION_META.remove.label }}
                  </button>
                </div>
              }
            </div>
          }
        </div>
      }

      <!-- ═══ Action modal ═══ -->
      @if (pendingAction(); as pa) {
        <app-modal
          title="{{ ACTION_META[pa.action].title }}"
          subtitle="Optional: add a reason (sent to the reporter + logged in audit trail)."
          size="md"
          (closed)="closeAction()"
        >
          <div class="space-y-3">
            <div>
              <label for="mod-reason" class="label">
                Reason
                @if (!ACTION_META[pa.action].requiresReason) {
                  <span class="font-normal normal-case text-muted-2">(optional)</span>
                }
              </label>
              <textarea
                id="mod-reason"
                [(ngModel)]="reasonInput"
                rows="3"
                class="input text-sm"
                placeholder="e.g. Violates community guidelines — self-promotion"
              ></textarea>
            </div>

            @if (ACTION_META[pa.action].requiresReason && !reasonInput.trim()) {
              <p class="text-xs text-signal-rose">A reason is required for this action.</p>
            }
          </div>

          <div modal-footer>
            <button type="button" (click)="closeAction()" class="btn-secondary">
              Cancel
            </button>
            <button
              type="button"
              [class.btn-danger]="ACTION_META[pa.action].variant === 'danger'"
              [class.btn-primary]="ACTION_META[pa.action].variant !== 'danger'"
              [disabled]="submitting() || (ACTION_META[pa.action].requiresReason && !reasonInput.trim())"
              (click)="submitAction()"
            >
              @if (submitting()) {
                <app-icon name="loader" [size]="13" [strokeWidth]="2.5" class="animate-spin" />
              }
              <span>{{ ACTION_META[pa.action].confirmText }}</span>
            </button>
          </div>
        </app-modal>
      }
    </div>
  `,
})
export class AdminModerationComponent implements OnInit {
  private readonly api = inject(ModerationApiService);
  private readonly toast = inject(ToastService);

  readonly ACTION_META = ACTION_META;

  readonly statuses: Array<{ value: Status; label: string }> = [
    { value: 'pending', label: 'Pending' },
    { value: 'dismissed', label: 'Dismissed' },
    { value: 'actioned', label: 'Actioned' },
  ];

  readonly flags = signal<ModerationFlag[]>([]);
  readonly statusFilter = signal<Status>('pending');
  readonly loading = signal(true);

  readonly pendingAction = signal<{ action: ModerationAction; flag: ModerationFlag } | null>(null);
  readonly submitting = signal(false);
  reasonInput = '';

  ngOnInit(): void {
    this.load();
  }

  setStatus(s: Status): void {
    this.statusFilter.set(s);
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.api.listFlags(this.statusFilter()).subscribe({
      next: (r) => {
        this.flags.set(r.items);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  openAction(action: ModerationAction, flag: ModerationFlag): void {
    this.reasonInput = '';
    this.pendingAction.set({ action, flag });
  }

  closeAction(): void {
    if (!this.submitting()) this.pendingAction.set(null);
  }

  submitAction(): void {
    const pa = this.pendingAction();
    if (!pa || this.submitting()) return;

    const meta = ACTION_META[pa.action];
    const reason = this.reasonInput.trim() || undefined;

    if (meta.requiresReason && !reason) return;

    this.submitting.set(true);

    const finish = (success: boolean, message: string): void => {
      this.submitting.set(false);
      if (success) {
        this.toast.success(message);
        this.pendingAction.set(null);
        this.load();
      } else {
        this.toast.error('Action failed');
      }
    };

    switch (pa.action) {
      case 'dismiss':
        this.api.resolveFlag(pa.flag.id, 'dismiss', reason).subscribe({
          next: () => finish(true, 'Report dismissed'),
          error: () => finish(false, 'Failed'),
        });
        break;

      case 'hide':
        if (!pa.flag.post) return finish(false, 'No post');
        this.api.hidePost(pa.flag.post.id, reason).subscribe({
          next: () => finish(true, 'Content hidden'),
          error: () => finish(false, 'Failed'),
        });
        break;

      case 'restore':
        if (!pa.flag.post) return finish(false, 'No post');
        this.api.restorePost(pa.flag.post.id, reason).subscribe({
          next: () => finish(true, 'Content restored'),
          error: () => finish(false, 'Failed'),
        });
        break;

      case 'remove':
        if (pa.flag.post) {
          this.api.removePost(pa.flag.post.id, reason).subscribe({
            next: () => finish(true, 'Content removed'),
            error: () => finish(false, 'Failed'),
          });
        } else if (pa.flag.reply) {
          this.api.resolveFlag(pa.flag.id, 'action', reason).subscribe({
            next: () => finish(true, 'Reply removed'),
            error: () => finish(false, 'Failed'),
          });
        } else {
          finish(false, 'No content');
        }
        break;
    }
  }
}