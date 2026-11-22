import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { CommunityApiService } from '../../core/community/community.service';
import { IconComponent } from '../../shared/ui/icon/icon.component';

interface Announcement {
  id: string;
  title: string;
  slug: string;
  createdAt: string;
}

@Component({
  selector: 'app-announcements-widget',
  standalone: true,
  imports: [CommonModule, RouterLink, IconComponent],
  template: `
    @if (loading()) {
      <div class="card">
        <div class="flex items-center gap-2">
          <div class="skeleton h-6 w-6 rounded"></div>
          <div class="skeleton h-3 w-32"></div>
        </div>
        <div class="mt-3 space-y-2">
          <div class="skeleton h-3 w-full"></div>
          <div class="skeleton h-3 w-5/6"></div>
        </div>
      </div>
    } @else if (items().length > 0) {
      <div class="relative overflow-hidden rounded-xl border border-relay-cyan/25 bg-relay-cyan/[0.04] p-4">
        <div class="absolute -top-12 -right-12 h-32 w-32 rounded-full bg-relay-cyan/15 blur-3xl"></div>

        <div class="relative">
          <div class="flex items-center justify-between gap-2">
            <div class="flex items-center gap-2">
              <div class="flex h-7 w-7 items-center justify-center rounded-lg bg-relay-cyan/15 text-relay-cyan">
                <app-icon name="megaphone" [size]="14" [strokeWidth]="2" />
              </div>
              <h2 class="text-sm font-semibold text-foreground">Announcements</h2>
            </div>
            <a
              routerLink="/community"
              [queryParams]="{ type: 'article' }"
              class="flex items-center gap-0.5 text-xs font-medium text-relay-cyan transition-colors hover:text-foreground"
            >
              <span>View all</span>
              <app-icon name="arrow-right" [size]="11" [strokeWidth]="2.5" />
            </a>
          </div>

          <div class="mt-3 space-y-0.5">
            @for (a of items(); track a.id) {
              <a
                [routerLink]="['/community', a.slug]"
                class="group flex items-start gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-surface-2"
              >
                <app-icon
                  name="chevron-right"
                  [size]="12"
                  [strokeWidth]="2.5"
                  class="mt-0.5 shrink-0 text-muted-2 transition-transform group-hover:translate-x-0.5 group-hover:text-relay-cyan"
                />
                <div class="min-w-0 flex-1">
                  <p class="truncate text-xs font-medium text-foreground group-hover:text-foreground">
                    {{ a.title }}
                  </p>
                  <p class="mt-0.5 text-[10px] text-muted-2">{{ a.createdAt | date: 'short' }}</p>
                </div>
              </a>
            }
          </div>
        </div>
      </div>
    }
  `,
})
export class AnnouncementsWidgetComponent implements OnInit {
  private readonly api = inject(CommunityApiService);

  readonly items = signal<Announcement[]>([]);
  readonly loading = signal(true);

  ngOnInit(): void {
    this.api.announcements(3).subscribe({
      next: (a) => {
        this.items.set(a);
        this.loading.set(false);
      },
      error: () => {
        this.items.set([]);
        this.loading.set(false);
      },
    });
  }
}