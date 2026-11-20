import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <footer class="border-t border-hairline bg-surface">
      <div class="mx-auto max-w-7xl px-6 py-6">
        <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <!-- Left: Brand + credit -->
          <div class="flex flex-col gap-1">
            <div class="flex items-center gap-2">
              <div class="flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br from-relay-violet to-relay-cyan text-[10px] font-bold text-white">
                R
              </div>
              <span class="text-sm font-semibold text-white">Relayon</span>
              <span class="rounded bg-surface-2 px-1.5 py-0.5 text-[10px] font-mono text-muted">v3.7</span>
            </div>
            <p class="text-xs text-muted">
              Made with <span class="text-signal-rose">❤</span> by
              <a
                href="https://github.com/zainshah3464"
                target="_blank"
                rel="noopener noreferrer"
                class="font-medium text-white hover:text-relay-cyan transition-colors"
              >Zain Shah</a>
              <span class="mx-1">·</span>
              <a routerLink="/about" class="text-relay-cyan hover:underline">Our story</a>
            </p>
          </div>

          <!-- Right: Links -->
          <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
            <a routerLink="/guide" class="hover:text-white transition-colors">Guide</a>
            <a routerLink="/community" class="hover:text-white transition-colors">Community</a>
            <a routerLink="/privacy" class="hover:text-white transition-colors">Privacy</a>
            <a routerLink="/terms" class="hover:text-white transition-colors">Terms</a>
            <a
              href="https://github.com/zainshah3464/relayon"
              target="_blank"
              rel="noopener noreferrer"
              class="flex items-center gap-1 hover:text-white transition-colors"
            >
              <svg class="h-3 w-3" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
              </svg>
              GitHub
            </a>
          </div>
        </div>

        <!-- Bottom line -->
        <div class="mt-4 border-t border-hairline pt-4 text-center text-[11px] text-muted">
          © {{ year }} Zain Shah · All rights reserved · Unauthorized modification prohibited
        </div>
        <div class="mt-1 text-center text-[11px] text-muted">
          Relayon is <span class="text-relay-cyan">source-available</span>, not open source ·
          <a routerLink="/terms#license" class="text-relay-cyan hover:underline">Read License</a>
          · Built in Pakistan 🇵🇰
        </div>
      </div>
    </footer>
  `,
})
export class FooterComponent {
  readonly year = new Date().getFullYear();
}