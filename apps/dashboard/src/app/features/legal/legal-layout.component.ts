import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

export interface LegalSection {
  id: string;
  title: string;
  content: string; // HTML
}

@Component({
  selector: 'app-legal-layout',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="min-h-screen bg-midnight text-white">
      <!-- Header -->
      <header class="border-b border-hairline bg-surface">
        <div class="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <a routerLink="/" class="flex items-center gap-2">
            <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-relay-violet to-relay-cyan text-sm font-bold">
              R
            </div>
            <span class="text-lg font-bold">Relayon</span>
          </a>
          <nav class="flex gap-4 text-sm">
            <a routerLink="/privacy" class="text-muted hover:text-white">Privacy</a>
            <a routerLink="/terms" class="text-muted hover:text-white">Terms</a>
            <a routerLink="/guide" class="text-muted hover:text-white">Guide</a>
            <a routerLink="/login" class="text-relay-cyan hover:underline">Sign in</a>
          </nav>
        </div>
      </header>

      <main class="mx-auto max-w-5xl px-6 py-12">
        <div class="mb-8">
          <p class="text-xs uppercase tracking-wider text-relay-cyan">{{ eyebrow() }}</p>
          <h1 class="text-3xl font-bold tracking-tight mt-2">{{ title() }}</h1>
          <p class="text-sm text-muted mt-2">Last updated: {{ lastUpdated() }}</p>
        </div>

        <div class="grid gap-8 lg:grid-cols-[240px_1fr]">
          <!-- TOC -->
          <aside class="lg:sticky lg:top-8 lg:self-start">
            <p class="text-xs uppercase tracking-wider text-muted mb-3">On this page</p>
            <nav class="space-y-1">
              @for (s of sections(); track s.id) {
                <a
                  [href]="'#' + s.id"
                  class="block text-sm text-muted hover:text-white py-1 border-s-2 border-transparent hover:border-relay-violet ps-3 transition"
                >{{ s.title }}</a>
              }
            </nav>
          </aside>

          <!-- Content -->
          <article class="space-y-8">
            @for (s of sections(); track s.id) {
              <section [id]="s.id" class="scroll-mt-8">
                <h2 class="text-xl font-semibold text-white mb-3">{{ s.title }}</h2>
                <div class="prose prose-invert prose-sm max-w-none text-muted leading-relaxed" [innerHTML]="s.content"></div>
              </section>
            }
          </article>
        </div>

        <div class="mt-12 pt-8 border-t border-hairline flex justify-between items-center text-sm">
          <a routerLink="/" class="text-muted hover:text-white">← Back to home</a>
          <div class="flex gap-4">
            <a routerLink="/privacy" class="text-muted hover:text-white">Privacy</a>
            <a routerLink="/terms" class="text-muted hover:text-white">Terms</a>
            <a routerLink="/guide" class="text-muted hover:text-white">Guide</a>
          </div>
        </div>
      </main>
    </div>
  `,
  styles: [`
    :host ::ng-deep .prose h3 { color: #fff; font-weight: 600; margin-top: 1.5rem; margin-bottom: 0.5rem; }
    :host ::ng-deep .prose p { margin-bottom: 1rem; }
    :host ::ng-deep .prose ul { list-style: disc; padding-left: 1.5rem; margin-bottom: 1rem; }
    :host ::ng-deep .prose li { margin-bottom: 0.25rem; }
    :host ::ng-deep .prose a { color: #06B6D4; text-decoration: underline; }
    :host ::ng-deep .prose strong { color: #fff; }
    :host ::ng-deep .prose code { background: #1A1A1A; padding: 0.125rem 0.375rem; border-radius: 0.25rem; font-size: 0.875em; }
  `],
})
export class LegalLayoutComponent {
  readonly eyebrow = input.required<string>();
  readonly title = input.required<string>();
  readonly lastUpdated = input.required<string>();
  readonly sections = input.required<LegalSection[]>();
}