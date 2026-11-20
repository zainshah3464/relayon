import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { SeoService } from '../../core/seo/seo.service';

@Component({
  selector: 'app-about',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="min-h-screen bg-midnight text-white">
      <!-- Nav -->
      <header class="border-b border-hairline bg-surface">
        <div class="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <a routerLink="/" class="flex items-center gap-2">
            <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-relay-violet to-relay-cyan text-sm font-bold text-white">R</div>
            <span class="text-lg font-bold">Relayon</span>
          </a>
          <nav class="flex items-center gap-4 text-sm">
            <a routerLink="/guide" class="text-muted hover:text-white">Guide</a>
            <a routerLink="/dashboard" class="btn-primary text-xs">Dashboard</a>
          </nav>
        </div>
      </header>

      <!-- Hero -->
      <section class="border-b border-hairline bg-gradient-to-b from-surface to-midnight">
        <div class="mx-auto max-w-4xl px-6 py-16 text-center">
          <p class="text-xs uppercase tracking-widest text-relay-cyan">The Story</p>
          <h1 class="mt-3 text-4xl font-bold tracking-tight">
            Built by a developer, for developers.
          </h1>
          <p class="mx-auto mt-4 max-w-2xl text-lg text-muted">
            Relayon isn't a startup with funding. It's not a team of 20 engineers.
            It's one developer who got tired of writing the same webhook integration code over and over.
          </p>
        </div>
      </section>

      <!-- Creator Card -->
      <section class="mx-auto max-w-3xl px-6 py-12">
        <div class="card overflow-hidden p-0">
          <div class="bg-gradient-to-r from-relay-violet to-relay-cyan p-1">
            <div class="bg-surface p-8">
              <div class="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
                <div class="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-relay-violet to-relay-cyan text-3xl font-bold">
                  Z
                </div>
                <div class="flex-1 text-center sm:text-left">
                  <p class="text-xs uppercase tracking-wider text-relay-cyan">Creator & Maintainer</p>
                  <h2 class="mt-1 text-2xl font-bold text-white">Zain Shah</h2>
                  <p class="text-sm text-muted mt-1">
                    Full-stack engineer · Building tools that solve real problems
                  </p>

                  <p class="mt-3 text-sm text-muted leading-relaxed">
                    I built Relayon because every SaaS company writes the same integration code:
                    Stripe webhook → Slack, Shopify order → Sheets, GitHub PR → Jira.
                    It's repetitive, error-prone, and expensive.
                    Relayon makes it a configuration problem — not a coding problem.
                  </p>

                  <!-- Contact links -->
                  <div class="mt-4 flex flex-wrap justify-center gap-2 sm:justify-start">
                    <a
                      href="https://github.com/zainshah3464"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="btn-secondary text-xs"
                    >
                      <svg class="mr-1 inline h-3 w-3" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
                      GitHub
                    </a>
                    <a
                      href="https://instagram.com/zainshah3464"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="btn-secondary text-xs"
                    >
                      Instagram
                    </a>
                    <a
                      href="mailto:zainshahzs110&#64;gmail.com"
                      class="btn-secondary text-xs"
                    >
                      Email
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- ⚠️ v3.7 — License Section -->
      <section class="mx-auto max-w-3xl px-6 pb-12">
        <div class="card border-2 border-signal-amber/40 bg-surface p-6">
          <div class="flex items-start gap-3">
            <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-signal-amber/10 text-xl">
              ⚖️
            </div>
            <div class="flex-1">
              <p class="text-xs uppercase tracking-wider text-signal-amber font-semibold">
                License Notice
              </p>
              <h2 class="mt-1 text-lg font-bold text-white">
                Source-available, not open source
              </h2>
              <p class="mt-2 text-sm text-muted leading-relaxed">
                Relayon's source code is publicly visible for transparency and learning —
                but it is <strong class="text-white">NOT</strong> released under an open-source license.
                It is governed by the <strong class="text-white">Relayon Proprietary Source-Visible License v1.0</strong>.
              </p>
              <ul class="mt-3 space-y-1 text-sm text-muted">
                <li class="flex gap-2"><span class="text-signal-emerald">✅</span> Free to use, self-host, view, and contribute via PR</li>
                <li class="flex gap-2"><span class="text-signal-rose">❌</span> No modification, forking, resale, or AI training without written permission</li>
                <li class="flex gap-2"><span class="text-signal-rose">❌</span> No rebranding, no competing products</li>
                <li class="flex gap-2"><span class="text-signal-rose">❌</span> No removal of "Powered by Relayon" or author attribution</li>
              </ul>
              <p class="mt-3 text-sm text-muted">
                The previous MIT license has been superseded. For permission requests, email
                <a href="mailto:zainshahzs110&#64;gmail.com" class="text-relay-cyan hover:underline">zainshahzs110&#64;gmail.com</a>
                with the subject line
                <span class="font-mono text-xs text-white">"Relayon Permission Request — [Your Name]"</span>.
              </p>
              <div class="mt-4 flex flex-wrap gap-2">
                <a routerLink="/terms" fragment="license" class="btn-primary text-xs">Read full license terms</a>
                <a
                  href="https://github.com/zainshah3464/relayon/blob/main/LICENSE"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="btn-secondary text-xs"
                >
                  LICENSE on GitHub →
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- By the Numbers -->
      <section class="border-y border-hairline bg-surface">
        <div class="mx-auto max-w-5xl px-6 py-12">
          <h2 class="text-center text-2xl font-bold mb-8">Relayon by the numbers</h2>
          <div class="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div class="text-center">
              <p class="text-3xl font-bold text-relay-cyan">340+</p>
              <p class="mt-1 text-xs text-muted">Source files</p>
            </div>
            <div class="text-center">
              <p class="text-3xl font-bold text-relay-cyan">60K+</p>
              <p class="mt-1 text-xs text-muted">Lines of code</p>
            </div>
            <div class="text-center">
              <p class="text-3xl font-bold text-relay-cyan">347</p>
              <p class="mt-1 text-xs text-muted">Automated tests</p>
            </div>
            <div class="text-center">
              <p class="text-3xl font-bold text-relay-cyan">3</p>
              <p class="mt-1 text-xs text-muted">Languages (EN/UR/AR)</p>
            </div>
          </div>
        </div>
      </section>

      <!-- Timeline -->
      <section class="mx-auto max-w-3xl px-6 py-16">
        <h2 class="text-2xl font-bold mb-8">How it was built</h2>
        <div class="space-y-6">
          @for (item of timeline; track item.version) {
            <div class="flex gap-4">
              <div class="flex flex-col items-center">
                <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-relay-violet text-xs font-bold text-white">
                  {{ item.version }}
                </div>
                @if (!$last) {
                  <div class="mt-2 w-0.5 flex-1 bg-hairline"></div>
                }
              </div>
              <div class="pb-6">
                <p class="text-sm font-semibold text-white">{{ item.title }}</p>
                <p class="mt-1 text-sm text-muted">{{ item.description }}</p>
              </div>
            </div>
          }
        </div>
      </section>

      <!-- Tech Stack -->
      <section class="border-t border-hairline bg-surface">
        <div class="mx-auto max-w-4xl px-6 py-12">
          <h2 class="text-center text-2xl font-bold mb-8">Built with</h2>
          <div class="flex flex-wrap justify-center gap-2">
            @for (tech of stack; track tech) {
              <span class="rounded-lg border border-hairline bg-surface-2 px-3 py-1.5 text-xs font-mono text-muted">
                {{ tech }}
              </span>
            }
          </div>
          <p class="mt-8 text-center text-sm text-muted">
            Zero paid dependencies. Runs on the free tier of every service it uses.
            <br>
            <span class="text-relay-cyan">Because great tools shouldn't cost a fortune to build.</span>
          </p>
        </div>
      </section>

      <!-- CTA -->
      <section class="mx-auto max-w-3xl px-6 py-16 text-center">
        <h2 class="text-2xl font-bold">Want to try it?</h2>
        <p class="mt-2 text-muted">Free forever for the free tier. No credit card. No sales call.</p>
        <div class="mt-6 flex justify-center gap-3">
          <a routerLink="/signup" class="btn-primary">Get started free</a>
          <a routerLink="/guide" class="btn-secondary">Read the guide</a>
        </div>
        <p class="mt-8 text-xs text-muted">
          ⭐ If Relayon helped you, please
          <a
            href="https://github.com/zainshah3464/relayon"
            target="_blank"
            rel="noopener noreferrer"
            class="text-relay-cyan hover:underline"
          >star it on GitHub</a>
          — it helps more developers find it.
        </p>
      </section>

      <!-- Footer -->
      <footer class="border-t border-hairline">
        <div class="mx-auto max-w-5xl px-6 py-8 text-center text-xs text-muted">
          <p>Relayon v3.7 · Made with <span class="text-signal-rose">❤</span> in Pakistan 🇵🇰</p>
          <p class="mt-2">© {{ year }} Zain Shah · All rights reserved · Source-available under Relayon Proprietary License</p>
          <div class="mt-3 flex justify-center gap-4">
            <a routerLink="/privacy" class="hover:text-white">Privacy</a>
            <a routerLink="/terms" class="hover:text-white">Terms</a>
            <a routerLink="/terms" fragment="license" class="hover:text-white">License</a>
            <a routerLink="/guide" class="hover:text-white">Guide</a>
            <a href="mailto:hello&#64;relayon.dev" class="hover:text-white">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  `,
})
export class AboutComponent {
  readonly year = new Date().getFullYear();

  constructor() {
    inject(SeoService).set({
      title: 'About — Built by Zain Shah',
      description:
        'Relayon is a serverless webhook relay platform built by Zain Shah — one developer, zero funding, 60,000+ lines of code, all running on free tier. Source-available under the Relayon Proprietary License.',
      path: '/about',
      keywords: ['relayon story', 'zain shah', 'webhook platform creator', 'indie developer', 'source-available license'],
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

  readonly timeline = [
    { version: 'v1.0', title: 'Foundation', description: 'Express ingress, NestJS API, Angular dashboard. Real auth with JWT refresh tokens.' },
    { version: 'v1.5', title: 'AI-native', description: 'Groq integration — enrichment, transforms, and reliability engineering (retry, DLQ, circuit breaker).' },
    { version: 'v2.0', title: 'Production-grade', description: 'Docker, Stripe billing, dedicated adapter service. Enterprise-ready.' },
    { version: 'v2.5', title: 'Testing & hardening', description: '347 tests, mutation coverage, load-tested to 500 RPS. Locked down.' },
    { version: 'v3.0', title: 'The Standard', description: 'Standard Webhooks, transactional outbox, OpenAPI SDK, CLI tunnel, PWA, i18n (EN/UR/AR).' },
    { version: 'v3.2', title: 'Complete', description: 'Privacy Policy, Terms, interactive guide, onboarding wizard, admin panel, community.' },
    { version: 'v3.7', title: 'Licensed & locked', description: 'Relayon Proprietary Source-Visible License v1.0. MIT legacy retired. All IP protected.' },
  ];

  readonly stack = [
    'Angular 19',
    'NestJS 11',
    'Express 5',
    'TypeScript 5.7',
    'PostgreSQL 16',
    'MongoDB',
    'Redis',
    'Groq',
    'TailwindCSS',
    'Prisma',
    'Mongoose',
    'Transloco',
    'Vercel',
    'Docker',
  ];
}