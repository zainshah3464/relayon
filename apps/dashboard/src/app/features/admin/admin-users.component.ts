import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';

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
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="space-y-6">
      <div>
        <h1 class="text-2xl font-bold text-white">Users</h1>
        <p class="text-sm text-muted mt-1">Search across all tenants</p>
      </div>

      <div class="flex gap-2">
        <input [(ngModel)]="search" (input)="load()" placeholder="Search by email or name..." class="input max-w-md" />
        <button (click)="load()" class="btn-secondary text-xs">Refresh</button>
      </div>

      @if (loading()) {
        <div class="card text-sm text-muted">Loading...</div>
      } @else if (users().length === 0) {
        <div class="card text-center py-8 text-sm text-muted">No users found</div>
      } @else {
        <div class="card p-0 overflow-hidden">
          <table class="w-full text-sm">
            <thead class="bg-surface-2 text-xs uppercase text-muted">
              <tr>
                <th class="text-left p-3">User</th>
                <th class="text-left p-3">Tenant</th>
                <th class="text-left p-3">Role</th>
                <th class="text-left p-3">Status</th>
                <th class="text-left p-3">Last login</th>
              </tr>
            </thead>
            <tbody>
              @for (u of users(); track u.id) {
                <tr class="border-t border-hairline hover:bg-surface-2">
                  <td class="p-3">
                    <p class="text-white">{{ u.name }}</p>
                    <p class="text-xs text-muted font-mono">{{ u.email }}</p>
                  </td>
                  <td class="p-3">
                    <a [routerLink]="['/admin/tenants', u.tenant.id]" class="text-xs text-relay-cyan hover:underline">
                      {{ u.tenant.name }}
                    </a>
                  </td>
                  <td class="p-3 text-xs text-white">{{ u.role }}</td>
                  <td class="p-3">
                    @if (u.isSuperAdmin) {
                      <span class="text-xs px-2 py-0.5 rounded bg-signal-rose/20 text-signal-rose">SUPER</span>
                    }
                    @if (!u.emailVerified) {
                      <span class="text-xs px-2 py-0.5 rounded bg-signal-amber/20 text-signal-amber">unverified</span>
                    }
                  </td>
                  <td class="p-3 text-xs text-muted">
                    {{ u.lastLoginAt ? (u.lastLoginAt | date: 'short') : 'never' }}
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </div>
  `,
})
export class AdminUsersComponent implements OnInit {
  private http = inject(HttpClient);
  users = signal<AdminUser[]>([]);
  loading = signal(true);
  search = '';

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    let p = new HttpParams();
    if (this.search) p = p.set('search', this.search);
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
}