import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import {
  CommunityApiService,
  type CommunityPostSummary,
} from '../../core/community/community.service';

type Tab = 'all' | 'discussion' | 'template' | 'article';

@Component({
  selector: 'app-community-list',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  template: `
    <div class="space-y-6">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold text-white">Community</h1>
          <p class="text-sm text-muted mt-1">Share workflows, ask questions, learn from others</p>
        </div>
        <a routerLink="/community/new" class="btn-primary text-sm">+ New post</a>
      </div>

      <div class="flex gap-1 border-b border-hairline">
        @for (t of tabs; track t.value) {
          <button
            (click)="setTab(t.value)"
            class="px-4 py-2 text-sm border-b-2 -mb-px"
            [class.border-relay-violet]="tab() === t.value"
            [class.text-white]="tab() === t.value"
            [class.text-muted]="tab() !== t.value"
            [class.border-transparent]="tab() !== t.value"
          >{{ t.label }}</button>
        }
      </div>

      <div class="flex gap-2">
        <input [(ngModel)]="search" (input)="load()" placeholder="Search posts..." class="input max-w-md" />
        <select [(ngModel)]="sort" (change)="load()" class="input max-w-[160px]">
          <option value="recent">Recent</option>
          <option value="popular">Popular</option>
          <option value="top">Top all-time</option>
        </select>
      </div>

      @if (loading()) {
        <div class="card text-sm text-muted">Loading...</div>
      } @else if (posts().length === 0) {
        <div class="card text-center py-12">
          <p class="text-sm text-muted">No posts yet. Be the first to share!</p>
        </div>
      } @else {
        <div class="space-y-2">
          @for (p of posts(); track p.id) {
            <a [routerLink]="['/community', p.slug]" class="card block hover:bg-surface-2 transition">
              <div class="flex justify-between items-start gap-4">
                <div class="min-w-0 flex-1">
                  <div class="flex items-center gap-2 flex-wrap">
                    <span
                      class="text-xs px-2 py-0.5 rounded font-mono"
                      [class.bg-relay-violet]="p.type === 'template'"
                      [class.text-white]="p.type === 'template'"
                      [class.bg-surface-2]="p.type !== 'template'"
                      [class.text-relay-cyan]="p.type === 'discussion'"
                      [class.text-muted]="p.type === 'article'"
                    >{{ p.type }}</span>
                    @if (p.isOfficial) {
                      <span class="text-xs px-2 py-0.5 rounded bg-signal-amber/20 text-signal-amber">Official</span>
                    }
                    @if (p.isPinned) {
                      <span class="text-xs">📌</span>
                    }
                  </div>
                  <h3 class="text-white font-medium mt-2">{{ p.title }}</h3>
                  <div class="flex gap-1 mt-2 flex-wrap">
                    @for (tag of p.tags; track tag) {
                      <span class="text-[10px] px-1.5 py-0.5 rounded bg-surface-2 text-muted font-mono">{{ tag }}</span>
                    }
                  </div>
                  <p class="text-xs text-muted mt-2">
                    by {{ p.author?.name || 'Relayon' }}
                    @if (p.tenant) { · {{ p.tenant.name }} }
                    · {{ p.createdAt | date: 'short' }}
                  </p>
                </div>
                <div class="flex gap-4 text-xs text-muted shrink-0">
                  <div class="text-center">
                    <p class="text-white font-medium">{{ p.likeCount }}</p>
                    <p>likes</p>
                  </div>
                  <div class="text-center">
                    <p class="text-white font-medium">{{ p.replyCount }}</p>
                    <p>replies</p>
                  </div>
                  <div class="text-center">
                    <p class="text-white font-medium">{{ p.viewCount }}</p>
                    <p>views</p>
                  </div>
                </div>
              </div>
            </a>
          }
        </div>
      }
    </div>
  `,
})
export class CommunityListComponent implements OnInit {
  private api = inject(CommunityApiService);
  private route = inject(ActivatedRoute);

  readonly tabs: Array<{ value: Tab; label: string }> = [
    { value: 'all', label: 'All' },
    { value: 'discussion', label: 'Discussions' },
    { value: 'template', label: 'Templates' },
    { value: 'article', label: 'Articles' },
  ];

  posts = signal<CommunityPostSummary[]>([]);
  loading = signal(true);
  tab = signal<Tab>('all');
  search = '';
  sort: 'recent' | 'popular' | 'top' = 'recent';

  ngOnInit(): void {
    const qTab = this.route.snapshot.queryParamMap.get('type') as Tab | null;
    if (qTab && ['all', 'discussion', 'template', 'article'].includes(qTab)) {
      this.tab.set(qTab);
    }
    this.load();
  }

  setTab(t: Tab): void {
    this.tab.set(t);
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.api
      .list({
        type: this.tab() === 'all' ? undefined : this.tab(),
        search: this.search || undefined,
        sort: this.sort,
        limit: 30,
      })
      .subscribe({
        next: (r) => {
          this.posts.set(r.items);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }
}