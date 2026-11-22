import {
  Component,
  inject,
  input,
  signal,
  OnInit,
  OnDestroy,
  PLATFORM_ID,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';
import { LogoComponent } from '../../shared/ui/logo/logo.component';
import { IconComponent } from '../../shared/ui/icon/icon.component';

export interface LegalSection {
  id: string;
  title: string;
  content: string;
}

@Component({
  selector: 'app-legal-layout',
  standalone: true,
  imports: [CommonModule, RouterLink, LogoComponent, IconComponent],
  template: `
    <div class="min-h-screen bg-midnight text-foreground">
      <!-- ═══════════ HEADER ═══════════ -->
      <header class="sticky top-0 z-30 border-b border-hairline bg-midnight/90 backdrop-blur-md">
        <div class="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <app-logo size="md" link="/" [showVersion]="true" />

          <nav class="flex items-center gap-1.5 text-sm">
            <a routerLink="/guide" class="btn-ghost hidden text-xs sm:inline-flex">
              <app-icon name="book" [size]="11" [strokeWidth]="2" />
              <span>Guide</span>
            </a>
            <a routerLink="/about" class="btn-ghost hidden text-xs sm:inline-flex">
              <app-icon name="info" [size]="11" [strokeWidth]="2" />
              <span>About</span>
            </a>
            <a routerLink="/login" class="btn-primary text-xs">
              <span>Sign in</span>
              <app-icon name="arrow-right" [size]="11" [strokeWidth]="2.5" />
            </a>
          </nav>
        </div>
      </header>

      <!-- ═══════════ HERO ═══════════ -->
      <section class="relative overflow-hidden border-b border-hairline">
        <div class="absolute inset-0 bg-gradient-to-b from-relay-violet/[0.06] via-midnight to-midnight"></div>
        <div class="absolute -top-32 left-1/3 h-48 w-[30rem] -translate-x-1/2 rounded-full bg-relay-violet/10 blur-[100px]"></div>

        <div class="relative mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
          <div class="inline-flex items-center gap-2 rounded-full border border-hairline bg-surface px-3 py-1">
            <span class="h-1.5 w-1.5 rounded-full bg-relay-cyan"></span>
            <span class="text-[11px] font-medium uppercase tracking-wider text-relay-cyan">
              {{ eyebrow() }}
            </span>
          </div>

          <h1 class="mt-4 text-3xl font-bold tracking-tighter text-foreground sm:text-4xl lg:text-5xl">
            {{ title() }}
          </h1>

          <div class="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted">
            <span class="flex items-center gap-1.5">
              <app-icon name="calendar" [size]="12" [strokeWidth]="2" />
              Last updated: {{ lastUpdated() }}
            </span>
            <span class="text-muted-2">·</span>
            <span>{{ sections().length }} sections</span>
            <span class="text-muted-2">·</span>
            <span class="flex items-center gap-1.5">
              <app-icon name="file-text" [size]="12" [strokeWidth]="2" />
              ~{{ estimatedReadMinutes() }} min read
            </span>
          </div>
        </div>
      </section>

      <!-- ═══════════ CONTENT ═══════════ -->
      <main class="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
        <div class="grid gap-8 lg:grid-cols-[220px_1fr] lg:gap-10">
          <!-- ═══ TOC ═══ -->
          <aside class="lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:self-start lg:overflow-y-auto">

            <!-- Mobile TOC (collapsible) -->
            <details class="group lg:hidden">
              <summary class="card flex cursor-pointer list-none items-center justify-between p-3 [&::-webkit-details-marker]:hidden">
                <div class="flex items-center gap-2">
                  <app-icon name="list" [size]="14" [strokeWidth]="2" class="text-relay-cyan" />
                  <span class="text-sm font-medium text-foreground">Table of contents</span>
                  <span class="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] text-muted">
                    {{ sections().length }}
                  </span>
                </div>
                <app-icon
                  name="chevron-down"
                  [size]="14"
                  [strokeWidth]="2.5"
                  class="text-muted-2 transition-transform group-open:rotate-180"
                />
              </summary>

              <nav class="mt-2 space-y-0.5 rounded-lg border border-hairline bg-surface p-2">
                @for (s of sections(); track s.id) {
                  <a
                    [href]="'#' + s.id"
                    (click)="scrollTo(s.id, $event)"
                    class="block rounded-md px-2 py-1.5 text-xs transition-colors"
                    [ngClass]="{
                      'bg-relay-violet/10': activeSection() === s.id,
                      'text-relay-cyan': activeSection() === s.id,
                      'text-muted': activeSection() !== s.id,
                      'hover:text-foreground': activeSection() !== s.id
                    }"
                  >
                    {{ s.title }}
                  </a>
                }
              </nav>
            </details>

            <!-- Desktop TOC (sticky sidebar) -->
            <div class="hidden lg:block">
              <p class="mb-3 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-2">
                <app-icon name="list" [size]="11" [strokeWidth]="2" />
                On this page
              </p>

              <nav class="space-y-0.5">
                @for (s of sections(); track s.id) {
                  <a
                    [href]="'#' + s.id"
                    (click)="scrollTo(s.id, $event)"
                    class="block border-s-2 py-1.5 ps-3 text-xs transition-colors"
                    [class.border-relay-violet]="activeSection() === s.id"
                    [class.border-transparent]="activeSection() !== s.id"
                    [class.text-foreground]="activeSection() === s.id"
                    [class.text-muted]="activeSection() !== s.id"
                    [class.hover:text-foreground]="activeSection() !== s.id"
                  >
                    {{ s.title }}
                  </a>
                }
              </nav>
            </div>
          </aside>

          <!-- ═══ ARTICLE ═══ -->
          <article class="min-w-0">
            @for (s of sections(); track s.id) {
              <section [id]="s.id" class="mb-10 scroll-mt-20 last:mb-0">
                <h2 class="text-lg font-semibold tracking-tight text-foreground">
                  {{ s.title }}
                </h2>
                <div class="legal-prose mt-3" [innerHTML]="s.content"></div>
              </section>
            }

            <!-- Contact card -->
            <div class="mt-10 rounded-lg border border-hairline bg-surface-2/50 p-4">
              <div class="flex items-start gap-2.5">
                <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-relay-cyan/10 text-relay-cyan">
                  <app-icon name="mail" [size]="14" [strokeWidth]="2" />
                </div>
                <div class="min-w-0 flex-1">
                  <p class="text-sm font-medium text-foreground">
                    Questions about this document?
                  </p>
                  <p class="mt-1 text-xs text-muted">
                    Reach out to
                    <a href="mailto:hello@relayon.dev" class="text-relay-cyan hover:underline">hello&#64;relayon.dev</a>
                    — we respond within 48 hours.
                  </p>
                </div>
              </div>
            </div>

            <!-- Footer navigation -->
            <div class="mt-8 flex flex-wrap items-center gap-2 border-t border-hairline pt-6">
              <a routerLink="/" class="btn-secondary text-xs">
                <app-icon name="arrow-left" [size]="11" [strokeWidth]="2.5" />
                <span>Back to home</span>
              </a>
              <span class="ms-auto flex gap-1">
                @if (currentPath() !== 'privacy') {
                  <a routerLink="/privacy" class="btn-ghost text-xs">Privacy</a>
                }
                @if (currentPath() !== 'terms') {
                  <a routerLink="/terms" class="btn-ghost text-xs">Terms</a>
                }
                <a routerLink="/guide" class="btn-ghost text-xs">Guide</a>
              </span>
            </div>
          </article>
        </div>
      </main>

      <!-- ═══════════ FOOTER ═══════════ -->
      <footer class="border-t border-hairline bg-surface/30">
        <div class="mx-auto max-w-5xl px-4 py-6 sm:px-6">
          <div class="flex flex-col items-center justify-between gap-3 sm:flex-row">
            <app-logo size="xs" link="/" [showVersion]="false" />
            <p class="text-[11px] text-muted-2">
              © {{ year }} Zain Shah · All rights reserved
            </p>
          </div>
        </div>
      </footer>

      <!-- ═══ BACK TO TOP ═══ -->
      @if (showBackToTop()) {
        <button
          type="button"
          (click)="scrollToTop()"
          class="fixed bottom-6 end-6 z-30 flex h-10 w-10 items-center justify-center rounded-full border border-hairline bg-surface text-muted shadow-lg transition-all hover:border-hairline-strong hover:text-foreground animate-slide-up pb-safe"
          aria-label="Back to top"
        >
          <app-icon name="arrow-up" [size]="16" [strokeWidth]="2.25" />
        </button>
      }
    </div>
  `,
})
export class LegalLayoutComponent implements OnInit, OnDestroy {
  readonly eyebrow = input.required<string>();
  readonly title = input.required<string>();
  readonly lastUpdated = input.required<string>();
  readonly sections = input.required<LegalSection[]>();

  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  readonly activeSection = signal<string>('');
  readonly showBackToTop = signal(false);
  readonly year = new Date().getFullYear();

  private observer: IntersectionObserver | null = null;

  /** Rough read time based on total content length */
  readonly estimatedReadMinutes = signal(5);

  currentPath(): string {
    if (!this.isBrowser) return '';
    return window.location.pathname.replace(/^\/+/, '');
  }

  ngOnInit(): void {
    if (!this.isBrowser) return;

    // Estimate read time
    const totalChars = this.sections().reduce(
      (acc, s) => acc + s.content.replace(/<[^>]+>/g, '').length,
      0,
    );
    const words = totalChars / 5;
    this.estimatedReadMinutes.set(Math.max(1, Math.round(words / 200)));
  }

  ngAfterViewInit(): void {
    if (!this.isBrowser || !('IntersectionObserver' in window)) return;

    // Setup scroll spy
    this.observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort(
            (a, b) =>
              a.boundingClientRect.top - b.boundingClientRect.top,
          );
        if (visible[0]) {
          this.activeSection.set(visible[0].target.id);
        }
      },
      {
        rootMargin: '-100px 0px -65% 0px',
        threshold: 0,
      },
    );

    for (const s of this.sections()) {
      const el = document.getElementById(s.id);
      if (el) this.observer.observe(el);
    }

    // Setup back-to-top visibility
    window.addEventListener('scroll', this.onScroll, { passive: true });
    this.onScroll();
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
    if (this.isBrowser) {
      window.removeEventListener('scroll', this.onScroll);
    }
  }

  private readonly onScroll = (): void => {
    this.showBackToTop.set(window.scrollY > 600);
  };

  scrollTo(id: string, event: Event): void {
    if (!this.isBrowser) return;
    event.preventDefault();

    const el = document.getElementById(id);
    if (!el) return;

    // Smooth scroll with offset for sticky header (80px)
    const top = el.getBoundingClientRect().top + window.scrollY - 80;
    window.scrollTo({ top, behavior: 'smooth' });

    // Update URL hash without jumping
    history.replaceState(null, '', `#${id}`);
    this.activeSection.set(id);
  }

  scrollToTop(): void {
    if (!this.isBrowser) return;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}