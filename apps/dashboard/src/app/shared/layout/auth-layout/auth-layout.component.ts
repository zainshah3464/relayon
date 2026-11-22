import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LogoComponent } from '../../ui/logo/logo.component';
import { IconComponent, type IconName } from '../../ui/icon/icon.component';

interface Stat {
  icon: IconName;
  title: string;
  label: string;
}

@Component({
  selector: 'app-auth-layout',
  standalone: true,
  imports: [CommonModule, LogoComponent, IconComponent],
  template: `
    <div class="flex min-h-screen bg-midnight">
      <!-- ═══════════════ LEFT: Marketing (desktop) ═══════════════ -->
      <aside
        class="relative hidden w-1/2 overflow-hidden border-e border-hairline bg-surface lg:flex"
        aria-hidden="true"
      >
        <!-- Gradient backdrop -->
        <div class="absolute inset-0 bg-gradient-to-br from-relay-violet/15 via-surface to-relay-cyan/10"></div>

        <!-- Grid pattern -->
        <div
          class="absolute inset-0 opacity-[0.06]"
          style="background-image: linear-gradient(rgba(255,255,255,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.4) 1px, transparent 1px); background-size: 32px 32px;"
        ></div>

        <!-- Glow orbs -->
        <div class="absolute -top-32 -left-32 h-96 w-96 rounded-full bg-relay-violet/25 blur-[120px]"></div>
        <div class="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-relay-cyan/20 blur-[120px]"></div>

        <!-- Content -->
        <div class="relative z-10 flex w-full flex-col justify-between p-10 xl:p-12">
          <app-logo size="lg" link="/" />

          <div class="max-w-md">
            <h2 class="text-3xl font-bold leading-[1.1] tracking-tighter text-foreground xl:text-4xl">
              Webhooks,
              <br />
              <span class="text-gradient-brand">relayed right</span>.
            </h2>
            <p class="mt-5 text-base leading-relaxed text-muted">
              Receive, enrich with AI, and route events reliably — to any destination, on any infrastructure.
            </p>

            <ul class="mt-8 space-y-3.5">
              @for (stat of stats; track stat.title) {
                <li class="flex items-start gap-3">
                  <span class="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-hairline bg-surface-2">
                    <app-icon
                      [name]="stat.icon"
                      [size]="13"
                      [strokeWidth]="2"
                      class="text-relay-cyan"
                    />
                  </span>
                  <div class="min-w-0">
                    <p class="text-sm font-medium text-foreground">{{ stat.title }}</p>
                    <p class="mt-0.5 text-xs text-muted">{{ stat.label }}</p>
                  </div>
                </li>
              }
            </ul>
          </div>

          <p class="text-[11px] text-muted-2">
            © {{ year }} Relayon · Made with ♥ in Pakistan
          </p>
        </div>
      </aside>

      <!-- ═══════════════ RIGHT: Form content ═══════════════ -->
      <main class="flex w-full flex-1 flex-col overflow-y-auto px-5 py-8 sm:px-8 lg:w-1/2 lg:py-12 pt-safe pb-safe">
        <div class="m-auto w-full max-w-sm">
          <!-- Mobile logo -->
          <div class="mb-10 lg:hidden">
            <app-logo size="md" link="/" />
          </div>

          <ng-content />

          <!-- Mobile footer -->
          <p class="mt-12 text-center text-[11px] text-muted-2 lg:hidden">
            © {{ year }} Relayon · Made with ♥ in Pakistan
          </p>
        </div>
      </main>
    </div>
  `,
})
export class AuthLayoutComponent {
  readonly year = new Date().getFullYear();

  readonly stats: Stat[] = [
    {
      icon: 'zap',
      title: 'At-least-once delivery',
      label: 'Guaranteed, with exponential backoff retries',
    },
    {
      icon: 'workflow',
      title: 'Multi-destination fan-out',
      label: 'Slack, email, your API — one event, many routes',
    },
    {
      icon: 'sparkles',
      title: 'Optional AI enrichment',
      label: 'Summarize, classify, extract — powered by Groq',
    },
  ];
}