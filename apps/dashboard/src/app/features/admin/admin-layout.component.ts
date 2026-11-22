import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { LogoComponent } from '../../shared/ui/logo/logo.component';
import { IconComponent, type IconName } from '../../shared/ui/icon/icon.component';

interface NavItem {
  path: string;
  label: string;
  icon: IconName;
  exact?: boolean;
}

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive, LogoComponent, IconComponent],
  template: `
    <div class="min-h-screen bg-midnight text-foreground">
      <!-- ═══════════ HEADER ═══════════ -->
      <header class="sticky top-0 z-30 border-b border-hairline bg-midnight/90 backdrop-blur-md">
        <div class="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div class="flex items-center gap-3">
            <app-logo size="md" link="/admin" [showVersion]="false" />

            <span class="hidden items-center gap-1.5 rounded-md border border-signal-rose/30 bg-signal-rose/10 px-2 py-0.5 sm:flex">
              <app-icon name="shield" [size]="11" [strokeWidth]="2.5" class="text-signal-rose" />
              <span class="font-mono text-[10px] font-semibold uppercase tracking-wider text-signal-rose">
                Admin
              </span>
            </span>
          </div>

          <a routerLink="/dashboard" class="btn-ghost text-xs">
            <app-icon name="arrow-left" [size]="11" [strokeWidth]="2.5" />
            <span class="hidden sm:inline">Back to app</span>
          </a>
        </div>
      </header>

      <!-- ═══════════ BODY ═══════════ -->
      <div class="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 sm:py-6 lg:flex-row lg:gap-6">
        <!-- Mobile nav (horizontal scroll) -->
        <nav class="flex gap-1 overflow-x-auto pb-2 lg:hidden" aria-label="Admin sections">
          @for (item of navItems; track item.path) {
            <a
              [routerLink]="item.path"
              [routerLinkActiveOptions]="{ exact: item.exact ?? false }"
              routerLinkActive="bg-surface-2 text-foreground"
              class="flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
            >
              <app-icon [name]="item.icon" [size]="13" [strokeWidth]="2" />
              <span>{{ item.label }}</span>
            </a>
          }
        </nav>

        <!-- Desktop nav (sidebar) -->
        <nav class="hidden w-56 shrink-0 lg:block" aria-label="Admin sections">
          <div class="sticky top-20 space-y-0.5">
            @for (item of navItems; track item.path) {
              <a
                [routerLink]="item.path"
                [routerLinkActiveOptions]="{ exact: item.exact ?? false }"
                routerLinkActive="bg-surface-2 text-foreground border-relay-violet"
                class="group flex items-center gap-2.5 rounded-lg border-s-2 border-transparent px-3 py-2 text-sm font-medium text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
              >
                <app-icon
                  [name]="item.icon"
                  [size]="14"
                  [strokeWidth]="2"
                  class="text-muted-2 group-hover:text-foreground transition-colors"
                />
                <span>{{ item.label }}</span>
              </a>
            }
          </div>
        </nav>

        <!-- Main content -->
        <main class="min-w-0 flex-1">
          <router-outlet />
        </main>
      </div>
    </div>
  `,
})
export class AdminLayoutComponent {
  readonly navItems: NavItem[] = [
    { path: '/admin', label: 'Overview', icon: 'layout-dashboard', exact: true },
    { path: '/admin/tenants', label: 'Tenants', icon: 'users' },
    { path: '/admin/users', label: 'Users', icon: 'user' },
    { path: '/admin/health', label: 'System health', icon: 'activity' },
    { path: '/admin/moderation', label: 'Moderation', icon: 'shield' },
    { path: '/admin/announcements', label: 'Announcements', icon: 'megaphone' },
    { path: '/admin/audit', label: 'Audit log', icon: 'file-text' },
    { path: '/admin/feature-flags', label: 'Feature flags', icon: 'flag' },
  ];
}