import {
  Component,
  ElementRef,
  HostListener,
  ViewChild,
  inject,
  output,
  signal,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { AuthService } from '../../../core/auth/auth.service';
import { LanguageService, type SupportedLang } from '../../../i18n/language.service';
import { LogoComponent } from '../../ui/logo/logo.component';
import { IconComponent } from '../../ui/icon/icon.component';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterLink, TranslocoModule, LogoComponent, IconComponent],
  template: `
    <header
      class="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b border-hairline bg-surface/95 px-3 backdrop-blur-md lg:px-6 pt-safe"
    >
      <!-- ═══ LEFT: Hamburger (mobile) + Logo (mobile) or Page title (desktop) ═══ -->
      <button
        type="button"
        (click)="toggleSidebar.emit()"
        class="flex h-9 w-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-foreground lg:hidden"
        aria-label="Open menu"
      >
        <app-icon name="menu" [size]="18" [strokeWidth]="2" />
      </button>

      <!-- Mobile logo -->
      <div class="lg:hidden">
        <app-logo size="sm" />
      </div>

      <!-- Desktop page title -->
      <div class="hidden items-center gap-2 lg:flex">
        <span class="text-sm font-semibold tracking-tight text-foreground">{{ pageTitle() }}</span>
      </div>

      <!-- ═══ CENTER: Search (desktop) ═══ -->
      <div class="hidden flex-1 justify-center lg:flex">
        <button
          type="button"
          (click)="openSearch()"
          class="group flex w-full max-w-md items-center gap-2 rounded-lg border border-hairline bg-surface-2 px-3 py-1.5 text-left text-xs text-muted transition-colors hover:border-hairline-strong hover:text-foreground"
        >
          <app-icon name="search" [size]="14" [strokeWidth]="2" />
          <span class="flex-1">Search events…</span>
          <kbd class="hidden rounded border border-hairline bg-midnight px-1.5 py-0.5 text-[10px] font-mono text-muted-2 xl:inline">
            ⌘K
          </kbd>
        </button>
      </div>

      <!-- ═══ RIGHT: Actions ═══ -->
      <div class="ml-auto flex items-center gap-1 lg:gap-1.5">
        <!-- Search (mobile) -->
        <button
          type="button"
          (click)="openSearch()"
          class="flex h-9 w-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-foreground lg:hidden"
          aria-label="Search"
        >
          <app-icon name="search" [size]="16" [strokeWidth]="2" />
        </button>

        <!-- New workflow (desktop) -->
        <a
          routerLink="/workflows"
          [queryParams]="{ new: '1' }"
          class="hidden items-center gap-1.5 rounded-lg bg-relay-violet px-3 py-1.5 text-xs font-medium text-white transition-all duration-150 hover:bg-relay-violet-dim sm:flex"
        >
          <app-icon name="plus" [size]="13" [strokeWidth]="2.25" />
          <span>New workflow</span>
        </a>

        <!-- Help -->
        <a
          routerLink="/guide"
          class="flex h-9 w-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
          title="Help & guide"
          aria-label="Help"
        >
          <app-icon name="help" [size]="16" [strokeWidth]="2" />
        </a>

        <!-- User menu -->
        <div #userMenuRef class="relative">
          <button
            type="button"
            (click)="toggleUserMenu()"
            [attr.aria-expanded]="userMenuOpen()"
            aria-haspopup="menu"
            class="flex items-center gap-2 rounded-lg p-1 transition-colors hover:bg-surface-2"
          >
            <div class="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-relay-violet to-relay-cyan text-xs font-semibold text-white shadow-sm">
              {{ initial() }}
            </div>
            <div class="hidden text-left lg:block">
              <p class="max-w-[140px] truncate text-xs font-medium leading-tight text-foreground">
                {{ auth.displayName() }}
              </p>
              <p class="max-w-[140px] truncate text-[10px] leading-tight text-muted">
                {{ auth.user()?.tenantName }}
              </p>
            </div>
            <app-icon
              name="chevron-down"
              [size]="12"
              [strokeWidth]="2"
              class="hidden text-muted-2 lg:block"
            />
          </button>

          <!-- Dropdown -->
          @if (userMenuOpen()) {
            <div
              class="absolute end-0 mt-2 w-64 overflow-hidden rounded-xl border border-hairline bg-surface shadow-xl animate-slide-down"
              role="menu"
              aria-label="User menu"
            >
              <!-- User header -->
              <div class="border-b border-hairline px-4 py-3">
                <p class="truncate text-sm font-semibold text-foreground">
                  {{ auth.displayName() }}
                </p>
                <p class="truncate text-xs text-muted">{{ auth.user()?.email }}</p>
              </div>

              <!-- Menu items -->
              <div class="p-1.5">
                <a
                  routerLink="/settings"
                  (click)="closeUserMenu()"
                  class="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-xs text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
                  role="menuitem"
                >
                  <app-icon name="settings" [size]="14" [strokeWidth]="1.75" />
                  <span>Settings</span>
                </a>
                <a
                  routerLink="/settings"
                  [queryParams]="{ tab: 'api-keys' }"
                  (click)="closeUserMenu()"
                  class="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-xs text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
                  role="menuitem"
                >
                  <app-icon name="key" [size]="14" [strokeWidth]="1.75" />
                  <span>API keys</span>
                </a>
                <a
                  routerLink="/about"
                  (click)="closeUserMenu()"
                  class="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-xs text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
                  role="menuitem"
                >
                  <app-icon name="info" [size]="14" [strokeWidth]="1.75" />
                  <span>About Relayon</span>
                </a>
                <a
                  routerLink="/guide"
                  (click)="closeUserMenu()"
                  class="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-xs text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
                  role="menuitem"
                >
                  <app-icon name="book" [size]="14" [strokeWidth]="1.75" />
                  <span>Help & guide</span>
                </a>
                <a
                  href="mailto:hello@relayon.dev"
                  (click)="closeUserMenu()"
                  class="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-xs text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
                  role="menuitem"
                >
                  <app-icon name="mail" [size]="14" [strokeWidth]="1.75" />
                  <span>Contact support</span>
                </a>
              </div>

              <!-- Language section -->
              <div class="border-t border-hairline p-2">
                <p class="px-2 pb-1.5 pt-1 text-[10px] font-medium uppercase tracking-wider text-muted-2">
                  {{ 'language.label' | transloco }}
                </p>
                <div class="grid grid-cols-3 gap-1">
                  @for (l of languages; track l.code) {
                    <button
                      type="button"
                      (click)="setLanguage(l.code)"
                      [class.bg-surface-2]="lang.current() === l.code"
                      [class.text-foreground]="lang.current() === l.code"
                      [class.text-muted]="lang.current() !== l.code"
                      class="rounded-md px-2 py-1.5 text-xs font-medium transition-colors hover:bg-surface-2"
                      role="menuitemradio"
                      [attr.aria-checked]="lang.current() === l.code"
                    >
                      {{ l.short }}
                    </button>
                  }
                </div>
              </div>

              <!-- Sign out -->
              <div class="border-t border-hairline p-1.5">
                <button
                  type="button"
                  (click)="signOut()"
                  class="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-xs text-signal-rose transition-colors hover:bg-signal-rose/10"
                  role="menuitem"
                >
                  <app-icon name="logout" [size]="14" [strokeWidth]="1.75" />
                  <span>Sign out</span>
                </button>
              </div>

              <!-- Version footer -->
              <div class="border-t border-hairline bg-surface-2 px-3 py-2 text-[10px] text-muted-2">
                <span class="font-mono">Relayon v3.7</span>
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

  readonly auth = inject(AuthService);
  readonly lang = inject(LanguageService);
  private readonly router = inject(Router);

  @ViewChild('userMenuRef') userMenuRef?: ElementRef<HTMLDivElement>;

  readonly userMenuOpen = signal(false);

  readonly languages: Array<{ code: SupportedLang; short: string; label: string }> = [
    { code: 'en', short: 'EN', label: 'English' },
    { code: 'ur', short: 'UR', label: 'اردو' },
    { code: 'ar', short: 'AR', label: 'العربية' },
  ];

  readonly initial = computed(() => {
    const name = this.auth.displayName();
    return name ? name[0]!.toUpperCase() : '?';
  });

  readonly pageTitle = computed(() => {
    const url = this.router.url.split('?')[0] ?? '';
    if (url.startsWith('/dashboard')) return 'Dashboard';
    if (url.startsWith('/workflows')) return 'Workflows';
    if (url.startsWith('/playground')) return 'Playground';
    if (url.startsWith('/events')) return 'Events';
    if (url.startsWith('/dlq')) return 'Dead Letter Queue';
    if (url.startsWith('/analytics')) return 'Analytics';
    if (url.startsWith('/settings')) return 'Settings';
    if (url.startsWith('/community')) return 'Community';
    if (url.startsWith('/admin')) return 'Admin';
    if (url.startsWith('/guide')) return 'Guide';
    if (url.startsWith('/about')) return 'About';
    return 'Relayon';
  });

  toggleUserMenu(): void {
    this.userMenuOpen.update((v) => !v);
  }

  closeUserMenu(): void {
    this.userMenuOpen.set(false);
  }

  signOut(): void {
    this.closeUserMenu();
    this.auth.logout();
  }

  setLanguage(code: SupportedLang): void {
    this.lang.setLanguage(code);
    this.closeUserMenu();
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