import { Component, input, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

type LogoSize = 'xs' | 'sm' | 'md' | 'lg';

/**
 * Relayon brand logo.
 *
 * - `mark`   — the R monogram (gradient, geometric)
 * - `wordmark` — "Relayon" text
 * - `version` — optional version badge
 *
 * Usage:
 *   <app-logo />
 *   <app-logo [showVersion]="false" size="sm" />
 *   <app-logo [showWordmark]="false" size="lg" />
 */
@Component({
  selector: 'app-logo',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <a
      [routerLink]="link()"
      class="inline-flex items-center gap-2.5 select-none"
      [class.pointer-events-none]="!link()"
      aria-label="Relayon home"
    >
      <!-- Mark -->
      <span
        class="relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-lg shadow-sm"
        [ngClass]="markSizeClass()"
      >
        <svg
          [attr.width]="markPx()"
          [attr.height]="markPx()"
          viewBox="0 0 32 32"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="relayon-logo-bg" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stop-color="#8B5CF6" />
              <stop offset="100%" stop-color="#06B6D4" />
            </linearGradient>
            <linearGradient id="relayon-logo-hl" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="rgba(255,255,255,0.18)" />
              <stop offset="100%" stop-color="rgba(255,255,255,0)" />
            </linearGradient>
          </defs>
          <!-- Background -->
          <rect width="32" height="32" rx="8" fill="url(#relayon-logo-bg)" />
          <rect width="32" height="32" rx="8" fill="url(#relayon-logo-hl)" />
          <!-- R letterform -->
          <path
            d="M9.5 23 V9 H15.5 C18 9 19.8 10.5 19.8 13 C19.8 15 18.5 16.5 16.5 17 L20 23 H17 L14 17.5 H11.8 V23 H9.5 Z M11.8 11.2 V15.3 H15.2 C16.4 15.3 17.5 14.8 17.5 13.2 C17.5 11.6 16.4 11.2 15.2 11.2 H11.8 Z"
            fill="white"
          />
        </svg>
      </span>

      <!-- Wordmark -->
      @if (showWordmark()) {
        <span
          class="font-semibold tracking-tight text-foreground"
          [ngClass]="wordmarkSizeClass()"
        >
          Relayon
        </span>
      }

      <!-- Version badge -->
      @if (showVersion()) {
        <span
          class="rounded bg-surface-2 px-1.5 py-0.5 font-mono font-medium text-muted"
          [ngClass]="versionSizeClass()"
        >
          v{{ version() }}
        </span>
      }
    </a>
  `,
})
export class LogoComponent {
  /** Where clicking the logo navigates. Pass `null` to disable navigation. */
  readonly link = input<string | null>('/dashboard');

  readonly size = input<LogoSize>('md');
  readonly showWordmark = input(true);
  readonly showVersion = input(false);
  readonly version = input('3.7');

  readonly markPx = computed(() => {
    switch (this.size()) {
      case 'xs':
        return 20;
      case 'sm':
        return 24;
      case 'lg':
        return 36;
      default:
        return 28;
    }
  });

  readonly markSizeClass = computed(() => {
    switch (this.size()) {
      case 'xs':
        return 'h-5 w-5 rounded-md';
      case 'sm':
        return 'h-6 w-6 rounded-md';
      case 'lg':
        return 'h-9 w-9 rounded-lg';
      default:
        return 'h-7 w-7 rounded-md';
    }
  });

  readonly wordmarkSizeClass = computed(() => {
    switch (this.size()) {
      case 'xs':
        return 'text-sm';
      case 'sm':
        return 'text-base';
      case 'lg':
        return 'text-xl';
      default:
        return 'text-lg';
    }
  });

  readonly versionSizeClass = computed(() => {
    switch (this.size()) {
      case 'xs':
        return 'text-[9px]';
      case 'sm':
        return 'text-[10px]';
      case 'lg':
        return 'text-[11px]';
      default:
        return 'text-[10px]';
    }
  });
}