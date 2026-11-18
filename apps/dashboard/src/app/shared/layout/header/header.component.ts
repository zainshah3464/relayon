import {
  Component,
  ElementRef,
  HostListener,
  ViewChild,
  inject,
  output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { AuthService } from '../../../core/auth/auth.service';
import { LanguageService, type SupportedLang } from '../../../i18n/language.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterLink, TranslocoModule],
  template: `
    <header
      class="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b border-hairline bg-surface/95 px-4 backdrop-blur-sm lg:px-6"
    >
      <!-- ── LEFT: Hamburger (mobile) + Logo (mobile) or Breadcrumb (desktop) ── -->
      <button
        (click)="toggleSidebar.emit()"
        class="flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-white lg:hidden"
        aria-label="Toggle sidebar"
      >
        <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      <!-- Mobile logo -->
      <a routerLink="/dashboard" class="flex items-center gap-2 lg:hidden">
        <div class="flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-relay-violet to-relay-cyan text-[11px] font-bold text-white">
          R
        </div>
        <span class="text-sm font-bold tracking-tight text-white">Relayon</span>
      </a>

      <!-- Desktop breadcrumb placeholder -->
      <div class="hidden items-center gap-2 text-sm lg:flex">
        <span class="text-white font-medium">{{ pageTitle() }}</span>
      </div>

      <!-- ── CENTER: Search (desktop) ── -->
      <div class="hidden flex-1 justify-center lg:flex">
        <button
          (click)="openSearch()"
          class="group flex w-full max-w-md items-center gap-2 rounded-lg border border-hairline bg-surface-2 px-3 py-1.5 text-left text-xs text-muted transition hover:border-relay-violet/40 hover:text-white"
        >
          <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <span class="flex-1">Search events, workflows...</span>
          <kbd class="hidden rounded border border-hairline bg-midnight px-1.5 py-0.5 text-[10px] font-mono text-muted xl:inline">
            ⌘K
          </kbd>
        </button>
      </div>

      <!-- ── RIGHT: Actions ── -->
      <div class="ml-auto flex items-center gap-1 lg:gap-2">
        <!-- Search (mobile) -->
        <button
          (click)="openSearch()"
          class="flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-white lg:hidden"
          aria-label="Search"
        >
          <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </button>

        <!-- Quick action: New workflow -->
        <a
          routerLink="/workflows"
          [queryParams]="{ new: '1' }"
          class="hidden items-center gap-1.5 rounded-lg bg-relay-violet px-3 py-1.5 text-xs font-medium text-white transition hover:bg-relay-violet/90 sm:flex"
        >
          <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          New workflow
        </a>

        <!-- Help -->
        <a
          routerLink="/guide"
          class="flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-white"
          title="Help & guide"
        >
          <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </a>

        <!-- Language switcher (desktop compact) -->
        <div class="hidden items-center lg:flex">
          <select
            [value]="lang.current()"
            (change)="onLangChange($event)"
            class="rounded-lg border border-hairline bg-surface-2 px-2 py-1 text-xs text-white focus:border-relay-violet focus:outline-none"
            aria-label="Language"
          >
            <option value="en">EN</option>
            <option value="ur">UR</option>
            <option value="ar">AR</option>
          </select>
        </div>

        <!-- User menu -->
        <div #userMenuRef class="relative">
          <button
            (click)="toggleUserMenu()"
            [attr.aria-expanded]="userMenuOpen()"
            aria-haspopup="menu"
            class="flex items-center gap-2 rounded-lg p-1 hover:bg-surface-2"
          >
            <div class="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-relay-violet to-relay-cyan text-xs font-semibold text-white">
              {{ initial() }}
            </div>
            <div class="hidden text-left lg:block">
              <p class="text-xs font-medium text-white leading-tight">{{ auth.displayName() }}</p>
              <p class="text-[10px] text-muted leading-tight">{{ auth.user()?.tenantName }}</p>
            </div>
            <svg class="hidden h-3 w-3 text-muted lg:block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          <!-- Dropdown -->
          @if (userMenuOpen()) {
            <div
              class="absolute end-0 mt-2 w-56 overflow-hidden rounded-xl border border-hairline bg-surface shadow-xl"
              role="menu"
            >
              <!-- User header -->
              <div class="border-b border-hairline px-4 py-3">
                <p class="text-sm font-medium text-white truncate">{{ auth.displayName() }}</p>
                <p class="text-xs text-muted truncate">{{ auth.user()?.email }}</p>
              </div>

              <!-- Menu items -->
              <div class="p-1.5">
                <a
                  routerLink="/settings"
                  (click)="closeUserMenu()"
                  class="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-xs text-muted hover:bg-surface-2 hover:text-white"
                  role="menuitem"
                >
                  <span>⚙️</span> Settings
                </a>
                <a
                  routerLink="/settings"
                  [queryParams]="{ tab: 'api-keys' }"
                  (click)="closeUserMenu()"
                  class="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-xs text-muted hover:bg-surface-2 hover:text-white"
                  role="menuitem"
                >
                  <span>🔑</span> API keys
                </a>
                <a
                  routerLink="/about"
                  (click)="closeUserMenu()"
                  class="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-xs text-muted hover:bg-surface-2 hover:text-white"
                  role="menuitem"
                >
                  <span>👤</span> About Relayon
                </a>
                <a
                  routerLink="/guide"
                  (click)="closeUserMenu()"
                  class="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-xs text-muted hover:bg-surface-2 hover:text-white"
                  role="menuitem"
                >
                  <span>📖</span> Help & guide
                </a>
                <a
                  href="mailto:hello@relayon.dev"
                  (click)="closeUserMenu()"
                  class="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-xs text-muted hover:bg-surface-2 hover:text-white"
                  role="menuitem"
                >
                  <span>✉️</span> Contact support
                </a>
              </div>

              <!-- Sign out -->
              <div class="border-t border-hairline p-1.5">
                <button
                  (click)="signOut()"
                  class="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-xs text-signal-rose hover:bg-signal-rose/10"
                  role="menuitem"
                >
                  <span>🚪</span> Sign out
                </button>
              </div>

              <!-- Version / credit -->
              <div class="border-t border-hairline bg-surface-2 px-3 py-2 text-[10px] text-muted">
                <div class="flex items-center justify-between">
                  <span>Relayon v3.2</span>
                  <a routerLink="/about" (click)="closeUserMenu()" class="hover:text-white">
                    by Zain Shah
                  </a>
                </div>
              </div>
            </div>
          }
        </div>
      </div>
    </header>
  `,
})
export class HeaderComponent {
  readonly toggleSidebar = output<void>();
  readonly openSearchEvent = output<void>();

  auth = inject(AuthService);
  lang = inject(LanguageService);
  private readonly router = inject(Router);

  @ViewChild('userMenuRef') userMenuRef?: ElementRef<HTMLDivElement>;

  userMenuOpen = signal(false);

  initial = (): string => {
    const name = this.auth.displayName();
    return name ? name[0]!.toUpperCase() : '?';
  };

  pageTitle(): string {
    const url = this.router.url.split('?')[0] ?? '';
    if (url.startsWith('/dashboard')) return 'Dashboard';
    if (url.startsWith('/workflows')) return 'Workflows';
    if (url.startsWith('/events')) return 'Events';
    if (url.startsWith('/dlq')) return 'Dead Letter Queue';
    if (url.startsWith('/analytics')) return 'Analytics';
    if (url.startsWith('/settings')) return 'Settings';
    if (url.startsWith('/community')) return 'Community';
    if (url.startsWith('/admin')) return 'Admin';
    if (url.startsWith('/guide')) return 'Guide';
    if (url.startsWith('/about')) return 'About';
    return 'Relayon';
  }

  toggleUserMenu(): void {
    this.userMenuOpen.set(!this.userMenuOpen());
  }

  closeUserMenu(): void {
    this.userMenuOpen.set(false);
  }

  signOut(): void {
    this.closeUserMenu();
    this.auth.logout();
  }

  onLangChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value as SupportedLang;
    this.lang.setLanguage(value);
  }

  openSearch(): void {
    this.openSearchEvent.emit();
    void this.router.navigate(['/events']);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.userMenuOpen()) return;
    const el = this.userMenuRef?.nativeElement;
    if (!el) return;
    if (!el.contains(event.target as Node)) {
      this.closeUserMenu();
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.closeUserMenu();
  }
}