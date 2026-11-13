import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminApiService, type AdminTenant } from '../../core/admin/admin.service';

@Component({
  selector: 'app-admin-tenants',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="space-y-6">
      <div>
        <h1 class="text-2xl font-bold text-white">Tenants</h1>
        <p class="text-sm text-muted mt-1">All workspaces across the platform</p>
      </div>

      <div class="flex gap-2">
        <input [(ngModel)]="search" (input)="load()" placeholder="Search by name or slug..." class="input max-w-md" />
        <button (click)="load()" class="btn-secondary text-xs">Refresh</button>
      </div>

      @if (loading()) {
        <div class="card text-sm text-muted">Loading...</div>
      } @else if (items().length === 0) {
        <div class="card text-center py-8 text-sm text-muted">No tenants found</div>
      } @else {
        <div class="card p-0 overflow-hidden">
          <table class="w-full text-sm">
            <thead class="bg-surface-2 text-xs uppercase text-muted">
              <tr>
                <th class="text-left p-3">Name</th>
                <th class="text-left p-3">Plan</th>
                <th class="text-right p-3">Users</th>
                <th class="text-right p-3">Workflows</th>
                <th class="text-left p-3">Created</th>
              </tr>
            </thead>
            <tbody>
              @for (t of items(); track t.id) {
                <tr class="border-t border-hairline hover:bg-surface-2">
                  <td class="p-3">
                    <p class="text-white">{{ t.name }}</p>
                    <p class="text-xs text-muted font-mono">{{ t.slug }}</p>
                  </td>
                  <td class="p-3">
                    <span class="text-xs px-2 py-0.5 rounded bg-surface-2 text-white">{{ t.plan }}</span>
                    @if (t.subscriptionStatus !== 'none') {
                      <span class="text-xs ms-1 text-muted">{{ t.subscriptionStatus }}</span>
                    }
                  </td>
                  <td class="p-3 text-right text-white">{{ t.userCount }}</td>
                  <td class="p-3 text-right text-white">{{ t.workflowCount }}</td>
                  <td class="p-3 text-muted text-xs">{{ t.createdAt | date: 'short' }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </div>
  `,
})
export class AdminTenantsComponent implements OnInit {
  private api = inject(AdminApiService);

  items = signal<AdminTenant[]>([]);
  loading = signal(true);
  search = '';

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.api.tenants({ search: this.search || undefined, limit: 50 }).subscribe({
      next: (r) => {
        this.items.set(r.items);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}