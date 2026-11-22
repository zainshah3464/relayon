import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { SeoService } from '../../core/seo/seo.service';
import { LogoComponent } from '../../shared/ui/logo/logo.component';
import { IconComponent, type IconName } from '../../shared/ui/icon/icon.component';

interface TimelineItem {
  version: string;
  title: string;
  description: string;
}

interface StatItem {
  value: string;
  label: string;
}

interface StackItem {
  name: string;
  icon: IconName;
}

@Component({
  selector: 'app-about',
  standalone: true,
  imports: [CommonModule, RouterLink, LogoComponent, IconComponent],
  template: `
    <div class="min-h-screen bg-midnight text-foreground">
      <!-- ═══════════ HEADER ═══════════ -->
      <header class="sticky top-0 z-30 border-b border-hairline bg-midnight/90 backdrop-blur-md">
        <div class="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <app-logo size="md" link="/" [showVersion]="true" />

          <nav class="flex items-center gap-2 text-sm">
            <a routerLink="/guide" class="btn-ghost text-xs">Guide</a>
            <a routerLink="/dashboard" class="btn-primary text-xs">
              <app-icon name="layout-dashboard" [size]="11" [strokeWidth]="2" />
              <span>Dashboard</span>
            </a>
          </nav>
        </div>
      </header>

      <!-- ═══════════ HERO ═══════════ -->
      <section class="relative overflow-hidden border-b border-hairline">
        <div class="absolute inset-0 bg-gradient-to-b from-relay-violet/[0.08] via-midnight to-midnight"></div>
        <div class="absolute -top-32 left-1/2 h-64 w-[40rem] -translate-x-1/2 rounded-full bg-relay-violet/15 blur-[120px]"></div>

        <div class="relative mx-auto max-w-4xl px-4 py-14 text-center sm:px-6 sm:py-20">
          <div class="inline-flex items-center gap-2 rounded-full border border-hairline bg-surface px-3 py-1">
            <span class="h-1.5 w-1.5 rounded-full bg-relay-cyan"></span>
            <span class="text-[11px] font-medium uppercase tracking-wider text-relay-cyan">The Story</span>
          </div>

          <h1 class="mt-5 text-3xl font-bold tracking-tighter text-foreground sm:text-4xl lg:text-5xl">
            Built by a developer,<br />
            <span class="text-gradient-brand">for developers</span>.
          </h1>
          <p class="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-muted sm:text-lg">
            Relayon isn't a startup with funding. It's not a team of 20 engineers.
            It's one developer who got tired of writing the same webhook integration code over and over.
          </p>
        </div>
      </section>

      <!-- ═══════════ CREATOR CARD ═══════════ -->
      <section class="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <div class="overflow-hidden rounded-2xl border border-hairline bg-surface">
          <div class="h-1 bg-gradient-to-r from-relay-violet to-relay-cyan"></div>
          <div class="p-6 sm:p-8">
            <div class="flex flex-col items-center gap-5 sm:flex-row sm:items-start">
              <div class="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-relay-violet to-relay-cyan text-3xl font-bold text-white shadow-lg">
                Z
              </div>
              <div class="min-w-0 flex-1 text-center sm:text-left">
                <p class="text-[11px] font-medium uppercase tracking-wider text-relay-cyan">
                  Creator & Maintainer
                </p>
                <h2 class="mt-1 text-2xl font-bold tracking-tight text-foreground">
                  Zain Shah
                </h2>
                <p class="mt-1 text-sm text-muted">
                  Full-stack engineer · Building tools that solve real problems
                </p>

                <p class="mt-4 text-sm leading-relaxed text-muted">
                  I built Relayon because every SaaS company writes the same integration code:
                  Stripe webhook → Slack, Shopify order → Sheets, GitHub PR → Jira.
                  It's repetitive, error-prone, and expensive.
                  Relayon makes it a configuration problem — not a coding problem.
                </p>

                <div class="mt-4 flex flex-wrap justify-center gap-2 sm:justify-start">
                  <a
                    href="https://github.com/zainshah3464"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="btn-secondary text-xs"
                  >
                    <svg class="h-3 w-3" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
                    <span>GitHub</span>
                  </a>
                  <a
                    href="https://instagram.com/zainshah3464"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="btn-secondary text-xs"
                  >
                    <span>Instagram</span>
                  </a>
                  <a href="mailto:zainshahzs110@gmail.com" class="btn-secondary text-xs">
                    <app-icon name="mail" [size]="11" [strokeWidth]="2" />
                    <span>Email</span>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- ═══════════ LICENSE ═══════════ -->
      <section class="mx-auto max-w-3xl px-4 pb-10 sm:px-6">
        <div class="rounded-2xl border border-signal-amber/30 bg-signal-amber/[0.04] p-6">
          <div class="flex items-start gap-3">
            <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-signal-amber/15 text-signal-amber">
              <app-icon name="scale" [size]="18" [strokeWidth]="2" />
            </div>
            <div class="min-w-0 flex-1">
              <p class="text-[11px] font-medium uppercase tracking-wider text-signal-amber">
                License Notice
              </p>
              <h2 class="mt-1 text-lg font-bold text-foreground">
                Source-available, not open source
              </h2>
              <p class="mt-2 text-sm leading-relaxed text-muted">
                Relayon's source code is publicly visible for transparency and learning —
                but it is <strong class="text-foreground">NOT</strong> released under an open-source license.
                It is governed by the <strong class="text-foreground">Relayon Proprietary Source-Visible License v1.0</strong>.
              </p>

              <ul class="mt-3 space-y-1.5 text-sm">
                <li class="flex items-start gap-2">
                  <app-icon name="check-circle" [size]="13" [strokeWidth]="2" class="mt-0.5 shrink-0 text-signal-green" />
                  <span class="text-muted">Free to use, self-host, view, and contribute via PR</span>
                </li>
                <li class="flex items-start gap-2">
                  <app-icon name="x-circle" [size]="13" [strokeWidth]="2" class="mt-0.5 shrink-0 text-signal-rose" />
                  <span class="text-muted">No modification, forking, resale, or AI training without written permission</span>
                </li>
                <li class="flex items-start gap-2">
                  <app-icon name="x-circle" [size]="13" [strokeWidth]="2" class="mt-0.5 shrink-0 text-signal-rose" />
                  <span class="text-muted">No rebranding, no competing products</span>
                </li>
                <li class="flex items-start gap-2">
                  <app-icon name="x-circle" [size]="13" [strokeWidth]="2" class="mt-0.5 shrink-0 text-signal-rose" />
                  <span class="text-muted">No removal of "Powered by Relayon" or author attribution</span>
                </li>
              </ul>

              <p class="mt-3 text-sm text-muted">
                The previous MIT license has been superseded. For permission requests, email
                <a href="mailto:zainshahzs110@gmail.com" class="text-relay-cyan hover:underline">zainshahzs110&#64;gmail.com</a>
                with the subject line
                <code class="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-xs text-foreground">Relayon Permission Request — [Your Name]</code>.
              </p>

              <div class="mt-4 flex flex-wrap gap-2">
                <a routerLink="/terms" fragment="license" class="btn-primary text-xs">
                  <app-icon name="scale" [size]="11" [strokeWidth]="2" />
                  <span>Read full license terms</span>
                </a>
                <a
                  href="https://github.com/zainshah3464/relayon/blob/main/LICENSE"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="btn-secondary text-xs"
                >
                  <span>LICENSE on GitHub</span>
                  <app-icon name="external-link" [size]="11" [strokeWidth]="2" />
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- ═══════════ BY THE NUMBERS ═══════════ -->
      <section class="border-y border-hairline bg-surface">
        <div class="mx-auto max-w-5xl px-4 py-12 sm:px-6">
          <h2 class="text-center text-2xl font-bold tracking-tight text-foreground">
            Relayon by the numbers
          </h2>
          <div class="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
            @for (s of stats; track s.label) {
              <div class="rounded-xl border border-hairline bg-surface-2/50 p-4 text-center">
                <p class="text-3xl font-bold tabular-nums text-gradient-brand">{{ s.value }}</p>
                <p class="mt-1 text-[11px] text-muted">{{ s.label }}</p>
              </div>
            }
          </div>
        </div>
      </section>

      <!-- ═══════════ TIMELINE ═══════════ -->
      <section class="mx-auto max-w-3xl px-4 py-14 sm:px-6">
        <h2 class="text-2xl font-bold tracking-tight text-foreground">How it was built</h2>
        <div class="mt-8 space-y-4">
          @for (item of timeline; track item.version; let last = $last) {
            <div class="flex gap-4">
              <div class="flex flex-col items-center">
                <div class="flex h-10 w-12 shrink-0 items-center justify-center rounded-lg border border-hairline bg-surface font-mono text-[11px] font-bold text-foreground">
                  {{ item.version }}
                </div>
                @if (!last) {
                  <div class="mt-2 w-px flex-1 bg-hairline"></div>
                }
              </div>
              <div class="flex-1 pb-4">
                <p class="text-sm font-semibold text-foreground">{{ item.title }}</p>
                <p class="mt-1 text-sm leading-relaxed text-muted">{{ item.description }}</p>
              </div>
            </div>
          }
        </div>
      </section>

      <!-- ═══════════ TECH STACK ═══════════ -->
      <section class="border-y border-hairline bg-surface">
        <div class="mx-auto max-w-4xl px-4 py-12 sm:px-6">
          <h2 class="text-center text-2xl font-bold tracking-tight text-foreground">
            Built with
          </h2>
          <div class="mt-6 flex flex-wrap justify-center gap-2">
            @for (tech of stack; track tech.name) {
              <span class="inline-flex items-center gap-1.5 rounded-lg border border-hairline bg-surface-2 px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:border-hairline-strong hover:text-foreground">
                <app-icon [name]="tech.icon" [size]="11" [strokeWidth]="2" class="text-relay-cyan" />
                <span>{{ tech.name }}</span>
              </span>
            }
          </div>
          <p class="mx-auto mt-8 max-w-lg text-center text-sm text-muted">
            Zero paid dependencies. Runs on the free tier of every service it uses.
            <br />
            <span class="text-relay-cyan">Because great tools shouldn't cost a fortune to build.</span>
          </p>
        </div>
      </section>

      <!-- ═══════════ CTA ═══════════ -->
      <section class="relative overflow-hidden">
        <div class="absolute inset-0 bg-gradient-to-b from-midnight to-relay-violet/[0.06]"></div>
        <div class="absolute -bottom-32 left-1/2 h-64 w-[40rem] -translate-x-1/2 rounded-full bg-relay-violet/15 blur-[120px]"></div>

        <div class="relative mx-auto max-w-3xl px-4 py-16 text-center sm:px-6">
          <h2 class="text-2xl font-bold tracking-tight text-foreground">Want to try it?</h2>
          <p class="mt-2 text-muted">
            Free forever for the free tier. No credit card. No sales call.
          </p>
          <div class="mt-6 flex flex-wrap justify-center gap-2">
            <a routerLink="/signup" class="btn-primary">
              <span>Get started free</span>
              <app-icon name="arrow-right" [size]="13" [strokeWidth]="2.5" />
            </a>
            <a routerLink="/guide" class="btn-secondary">Read the guide</a>
          </div>
          <p class="mt-8 flex flex-wrap items-center justify-center gap-1 text-xs text-muted">
            <app-icon name="star" [size]="12" [strokeWidth]="2" class="text-signal-amber" />
            <span>If Relayon helped you, please</span>
            <a
              href="https://github.com/zainshah3464/relayon"
              target="_blank"
              rel="noopener noreferrer"
              class="text-relay-cyan hover:underline"
            >
              star it on GitHub
            </a>
            <span>— it helps more developers find it.</span>
          </p>
        </div>
      </section>

      <!-- ═══════════ FOOTER ═══════════ -->
      <footer class="border-t border-hairline">
        <div class="mx-auto max-w-5xl px-4 py-8 text-center sm:px-6">
          <p class="flex flex-wrap items-center justify-center gap-1 text-xs text-muted">
            <span class="font-mono">Relayon v3.7</span>
            <span class="text-muted-2">·</span>
            <span>Made with</span>
            <app-icon name="heart" [size]="10" [strokeWidth]="2" class="text-signal-rose" />
            <span>in Pakistan</span>
          </p>
          <p class="mt-2 text-xs text-muted-2">
            © {{ year }} Zain Shah · All rights reserved · Source-available under Relayon Proprietary License
          </p>
          <div class="mt-3 flex flex-wrap justify-center gap-4 text-xs">
            <a routerLink="/privacy" class="text-muted transition-colors hover:text-foreground">Privacy</a>
            <a routerLink="/terms" class="text-muted transition-colors hover:text-foreground">Terms</a>
            <a routerLink="/terms" fragment="license" class="text-muted transition-colors hover:text-foreground">License</a>
            <a routerLink="/guide" class="text-muted transition-colors hover:text-foreground">Guide</a>
            <a href="mailto:hello@relayon.dev" class="text-muted transition-colors hover:text-foreground">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  `,
})
export class AboutComponent {
  readonly year = new Date().getFullYear();

  readonly stats: StatItem[] = [
    { value: '340+', label: 'Source files' },
    { value: '60K+', label: 'Lines of code' },
    { value: '347', label: 'Automated tests' },
    { value: '3', label: 'Languages (EN/UR/AR)' },
  ];

  readonly timeline: TimelineItem[] = [
    { version: 'v1.0', title: 'Foundation', description: 'Express ingress, NestJS API, Angular dashboard. Real auth with JWT refresh tokens.' },
    { version: 'v1.5', title: 'AI-native', description: 'Groq integration — enrichment, transforms, and reliability engineering (retry, DLQ, circuit breaker).' },
    { version: 'v2.0', title: 'Production-grade', description: 'Docker, Stripe billing, dedicated adapter service. Enterprise-ready.' },
    { version: 'v2.5', title: 'Testing & hardening', description: '347 tests, mutation coverage, load-tested to 500 RPS. Locked down.' },
    { version: 'v3.0', title: 'The Standard', description: 'Standard Webhooks, transactional outbox, OpenAPI SDK, CLI tunnel, PWA, i18n (EN/UR/AR).' },
    { version: 'v3.2', title: 'Complete', description: 'Privacy Policy, Terms, interactive guide, onboarding wizard, admin panel, community.' },
    { version: 'v3.7', title: 'Licensed & locked', description: 'Relayon Proprietary Source-Visible License v1.0. MIT legacy retired. All IP protected.' },
  ];

  readonly stack: StackItem[] = [
    { name: 'Angular 19', icon: 'code' },
    { name: 'NestJS 11', icon: 'server' as IconName },
    { name: 'Express 5', icon: 'server' as IconName },
    { name: 'TypeScript 5.7', icon: 'code' },
    { name: 'PostgreSQL 16', icon: 'database' },
    { name: 'MongoDB', icon: 'database' },
    { name: 'Redis', icon: 'database' },
    { name: 'Groq', icon: 'brain' },
    { name: 'TailwindCSS', icon: 'layers' },
    { name: 'Prisma', icon: 'database' },
    { name: 'Mongoose', icon: 'database' },
    { name: 'Transloco', icon: 'globe' },
    { name: 'Vercel', icon: 'rocket' },
    { name: 'Docker', icon: 'layers' },
  ];

  constructor() {
    inject(SeoService).set({
      title: 'About — Built by Zain Shah',
      description:
        'Relayon is a serverless webhook relay platform built by Zain Shah — one developer, zero funding, 60,000+ lines of code, all running on free tier. Source-available under the Relayon Proprietary License.',
      path: '/about',
      keywords: [
        'relayon story',
        'zain shah',
        'webhook platform creator',
        'indie developer',
        'source-available license',
      ],
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'AboutPage',
        name: 'About Relayon',
        url: 'https://relayon.vercel.app/about',
        mainEntity: {
          '@type': 'Person',
          name: 'Zain Shah',
          jobTitle: 'Full-Stack Engineer',
          url: 'https://github.com/zainshah3464',
          sameAs: [
            'https://github.com/zainshah3464',
            'https://instagram.com/zainshah3464',
          ],
        },
      },
    });
  }
}