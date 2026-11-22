import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { LogoComponent } from '../../ui/logo/logo.component';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [CommonModule, RouterLink, LogoComponent],
  template: `
    <footer class="border-t border-hairline bg-surface">
      <div class="mx-auto max-w-7xl px-4 py-5 sm:px-6">
        <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <!-- Left: Brand -->
          <app-logo size="sm" [showVersion]="true" />

          <!-- Right: Links -->
          <div class="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
            <a routerLink="/guide" class="text-muted transition-colors hover:text-foreground">
              Guide
            </a>
            <a routerLink="/community" class="text-muted transition-colors hover:text-foreground">
              Community
            </a>
            <a routerLink="/privacy" class="text-muted transition-colors hover:text-foreground">
              Privacy
            </a>
            <a routerLink="/terms" class="text-muted transition-colors hover:text-foreground">
              Terms
            </a>
            <a
              href="https://github.com/zainshah3464/relayon"
              target="_blank"
              rel="noopener noreferrer"
              class="flex items-center gap-1.5 text-muted transition-colors hover:text-foreground"
            >
              <svg class="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
              </svg>
              <span>GitHub</span>
            </a>
          </div>
        </div>

        <!-- Single consolidated credit line -->
        <div class="mt-4 border-t border-hairline pt-4 text-center">
          <p class="text-[11px] text-muted-2">
            © {{ year }} Zain Shah · Made with
            <span class="text-signal-rose">♥</span>
            in Pakistan
            <span class="mx-1 text-hairline">·</span>
            <a routerLink="/terms" fragment="license" class="text-muted transition-colors hover:text-foreground">
              Source-available
            </a>
            <span class="mx-1 text-hairline">·</span>
            <a routerLink="/about" class="text-muted transition-colors hover:text-foreground">
              Our story
            </a>
          </p>
        </div>
      </div>
    </footer>
  `,
})
export class FooterComponent {
  readonly year = new Date().getFullYear();
}