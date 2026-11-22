import {
  Component,
  inject,
  signal,
  OnInit,
  OnDestroy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subject, debounceTime, distinctUntilChanged, takeUntil } from 'rxjs';
import {
  CommunityApiService,
  type CommunityPostSummary,
} from '../../core/community/community.service';
import { SeoService } from '../../core/seo/seo.service';
import { IconComponent, type IconName } from '../../shared/ui/icon/icon.component';

type Tab = 'all' | 'discussion' | 'template' | 'article';
type Sort = 'recent' | 'popular' | 'top';

interface TabDef {
  value: Tab;
  label: string;
  icon: IconName;
}

@Component({
  selector: 'app-community-list',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, IconComponent],
  template: `
    <div class="space-y-5">
      <!-- ═══════════ HEADER ═══════════ -->
      <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 class="text-2xl font-bold tracking-tighter text-foreground sm:text-3xl">
            Community
          </h1>
          <p class="mt-1 text-sm text-muted">
            Share workflows, ask questions, learn from others.
          </p>
        </div>
        <a routerLink="/community/new" class="btn-primary self-start sm:self-auto">
          <app-icon name="plus" [size]="13" [strokeWidth]="2.5" />
          <span>New post</span>
        </a>
      </div>

      <!-- ═══════════ TABS ═══════════ -->
      <div class="-mx-4 overflow-x-auto border-b border-hairline px-4 sm:mx-0 sm:px-0">
        <div class="flex min-w-max gap-1" role="tablist">
          @for (t of tabs; track t.value) {
            <button
              type="button"
              role="tab"
              [attr.aria-selected]="tab() === t.value"
              (click)="setTab(t.value)"
              class="flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors"
              [class.border-relay-violet]="tab() === t.value"
              [class.text-foreground]="tab() === t.value"
              [class.border-transparent]="tab() !== t.value"
              [class.text-muted]="tab() !== t.value"
              [class.hover:text-foreground]="tab() !== t.value"
            >
              <app-icon [name]="t.icon" [size]="13" [strokeWidth]="2" />
              <span>{{ t.label }}</span>
            </button>
          }
        </div>
      </div>

      <!-- ═══════════ FILTERS ═══════════ -->
      <div class="flex flex-col gap-2 sm:flex-row">
        <div class="relative flex-1">
          <app-icon
            name="search"
            [size]="14"
            [strokeWidth]="2"
            class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-2"
          />
          <input
            type="text"
            [value]="search()"
            (input)="onSearchChange($any($event.target).value)"
            placeholder="Search posts…"
            class="input pl-9"
            aria-label="Search posts"
          />
          @if (search()) {
            <button
              type="button"
              (click)="clearSearch()"
              class="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-2 hover:bg-surface-3 hover:text-foreground"
              aria-label="Clear search"
            >
              <app-icon name="x" [size]="12" [strokeWidth]="2.5" />
            </button>
          }
        </div>

        <div class="flex items-center gap-2">
          <label for="sort-select" class="sr-only">Sort</label>
          <select
            id="sort-select"
            [value]="sort()"
            (change)="onSortChange($any($event.target).value)"
            class="input w-full sm:w-auto"
          >
            <option value="recent">Recent</option>
            <option value="popular">Popular</option>
            <option value="top">Top all-time</option>
          </select>
        </div>
      </div>

      <!-- ═══════════ CONTENT ═══════════ -->
      @if (loading()) {
        <div class="space-y-2">
          @for (i of [1, 2, 3, 4]; track i) {
            <div class="card">
              <div class="flex items-start gap-3">
                <div class="skeleton h-9 w-9 rounded-full"></div>
                <div class="flex-1">
                  <div class="skeleton h-3 w-24"></div>
                  <div class="skeleton mt-2 h-4 w-3/4"></div>
                  <div class="skeleton mt-2 h-3 w-1/2"></div>
                </div>
              </div>
            </div>
          }
        </div>
      } @else if (posts().length === 0) {
        <div class="card flex flex-col items-center justify-center py-16 text-center">
          <div class="flex h-14 w-14 items-center justify-center rounded-2xl border border-hairline bg-surface-2 text-muted">
            <app-icon [name]="emptyIcon()" [size]="26" [strokeWidth]="1.75" />
          </div>
          <h3 class="mt-4 text-base font-semibold text-foreground">
            {{ emptyTitle() }}
          </h3>
          <p class="mt-1.5 max-w-sm text-sm text-muted">
            {{ emptyBody() }}
          </p>
          @if (!search()) {
            <a routerLink="/community/new" class="btn-primary mt-4">
              <app-icon name="plus" [size]="13" [strokeWidth]="2.5" />
              <span>Start the first one</span>
            </a>
          }
        </div>
      } @else {
        <div class="space-y-2">
          @for (p of posts(); track p.id) {
            <a
              [routerLink]="['/community', p.slug]"
              class="card-interactive group block"
            >
              <div class="flex items-start gap-3">
                <!-- Author avatar -->
                <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-relay-violet to-relay-cyan text-xs font-semibold text-white">
                  {{ initial(p.author?.name) }}
                </div>

                <div class="min-w-0 flex-1">
                  <!-- Badges row -->
                  <div class="flex flex-wrap items-center gap-1">
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

                  <h3 class="mt-1.5 text-sm font-semibold leading-snug text-foreground group-hover:text-foreground">
                    {{ p.title }}
                  </h3>

                  @if (p.tags.length > 0) {
                    <div class="mt-2 flex flex-wrap gap-1">
                      @for (tag of p.tags; track tag) {
                        <span class="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] text-muted">
                          {{ tag }}
                        </span>
                      }
                    </div>
                  }

                  <div class="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-2">
                    <span>
                      by {{ p.author?.name || 'Relayon' }}
                      @if (p.tenant) {
                        <span class="mx-1">·</span>
                        {{ p.tenant.name }}
                      }
                    </span>
                    <span>{{ p.createdAt | date: 'short' }}</span>
                  </div>
                </div>

                <!-- Metrics -->
                <div class="hidden shrink-0 items-center gap-3 text-[11px] text-muted sm:flex">
                  <div class="flex items-center gap-1">
                    <app-icon name="heart" [size]="11" [strokeWidth]="2" />
                    <span class="tabular-nums">{{ p.likeCount }}</span>
                  </div>
                  <div class="flex items-center gap-1">
                    <app-icon name="message-circle" [size]="11" [strokeWidth]="2" />
                    <span class="tabular-nums">{{ p.replyCount }}</span>
                  </div>
                  <div class="flex items-center gap-1">
                    <app-icon name="eye" [size]="11" [strokeWidth]="2" />
                    <span class="tabular-nums">{{ p.viewCount }}</span>
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
export class CommunityListComponent implements OnInit, OnDestroy {
  private readonly api = inject(CommunityApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  private readonly destroy$ = new Subject<void>();
  private readonly searchInput$ = new Subject<string>();

  readonly tabs: TabDef[] = [
    { value: 'all', label: 'All', icon: 'messages' },
    { value: 'discussion', label: 'Discussions', icon: 'message-square' },
    { value: 'template', label: 'Templates', icon: 'code' },
    { value: 'article', label: 'Articles', icon: 'file-text' },
  ];

  readonly posts = signal<CommunityPostSummary[]>([]);
  readonly loading = signal(true);
  readonly tab = signal<Tab>('all');
  readonly search = signal('');
  readonly sort = signal<Sort>('recent');

  constructor() {
    inject(SeoService).set({
      title: 'Community — Discussions, Templates, Articles',
      description:
        'Share workflows, ask questions, and learn from other Relayon users. Workflow templates for Stripe, GitHub, Shopify and more.',
      path: '/community',
      keywords: ['relayon community', 'webhook templates', 'workflow templates'],
      noindex: true,
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: 'Relayon Community',
        description:
          'Discussions, workflow templates, and articles from the Relayon community.',
        url: 'https://relayon.vercel.app/community',
      },
    });
  }

  ngOnInit(): void {
    // Read initial tab from URL
    this.route.queryParamMap.pipe(takeUntil(this.destroy$)).subscribe((params) => {
      const qTab = params.get('type') as Tab | null;
      if (qTab && ['all', 'discussion', 'template', 'article'].includes(qTab)) {
        this.tab.set(qTab);
      }
    });

    // Debounced search
    this.searchInput$
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe((q) => {
        this.search.set(q);
        this.load();
      });

    this.load();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  setTab(t: Tab): void {
    if (this.tab() === t) return;
    this.tab.set(t);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { type: t === 'all' ? null : t },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
    this.load();
  }

  onSearchChange(value: string): void {
    this.searchInput$.next(value);
  }

  clearSearch(): void {
    this.searchInput$.next('');
  }

  onSortChange(value: string): void {
    this.sort.set(value as Sort);
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.api
      .list({
        type: this.tab() === 'all' ? undefined : this.tab(),
        search: this.search() || undefined,
        sort: this.sort(),
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

  initial(name?: string): string {
    if (!name) return 'R';
    return name[0]!.toUpperCase();
  }

  typeIcon(type: string): IconName {
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

  emptyIcon(): IconName {
    if (this.search()) return 'search';
    if (this.tab() === 'template') return 'code';
    if (this.tab() === 'article') return 'file-text';
    if (this.tab() === 'discussion') return 'message-square';
    return 'messages';
  }

  emptyTitle(): string {
    if (this.search()) return 'No matches';
    if (this.tab() === 'template') return 'No templates yet';
    if (this.tab() === 'article') return 'No articles yet';
    if (this.tab() === 'discussion') return 'No discussions yet';
    return 'No posts yet';
  }

  emptyBody(): string {
    if (this.search()) {
      return `No posts match "${this.search()}". Try a different search.`;
    }
    if (this.tab() === 'template') {
      return 'Be the first to share a workflow template.';
    }
    if (this.tab() === 'article') {
      return 'No long-form articles yet — share your knowledge.';
    }
    if (this.tab() === 'discussion') {
      return 'Ask a question or start a conversation.';
    }
    return 'Be the first to share something with the community.';
  }
}