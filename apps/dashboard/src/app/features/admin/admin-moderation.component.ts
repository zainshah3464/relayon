import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import {
  ModerationApiService,
  type ModerationFlag,
} from '../../core/admin/moderation.service';

@Component({
  selector: 'app-admin-moderation',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="space-y-6">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold text-white">Moderation queue</h1>
          <p class="text-sm text-muted mt-1">
            Reported posts and replies awaiting review
          </p>
        </div>
        <button (click)="load()" class="btn-secondary text-xs">Refresh</button>
      </div>

      <div class="flex gap-1 border-b border-hairline">
        @for (s of statuses; track s.value) {
          <button
            (click)="setStatus(s.value)"
            class="px-4 py-2 text-sm border-b-2 -mb-px"
            [class.border-relay-violet]="statusFilter() === s.value"
            [class.text-white]="statusFilter() === s.value"
            [class.text-muted]="statusFilter() !== s.value"
            [class.border-transparent]="statusFilter() !== s.value"
          >{{ s.label }}</button>
        }
      </div>

      @if (loading()) {
        <div class="card text-sm text-muted">Loading flags...</div>
      } @else if (flags().length === 0) {
        <div class="card text-center py-12">
          <div class="text-3xl mb-2">✅</div>
          <p class="text-sm text-muted">
            No {{ statusFilter() }} flags. All clear.
          </p>
        </div>
      } @else {
        <div class="space-y-2">
          @for (f of flags(); track f.id) {
            <div class="card">
              <div class="flex justify-between items-start mb-2">
                <div>
                  <div class="flex items-center gap-2 flex-wrap">
                    <span class="text-xs px-2 py-0.5 rounded bg-signal-amber/20 text-signal-amber font-mono">{{ f.reason }}</span>
                    <span class="text-xs text-muted">{{ f.createdAt | date: 'short' }}</span>
                    @if (f.post?.autoHidden) {
                      <span class="text-xs px-2 py-0.5 rounded bg-signal-rose/20 text-signal-rose">AUTO-HIDDEN</span>
                    }
                  </div>
                  <p class="text-xs text-muted mt-1">
                    Reported by
                    {{ f.reporter?.name || f.reporter?.email || 'unknown' }}
                  </p>
                </div>
              </div>

              @if (f.detail) {
                <p class="text-xs text-muted italic mt-1">"{{ f.detail }}"</p>
              }

              @if (f.post) {
                <div class="mt-3 rounded-lg border border-hairline bg-surface-2 p-3">
                  <p class="text-xs text-muted mb-1">
                    Post: {{ f.post.authorName || 'unknown' }} · {{ f.post.status }}
                  </p>
                  <a
                    [routerLink]="['/community', f.post.slug]"
                    class="text-sm text-white font-medium hover:underline"
                  >
                    {{ f.post.title }}
                  </a>
                  <p class="text-xs text-muted mt-1 line-clamp-3">{{ f.post.content }}</p>
                </div>
              }

              @if (f.reply) {
                <div class="mt-3 rounded-lg border border-hairline bg-surface-2 p-3">
                  <p class="text-xs text-muted mb-1">
                    Reply by {{ f.reply.authorName || 'unknown' }}
                  </p>
                  <p class="text-xs text-white line-clamp-3">{{ f.reply.content }}</p>
                </div>
              }

              @if (statusFilter() === 'pending') {
                <div class="flex gap-2 mt-3">
                  <button (click)="dismiss(f)" class="btn-secondary text-xs">Dismiss</button>
                  @if (f.post) {
                    <button (click)="hide(f)" class="btn-secondary text-xs text-signal-amber">Hide content</button>
                    <button (click)="restore(f)" class="btn-secondary text-xs text-signal-green">Restore</button>
                  }
                  <button (click)="remove(f)" class="btn-secondary text-xs text-signal-rose">Remove content</button>
                </div>
              }
            </div>
          }
        </div>
      }
    </div>
  `,
})
export class AdminModerationComponent implements OnInit {
  private api = inject(ModerationApiService);

  readonly statuses = [
    { value: 'pending', label: 'Pending' },
    { value: 'dismissed', label: 'Dismissed' },
    { value: 'actioned', label: 'Actioned' },
  ];

  flags = signal<ModerationFlag[]>([]);
  statusFilter = signal<string>('pending');
  loading = signal(true);

  ngOnInit(): void {
    this.load();
  }

  setStatus(s: string): void {
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

  dismiss(f: ModerationFlag): void {
    const reason = prompt('Reason (optional):') || undefined;
    this.api
      .resolveFlag(f.id, 'dismiss', reason)
      .subscribe({ next: () => this.load() });
  }

  hide(f: ModerationFlag): void {
    if (!f.post) return;
    const reason = prompt('Reason:') || undefined;
    this.api.hidePost(f.post.id, reason).subscribe({ next: () => this.load() });
  }

  restore(f: ModerationFlag): void {
    if (!f.post) return;
    const reason = prompt('Reason (optional):') || undefined;
    this.api
      .restorePost(f.post.id, reason)
      .subscribe({ next: () => this.load() });
  }

  remove(f: ModerationFlag): void {
    if (!confirm('Permanently remove this content? This cannot be undone.')) return;
    const reason = prompt('Reason:') || undefined;
    if (f.post) {
      this.api.removePost(f.post.id, reason).subscribe({ next: () => this.load() });
    } else if (f.reply) {
      this.api
        .resolveFlag(f.id, 'action', reason)
        .subscribe({ next: () => this.load() });
    }
  }
}