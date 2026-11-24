import { Component, input, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

type LogoSize = 'xs' | 'sm' | 'md' | 'lg';

/**
 * Relayon brand logo — v2.0 (hollow bowl R, 3-stop gradient, depth + rim).
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
        class="relative inline-flex shrink-0 items-center justify-center overflow-hidden shadow-sm"
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
            <!-- 3-stop gradient: deep violet → brand violet → brand cyan -->
            <linearGradient id="relayon-logo-bg" x1="2" y1="2" x2="30" y2="30" gradientUnits="userSpaceOnUse">
              <stop offset="0" stop-color="#6D28D9" />
              <stop offset="0.35" stop-color="#8B5CF6" />
              <stop offset="1" stop-color="#06B6D4" />
            </linearGradient>
            <!-- Inner depth shadow -->
            <linearGradient id="relayon-logo-depth" x1="16" y1="0" x2="16" y2="32" gradientUnits="userSpaceOnUse">
              <stop offset="0" stop-color="#000000" stop-opacity="0.22" />
              <stop offset="0.4" stop-color="#000000" stop-opacity="0.05" />
              <stop offset="0.6" stop-color="#000000" stop-opacity="0" />
              <stop offset="1" stop-color="#000000" stop-opacity="0.12" />
            </linearGradient>
            <!-- Rim highlight -->
            <linearGradient id="relayon-logo-rim" x1="16" y1="0" x2="16" y2="6" gradientUnits="userSpaceOnUse">
              <stop offset="0" stop-color="#FFFFFF" stop-opacity="0.28" />
              <stop offset="1" stop-color="#FFFFFF" stop-opacity="0" />
            </linearGradient>
          </defs>

          <!-- Base + depth -->
          <rect width="32" height="32" rx="6.4" fill="url(#relayon-logo-bg)" />
          <rect width="32" height="32" rx="6.4" fill="url(#relayon-logo-depth)" />

          <!-- Hollow-bowl R (v2.0) -->
          <path
            fill="#FFFFFF"
            fill-rule="evenodd"
            d="M 10 8 L 10 24 L 13 24 L 13 17 L 19 17 L 22.5 24 L 25.5 24 L 20 15.8
               C 21.5 15.5 23 14 23 12 C 23 9 20.5 8 18 8 L 13 8 Z
               M 13 11 L 18 11 C 19 11 20 11.5 20 12.5 C 20 13.5 19 14 18 14 L 13 14 Z"
          />

          <!-- Rim highlight -->
          <rect width="32" height="6" rx="6.4" fill="url(#relayon-logo-rim)" />
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
      case 'xs': return 20;
      case 'sm': return 24;
      case 'lg': return 36;
      default:   return 28;
    }
  });

  readonly markSizeClass = computed(() => {
    switch (this.size()) {
      case 'xs': return 'h-5 w-5 rounded-md';
      case 'sm': return 'h-6 w-6 rounded-md';
      case 'lg': return 'h-9 w-9 rounded-lg';
      default:   return 'h-7 w-7 rounded-md';
    }
  });

  readonly wordmarkSizeClass = computed(() => {
    switch (this.size()) {
      case 'xs': return 'text-sm';
      case 'sm': return 'text-base';
      case 'lg': return 'text-xl';
      default:   return 'text-lg';
    }
  });

  readonly versionSizeClass = computed(() => {
    switch (this.size()) {
      case 'xs': return 'text-[9px]';
      case 'sm': return 'text-[10px]';
      case 'lg': return 'text-[11px]';
      default:   return 'text-[10px]';
    }
  });
}