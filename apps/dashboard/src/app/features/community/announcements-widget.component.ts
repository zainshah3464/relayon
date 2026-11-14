import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { CommunityApiService } from '../../core/community/community.service';

@Component({
  selector: 'app-announcements-widget',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    @if (items().length > 0) {
      <div class="card border-relay-cyan/30 bg-relay-cyan/5">
        <div class="flex justify-between items-center mb-3">
          <h2 class="text-sm font-medium text-white">📢 Announcements</h2>
          <a routerLink="/community" [queryParams]="{ type: 'announcement' }" class="text-xs text-relay-cyan hover:underline">View all</a>
        </div>
        <div class="space-y-2">
          @for (a of items(); track a.id) {
            <a [routerLink]="['/community', a.slug]" class="block hover:bg-surface-2 rounded p-2">
              <p class="text-sm text-white">{{ a.title }}</p>
              <p class="text-xs text-muted mt-1">{{ a.createdAt | date: 'short' }}</p>
            </a>
          }
        </div>
      </div>
    }
  `,
})
export class AnnouncementsWidgetComponent implements OnInit {
  private api = inject(CommunityApiService);
  items = signal<
    Array<{ id: string; title: string; slug: string; createdAt: string }>
  >([]);

  ngOnInit(): void {
    this.api.announcements(3).subscribe({
      next: (a) => this.items.set(a),
      error: () => this.items.set([]),
    });
  }
}