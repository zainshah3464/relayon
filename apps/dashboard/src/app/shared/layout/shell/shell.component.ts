import { Component, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../core/auth/auth.service';

interface NavItem {
  label: string;
  path: string;
  icon: string;
}

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="flex h-screen bg-midnight">
      <!-- Sidebar -->
      <aside
        class="fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-hairline bg-surface transition-transform lg:static lg:translate-x-0"
        [class.-translate-x-full]="!sidebarOpen()"
      >
        <!-- Logo -->
        <div class="flex h-16 items-center border-b border-hairline px-6">
          <a routerLink="/dashboard" class="flex items-center gap-2">
            <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-relay-violet to-relay-cyan text-sm font-bold text-white">
              R
            </div>
            <span class="text-lg font-bold tracking-tightest text-white">Relayon</span>
          </a>
        </div>

        <!-- Nav -->
        <nav class="flex-1 space-y-1 p-4">
          @for (item of navItems; track item.path) {
            <a
              [routerLink]="item.path"
              routerLinkActive="bg-surface-2 text-white"
              [routerLinkActiveOptions]="{ exact: item.path === '/dashboard' }"
              class="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted transition hover:bg-surface-2 hover:text-white"
            >
              <span class="text-base">{{ item.icon }}</span>
              <span>{{ item.label }}</span>
            </a>
          }
        </nav>

        <!-- User -->
        <div class="border-t border-hairline p-4">
          <div class="mb-2 flex items-center gap-3">
            <div class="flex h-9 w-9 items-center justify-center rounded-full bg-relay-violet text-sm font-semibold text-white">
              {{ initial() }}
            </div>
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-medium text-white">{{ auth.displayName() }}</p>
              <p class="truncate text-xs text-muted">{{ auth.user()?.tenantName }}</p>
            </div>
          </div>
          <button (click)="logout()" class="w-full rounded-lg border border-hairline px-3 py-1.5 text-xs font-medium text-muted hover:bg-surface-2 hover:text-white">
            Sign out
          </button>
        </div>
      </aside>

      <!-- Backdrop for mobile -->
      @if (sidebarOpen()) {
        <div class="fixed inset-0 z-30 bg-black/60 lg:hidden" (click)="sidebarOpen.set(false)"></div>
      }

      <!-- Main -->
      <div class="flex flex-1 flex-col overflow-hidden">
        <!-- Topbar -->
        <header class="flex h-16 items-center justify-between border-b border-hairline bg-surface px-6 lg:hidden">
          <button (click)="sidebarOpen.set(true)" class="text-white">
            <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/>
            </svg>
          </button>
          <span class="text-sm font-medium text-white">Relayon</span>
          <div class="w-6"></div>
        </header>

        <!-- Content -->
        <main class="flex-1 overflow-y-auto">
          <div class="mx-auto max-w-7xl p-6 lg:p-8">
            <router-outlet />
          </div>
        </main>
      </div>
    </div>
  `,
})
export class ShellComponent {
  auth = inject(AuthService);
  sidebarOpen = signal(false);

  navItems: NavItem[] = [
    { label: 'Dashboard', path: '/dashboard', icon: '📊' },
    { label: 'Workflows', path: '/workflows', icon: '🔄' },
    { label: 'Events', path: '/events', icon: '📨' },
    { label: 'Dead Letter Queue', path: '/dlq', icon: '⚠️' },
    { label: 'Analytics', path: '/analytics', icon: '📈' },
    { label: 'Settings', path: '/settings', icon: '⚙️' },
  ];

  initial = () => {
    const name = this.auth.displayName();
    return name ? name[0].toUpperCase() : '?';
  };

  logout(): void {
    this.auth.logout();
  }
}