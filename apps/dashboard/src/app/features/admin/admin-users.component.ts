import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Subject, debounceTime, distinctUntilChanged, takeUntil } from 'rxjs';
import { environment } from '../../../environments/environment';
import { IconComponent } from '../../shared/ui/icon/icon.component';

interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: string;
  emailVerified: boolean;
  isSuperAdmin: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  tenant: { id: string; name: string; slug: string };
}

@Component({
  selector: 'app-admin-users',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, IconComponent],
  template: `
    <div class="space-y-4">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 class="text-2xl font-bold tracking-tighter text-foreground">Users</h1>
          <p class="mt-1 text-sm text-muted">Search across all tenants</p>
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
          placeholder="Search by email or name…"
          class="input pl-9"
        />
      </div>

      @if (loading() && users().length === 0) {
        <div class="card p-0 overflow-hidden">
          @for (i of [1, 2, 3, 4, 5]; track i) {
            <div class="flex items-center gap-3 border-b border-hairline p-3 last:border-b-0">
              <div class="skeleton h-8 w-8 rounded-full"></div>
              <div class="skeleton h-3 w-40"></div>
              <div class="ml-auto skeleton h-3 w-20"></div>
            </div>
          }
        </div>
      } @else if (users().length === 0) {
        <div class="card flex flex-col items-center justify-center py-12 text-center">
          <div class="flex h-12 w-12 items-center justify-center rounded-xl border border-hairline bg-surface-2 text-muted">
            <app-icon name="user" [size]="22" [strokeWidth]="1.75" />
          </div>
          <p class="mt-3 text-sm font-medium text-foreground">No users found</p>
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
                <th class="px-3 py-2.5 text-left text-[10px] font-medium uppercase tracking-wider text-muted-2">User</th>
                <th class="px-3 py-2.5 text-left text-[10px] font-medium uppercase tracking-wider text-muted-2">Tenant</th>
                <th class="px-3 py-2.5 text-left text-[10px] font-medium uppercase tracking-wider text-muted-2">Role</th>
                <th class="px-3 py-2.5 text-left text-[10px] font-medium uppercase tracking-wider text-muted-2">Status</th>
                <th class="px-3 py-2.5 text-left text-[10px] font-medium uppercase tracking-wider text-muted-2">Last login</th>
              </tr>
            </thead>
            <tbody>
              @for (u of users(); track u.id) {
                <tr class="border-b border-hairline last:border-b-0 hover:bg-surface-2">
                  <td class="px-3 py-2.5">
                    <div class="flex items-center gap-2">
                      <div class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-relay-violet to-relay-cyan text-[10px] font-semibold text-white">
                        {{ initial(u.name) }}
                      </div>
                      <div class="min-w-0">
                        <p class="truncate font-medium text-foreground">{{ u.name }}</p>
                        <p class="truncate font-mono text-[11px] text-muted">{{ u.email }}</p>
                      </div>
                    </div>
                  </td>
                  <td class="px-3 py-2.5">
                    <a [routerLink]="['/admin/tenants', u.tenant.id]" class="text-xs text-relay-cyan hover:underline">
                      {{ u.tenant.name }}
                    </a>
                  </td>
                  <td class="px-3 py-2.5 text-xs capitalize text-foreground">{{ u.role }}</td>
                  <td class="px-3 py-2.5">
                    <div class="flex flex-wrap gap-1">
                      @if (u.isSuperAdmin) {
                        <span class="badge badge-danger">Super</span>
                      }
                      @if (!u.emailVerified) {
                        <span class="badge badge-warning">Unverified</span>
                      }
                      @if (u.emailVerified && !u.isSuperAdmin) {
                        <span class="badge badge-success">Verified</span>
                      }
                    </div>
                  </td>
                  <td class="px-3 py-2.5 text-[11px] text-muted">
                    {{ u.lastLoginAt ? (u.lastLoginAt | date: 'short') : 'never' }}
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        <!-- Mobile cards -->
        <div class="space-y-2 sm:hidden">
          @for (u of users(); track u.id) {
            <div class="card">
              <div class="flex items-start gap-2.5">
                <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-relay-violet to-relay-cyan text-xs font-semibold text-white">
                  {{ initial(u.name) }}
                </div>
                <div class="min-w-0 flex-1">
                  <p class="truncate font-medium text-foreground">{{ u.name }}</p>
                  <p class="truncate font-mono text-[11px] text-muted">{{ u.email }}</p>
                  <div class="mt-1.5 flex flex-wrap items-center gap-1">
                    <span class="badge capitalize">{{ u.role }}</span>
                    @if (u.isSuperAdmin) { <span class="badge badge-danger">Super</span> }
                    @if (!u.emailVerified) { <span class="badge badge-warning">Unverified</span> }
                  </div>
                  <p class="mt-1.5 text-[11px] text-muted">
                    {{ u.tenant.name }} · {{ u.lastLoginAt ? (u.lastLoginAt | date: 'short') : 'never logged in' }}
                  </p>
                </div>
              </div>
            </div>
          }
        </div>
      }
    </div>
  `,
})
export class AdminUsersComponent implements OnInit, OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly destroy$ = new Subject<void>();
  private readonly searchInput$ = new Subject<string>();

  readonly users = signal<AdminUser[]>([]);
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
    let p = new HttpParams();
    if (this.search()) p = p.set('search', this.search());
    this.http
      .get<AdminUser[]>(`${environment.apiUrl}/api/admin/users`, { params: p })
      .subscribe({
        next: (r) => {
          this.users.set(r);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  initial(name: string): string {
    return name ? name[0]!.toUpperCase() : '?';
  }
}