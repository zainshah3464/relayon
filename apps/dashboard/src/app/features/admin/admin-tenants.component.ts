import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Subject, debounceTime, distinctUntilChanged, takeUntil } from 'rxjs';
import { AdminApiService, type AdminTenant } from '../../core/admin/admin.service';
import { IconComponent } from '../../shared/ui/icon/icon.component';

@Component({
  selector: 'app-admin-tenants',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, IconComponent],
  template: `
    <div class="space-y-4">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 class="text-2xl font-bold tracking-tighter text-foreground">Tenants</h1>
          <p class="mt-1 text-sm text-muted">All workspaces across the platform</p>
        </div>
        <button type="button" (click)="load()" [disabled]="loading()" class="btn-secondary self-start">
          <app-icon name="refresh" [size]="12" [strokeWidth]="2.5" [class.animate-spin]="loading()" />
          <span>Refresh</span>
        </button>
      </div>

      <div class="relative">
        <app-icon name="search" [size]="13" [strokeWidth]="2" class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-2" />
        <input
          type="text"
          [value]="search()"
          (input)="onSearch($any($event.target).value)"
          placeholder="Search by name or slug…"
          class="input pl-9"
        />
      </div>

      @if (loading() && items().length === 0) {
        <div class="card p-0 overflow-hidden">
          @for (i of [1, 2, 3, 4, 5]; track i) {
            <div class="flex items-center gap-3 border-b border-hairline p-3 last:border-b-0">
              <div class="skeleton h-3 w-32"></div>
              <div class="skeleton h-3 w-16"></div>
              <div class="ml-auto skeleton h-3 w-20"></div>
            </div>
          }
        </div>
      } @else if (items().length === 0) {
        <div class="card flex flex-col items-center justify-center py-12 text-center">
          <div class="flex h-12 w-12 items-center justify-center rounded-xl border border-hairline bg-surface-2 text-muted">
            <app-icon name="users" [size]="22" [strokeWidth]="1.75" />
          </div>
          <p class="mt-3 text-sm font-medium text-foreground">No tenants found</p>
          @if (search()) {
            <p class="mt-1 text-xs text-muted">No results for "{{ search() }}"</p>
            <button type="button" (click)="onSearch('')" class="btn-ghost mt-3 text-xs">Clear search</button>
          }
        </div>
      } @else {
        <!-- Desktop table -->
        <div class="card hidden overflow-hidden p-0 sm:block">
          <table class="w-full text-sm">
            <thead class="bg-surface-2/50">
              <tr class="border-b border-hairline">
                <th class="px-3 py-2.5 text-left text-[10px] font-medium uppercase tracking-wider text-muted-2">Name</th>
                <th class="px-3 py-2.5 text-left text-[10px] font-medium uppercase tracking-wider text-muted-2">Plan</th>
                <th class="px-3 py-2.5 text-right text-[10px] font-medium uppercase tracking-wider text-muted-2">Users</th>
                <th class="px-3 py-2.5 text-right text-[10px] font-medium uppercase tracking-wider text-muted-2">Workflows</th>
                <th class="px-3 py-2.5 text-left text-[10px] font-medium uppercase tracking-wider text-muted-2">Created</th>
              </tr>
            </thead>
            <tbody>
              @for (t of items(); track t.id) {
                <tr
                  [routerLink]="['/admin/tenants', t.id]"
                  class="group cursor-pointer border-b border-hairline transition-colors last:border-b-0 hover:bg-surface-2"
                >
                  <td class="px-3 py-2.5">
                    <p class="font-medium text-foreground group-hover:text-foreground">{{ t.name }}</p>
                    <p class="font-mono text-[11px] text-muted">{{ t.slug }}</p>
                  </td>
                  <td class="px-3 py-2.5">
                    <span class="badge capitalize">{{ t.plan }}</span>
                  </td>
                  <td class="px-3 py-2.5 text-right tabular-nums text-foreground">{{ t.userCount }}</td>
                  <td class="px-3 py-2.5 text-right tabular-nums text-foreground">{{ t.workflowCount }}</td>
                  <td class="px-3 py-2.5 text-[11px] text-muted">{{ t.createdAt | date: 'short' }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        <!-- Mobile cards -->
        <div class="space-y-2 sm:hidden">
          @for (t of items(); track t.id) {
            <a [routerLink]="['/admin/tenants', t.id]" class="card-interactive block">
              <div class="flex items-start justify-between gap-2">
                <div class="min-w-0">
                  <p class="truncate font-medium text-foreground">{{ t.name }}</p>
                  <p class="truncate font-mono text-[11px] text-muted">{{ t.slug }}</p>
                </div>
                <span class="badge shrink-0 capitalize">{{ t.plan }}</span>
              </div>
              <div class="mt-2 flex items-center gap-3 text-[11px] text-muted">
                <span>{{ t.userCount }} users</span>
                <span class="text-muted-2">·</span>
                <span>{{ t.workflowCount }} workflows</span>
                <span class="text-muted-2">·</span>
                <span>{{ t.createdAt | date: 'short' }}</span>
              </div>
            </a>
          }
        </div>
      }
    </div>
  `,
})
export class AdminTenantsComponent implements OnInit, OnDestroy {
  private readonly api = inject(AdminApiService);
  private readonly destroy$ = new Subject<void>();
  private readonly searchInput$ = new Subject<string>();

  readonly items = signal<AdminTenant[]>([]);
  readonly loading = signal(true);
  readonly search = signal('');

  ngOnInit(): void {
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

  onSearch(value: string): void {
    this.searchInput$.next(value);
  }

  load(): void {
    this.loading.set(true);
    this.api.tenants({ search: this.search() || undefined, limit: 50 }).subscribe({
      next: (r) => {
        this.items.set(r.items);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}