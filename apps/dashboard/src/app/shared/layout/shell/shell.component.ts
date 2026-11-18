import { Component, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';
import { filter } from 'rxjs';
import { TranslocoModule } from '@jsverse/transloco';
import { AuthService } from '../../../core/auth/auth.service';
import { LanguageService, type SupportedLang } from '../../../i18n/language.service';
import { ChatWidgetComponent } from '../../../features/ai/chat-widget.component';
import { OfflineBannerComponent } from '../../pwa/offline-banner.component';
import { UpdatePromptComponent } from '../../pwa/update-prompt.component';
import { InstallPromptComponent } from '../../pwa/install-prompt.component';
import { ImpersonationBannerComponent } from '../impersonation-banner.component';
import { HeaderComponent } from '../header/header.component';
import { FooterComponent } from '../footer/footer.component';
import { OnboardingWizardComponent } from '../../../features/onboarding/onboarding-wizard.component';
import { OnboardingService } from '../../../core/onboarding/onboarding.service';
import { AppUpdateService } from '../../../core/pwa/app-update.service';
import { SeoService } from '../../../core/seo/seo.service';

interface NavItem {
  labelKey: string;
  path: string;
  icon: string;
}

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    TranslocoModule,
    ChatWidgetComponent,
    OfflineBannerComponent,
    UpdatePromptComponent,
    InstallPromptComponent,
    ImpersonationBannerComponent,
    HeaderComponent,
    FooterComponent,
    OnboardingWizardComponent,
  ],
  template: `
    <div class="flex h-screen bg-midnight">
      <!-- ── SIDEBAR ────────────────────────────────────────── -->
      <aside
        class="fixed inset-y-0 start-0 z-40 flex w-64 flex-col border-e border-hairline bg-surface transition-transform lg:static lg:translate-x-0"
        [class.-translate-x-full]="!sidebarOpen() && !lang.isRtl()"
        [class.translate-x-full]="!sidebarOpen() && lang.isRtl()"
      >
        <!-- Logo + version badge -->
        <div class="flex h-14 items-center border-b border-hairline px-4">
          <a routerLink="/dashboard" class="flex items-center gap-2">
            <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-relay-violet to-relay-cyan text-sm font-bold text-white">
              R
            </div>
            <span class="text-lg font-bold tracking-tightest text-white">Relayon</span>
            <span class="rounded bg-surface-2 px-1.5 py-0.5 text-[10px] font-mono text-muted">v3.2</span>
          </a>
        </div>

        <!-- Nav -->
        <nav class="flex-1 space-y-1 overflow-y-auto p-3">
          @for (item of navItems; track item.path) {
            <a
              [routerLink]="item.path"
              routerLinkActive="bg-surface-2 text-white"
              [routerLinkActiveOptions]="{ exact: item.path === '/dashboard' }"
              class="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted transition hover:bg-surface-2 hover:text-white"
            >
              <span class="text-base">{{ item.icon }}</span>
              <span>{{ item.labelKey | transloco }}</span>
            </a>
          }

          <!-- ⚠️ v2.4 — super admin only link -->
          @if (auth.user()?.isSuperAdmin) {
            <a
              routerLink="/admin"
              routerLinkActive="bg-signal-rose/10 text-signal-rose"
              class="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted transition hover:bg-signal-rose/10 hover:text-signal-rose"
            >
              <span class="text-base">👑</span>
              <span>Admin</span>
            </a>
          }
        </nav>

        <!-- Language switcher (mobile only) -->
        <div class="border-t border-hairline p-3 lg:hidden">
          <label class="text-xs text-muted uppercase tracking-wider">
            {{ 'language.label' | transloco }}
          </label>
          <select
            [value]="lang.current()"
            (change)="onLangChange($event)"
            class="mt-1 w-full rounded-lg border border-hairline bg-surface-2 px-2 py-1.5 text-xs text-white focus:border-relay-violet focus:outline-none"
          >
            <option value="en">English</option>
            <option value="ur">اردو</option>
            <option value="ar">العربية</option>
          </select>
        </div>

        <!-- ⚠️ v3.2 — Help menu -->
        <div class="border-t border-hairline p-3">
          <p class="text-[10px] uppercase tracking-wider text-muted mb-2">Help</p>
          <div class="space-y-0.5">
            <a routerLink="/guide" class="block text-xs text-muted hover:text-white py-1">📖 Complete Guide</a>
            <a routerLink="/about" class="block text-xs text-muted hover:text-white py-1">👤 About</a>
            <a routerLink="/privacy" class="block text-xs text-muted hover:text-white py-1">🔒 Privacy Policy</a>
            <a routerLink="/terms" class="block text-xs text-muted hover:text-white py-1">📜 Terms of Service</a>
            <a href="mailto:hello@relayon.dev" class="block text-xs text-muted hover:text-white py-1">✉️ Contact Support</a>
          </div>
        </div>

        <!-- ⚠️ v3.2 — Credit (Made with ❤) -->
        <div class="border-t border-hairline p-3">
          <a
            routerLink="/about"
            class="flex items-center gap-2 rounded-lg p-2 -m-2 hover:bg-surface-2 transition"
          >
            <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-relay-violet to-relay-cyan text-[10px] font-bold text-white">
              Z
            </div>
            <div class="min-w-0 flex-1">
              <p class="text-[10px] text-muted leading-tight">Made with ❤ by</p>
              <p class="text-xs font-medium text-white leading-tight truncate">Zain Shah</p>
            </div>
          </a>
        </div>
      </aside>

      <!-- Mobile backdrop -->
      @if (sidebarOpen()) {
        <div class="fixed inset-0 z-30 bg-black/60 lg:hidden" (click)="sidebarOpen.set(false)"></div>
      }

      <!-- ── MAIN COLUMN ─────────────────────────────────────── -->
      <div class="flex flex-1 flex-col overflow-hidden">
        <!-- Header (works on both mobile + desktop) -->
        <app-header (toggleSidebar)="sidebarOpen.set(!sidebarOpen())" />

        <!-- Scrollable content + footer -->
        <div class="flex-1 overflow-y-auto">
          <main class="mx-auto max-w-7xl p-4 lg:p-8">
            <router-outlet />
          </main>
          <app-footer />
        </div>
      </div>

      <!-- Floating widgets -->
      <app-chat-widget />
      <app-offline-banner />
      <app-update-prompt />
      <app-install-prompt />
      <app-impersonation-banner />

      @if (showWizard()) {
        <app-onboarding-wizard (closed)="showWizard.set(false)" />
      }
    </div>
  `,
})
export class ShellComponent {
  auth = inject(AuthService);
  lang = inject(LanguageService);
  sidebarOpen = signal(false);

  private readonly appUpdate = inject(AppUpdateService);
  private readonly onboarding = inject(OnboardingService);
  private readonly seo = inject(SeoService);
  private readonly router = inject(Router);

  showWizard = signal(false);

  navItems: NavItem[] = [
    { labelKey: 'nav.dashboard', path: '/dashboard', icon: '📊' },
    { labelKey: 'nav.workflows', path: '/workflows', icon: '🔄' },
    { labelKey: 'nav.playground', path: '/playground', icon: '🧪' },
    { labelKey: 'nav.events', path: '/events', icon: '📨' },
    { labelKey: 'nav.community', path: '/community', icon: '💬' },
    { labelKey: 'nav.dlq', path: '/dlq', icon: '⚠️' },
    { labelKey: 'nav.analytics', path: '/analytics', icon: '📈' },
    { labelKey: 'nav.settings', path: '/settings', icon: '⚙️' },
  ];

  constructor() {
    try {
      this.appUpdate.init();
    } catch (err) {
      console.warn('[Shell] PWA init failed (non-fatal):', err);
    }

    // ⚠️ v3.3 — default SEO for protected pages (noindex)
    this.seo.set({
      title: 'Dashboard',
      description: 'Relayon dashboard',
      path: '/dashboard',
      noindex: true,
    });

    // ⚠️ v3.2 — onboarding wizard on first dashboard visit
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe((e) => {
        if (e.url.includes('/dashboard')) {
          const shouldShow = this.onboarding.check();
          this.showWizard.set(shouldShow);
        }
      });
  }

  onLangChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value as SupportedLang;
    this.lang.setLanguage(value);
  }

  logout(): void {
    this.auth.logout();
  }
}