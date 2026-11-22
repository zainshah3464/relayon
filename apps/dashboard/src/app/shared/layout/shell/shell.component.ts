import {
  Component,
  inject,
  signal,
  effect,
  PLATFORM_ID,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import {
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
  Router,
  NavigationEnd,
} from '@angular/router';
import { CommonModule } from '@angular/common';
import { filter } from 'rxjs';
import { TranslocoModule } from '@jsverse/transloco';
import { AuthService } from '../../../core/auth/auth.service';
import { LanguageService } from '../../../i18n/language.service';
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
import { LogoComponent } from '../../ui/logo/logo.component';
import { IconComponent, type IconName } from '../../ui/icon/icon.component';

interface NavItem {
  labelKey: string;
  path: string;
  icon: IconName;
}

interface HelpItem {
  labelKey?: string;
  label?: string;
  path?: string;
  href?: string;
  fragment?: string;
  icon: IconName;
  external?: boolean;
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
    LogoComponent,
    IconComponent,
  ],
  template: `
    <div class="flex h-screen bg-midnight overflow-hidden">
      <!-- ═══════════════ SIDEBAR ═══════════════ -->
      <aside
        class="fixed inset-y-0 start-0 z-40 flex w-64 flex-col border-e border-hairline bg-surface transition-transform duration-200 ease-out lg:static lg:translate-x-0"
        [class.-translate-x-full]="!sidebarOpen() && !lang.isRtl()"
        [class.translate-x-full]="!sidebarOpen() && lang.isRtl()"
        [attr.aria-hidden]="!sidebarOpen()"
      >
        <!-- Sidebar header: logo + close -->
        <div class="flex h-14 shrink-0 items-center justify-between border-b border-hairline px-3 sm:px-4">
          <app-logo size="md" [showVersion]="true" />

          <!-- Close button (mobile only) -->
          <button
            type="button"
            (click)="closeSidebar()"
            class="flex h-8 w-8 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface-2 hover:text-foreground lg:hidden"
            aria-label="Close sidebar"
          >
            <app-icon name="x" [size]="16" [strokeWidth]="2" />
          </button>
        </div>

        <!-- Nav -->
        <nav class="flex-1 space-y-0.5 overflow-y-auto p-2.5" aria-label="Main navigation">
          @for (item of navItems; track item.path) {
            <a
              [routerLink]="item.path"
              routerLinkActive="bg-surface-2 text-foreground"
              [routerLinkActiveOptions]="{ exact: item.path === '/dashboard' }"
              (click)="closeSidebar()"
              class="group flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium text-muted transition-colors duration-100 hover:bg-surface-2 hover:text-foreground"
            >
              <app-icon
                [name]="item.icon"
                [size]="16"
                [strokeWidth]="2"
                class="text-muted-2 group-hover:text-foreground transition-colors"
              />
              <span>{{ item.labelKey | transloco }}</span>
            </a>
          }

          <!-- Admin link (super admin only) -->
          @if (auth.user()?.isSuperAdmin) {
            <a
              routerLink="/admin"
              routerLinkActive="bg-signal-rose/10 text-signal-rose"
              (click)="closeSidebar()"
              class="group mt-1 flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium text-muted transition-colors duration-100 hover:bg-signal-rose/10 hover:text-signal-rose"
            >
              <app-icon
                name="crown"
                [size]="16"
                [strokeWidth]="2"
                class="text-muted-2 group-hover:text-signal-rose transition-colors"
              />
              <span>Admin</span>
            </a>
          }
        </nav>

        <!-- Help menu -->
        <div class="border-t border-hairline px-2.5 py-2">
          <p class="px-1 pb-1 text-[10px] font-medium uppercase tracking-wider text-muted-2">
            Help
          </p>
          <div class="space-y-0.5">
            @for (item of helpItems; track item.label ?? item.labelKey) {
              @if (item.href) {
                <a
                  [href]="item.href"
                  class="flex items-center gap-2.5 rounded-md px-1.5 py-1.5 text-xs text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
                >
                  <app-icon [name]="item.icon" [size]="13" [strokeWidth]="1.75" class="text-muted-2" />
                  <span>{{ item.label ?? (item.labelKey! | transloco) }}</span>
                </a>
              } @else {
                <a
                  [routerLink]="item.path!"
                  [fragment]="item.fragment ?? ''"
                  (click)="closeSidebar()"
                  class="flex items-center gap-2.5 rounded-md px-1.5 py-1.5 text-xs text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
                >
                  <app-icon [name]="item.icon" [size]="13" [strokeWidth]="1.75" class="text-muted-2" />
                  <span>{{ item.label ?? (item.labelKey! | transloco) }}</span>
                </a>
              }
            }
          </div>
        </div>

        <!-- Copyright (minimal — full credit in footer) -->
        <div class="border-t border-hairline px-3 py-2.5 pb-safe">
          <p class="text-center text-[10px] text-muted-2">
            © {{ year }} Zain Shah
          </p>
        </div>
      </aside>

      <!-- Mobile backdrop -->
      @if (sidebarOpen()) {
        <div
          class="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm lg:hidden animate-fade-in"
          (click)="closeSidebar()"
          aria-hidden="true"
        ></div>
      }

      <!-- ═══════════════ MAIN COLUMN ═══════════════ -->
      <div class="flex flex-1 flex-col overflow-hidden">
        <app-header (toggleSidebar)="sidebarOpen.set(!sidebarOpen())" />

        <div class="flex-1 overflow-y-auto">
          <main id="main-content" tabindex="-1" class="mx-auto max-w-7xl p-4 lg:p-8 focus:outline-none">
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
  readonly auth = inject(AuthService);
  readonly lang = inject(LanguageService);
  readonly sidebarOpen = signal(false);
  readonly showWizard = signal(false);
  readonly year = new Date().getFullYear();

  private readonly appUpdate = inject(AppUpdateService);
  private readonly onboarding = inject(OnboardingService);
  private readonly seo = inject(SeoService);
  private readonly router = inject(Router);
  private readonly platformId = inject(PLATFORM_ID);

  readonly navItems: NavItem[] = [
    { labelKey: 'nav.dashboard', path: '/dashboard', icon: 'layout-dashboard' },
    { labelKey: 'nav.workflows', path: '/workflows', icon: 'workflow' },
    { labelKey: 'nav.playground', path: '/playground', icon: 'flask' },
    { labelKey: 'nav.events', path: '/events', icon: 'inbox' },
    { labelKey: 'nav.community', path: '/community', icon: 'messages' },
    { labelKey: 'nav.dlq', path: '/dlq', icon: 'alert-triangle' },
    { labelKey: 'nav.analytics', path: '/analytics', icon: 'trending-up' },
    { labelKey: 'nav.settings', path: '/settings', icon: 'settings' },
  ];

  readonly helpItems: HelpItem[] = [
    { label: 'Complete guide', path: '/guide', icon: 'book' },
    { label: 'About', path: '/about', icon: 'info' },
    { label: 'Privacy', path: '/privacy', icon: 'shield' },
    { label: 'Terms', path: '/terms', icon: 'external-link' },
    { label: 'License', path: '/terms', fragment: 'license', icon: 'lock' },
    { label: 'Contact support', href: 'mailto:hello@relayon.dev', icon: 'mail' },
  ];

  constructor() {
    try {
      this.appUpdate.init();
    } catch (err) {
      console.warn('[Shell] PWA init failed (non-fatal):', err);
    }

    this.seo.set({
      title: 'Dashboard',
      description: 'Relayon dashboard',
      path: '/dashboard',
      noindex: true,
    });

    // Auto-close sidebar on navigation + onboarding check
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe((e) => {
        this.sidebarOpen.set(false);
        if (e.url.includes('/dashboard')) {
          const shouldShow = this.onboarding.check();
          this.showWizard.set(shouldShow);
        }
      });

    // Lock body scroll when mobile drawer is open
    if (isPlatformBrowser(this.platformId)) {
      effect(() => {
        if (typeof document === 'undefined') return;
        const shouldLock =
          this.sidebarOpen() && window.matchMedia('(max-width: 1023px)').matches;
        document.body.style.overflow = shouldLock ? 'hidden' : '';
      });
    }
  }

  closeSidebar(): void {
    this.sidebarOpen.set(false);
  }
}