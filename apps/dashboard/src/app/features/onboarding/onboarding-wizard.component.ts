import {
  Component,
  inject,
  signal,
  output,
  HostListener,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { OnboardingService } from '../../core/onboarding/onboarding.service';
import { AuthService } from '../../core/auth/auth.service';
import { IconComponent, type IconName } from '../../shared/ui/icon/icon.component';
import { LogoComponent } from '../../shared/ui/logo/logo.component';

interface Feature {
  icon: IconName;
  title: string;
  desc: string;
}

interface Step {
  title: string;
  desc: string;
}

@Component({
  selector: 'app-onboarding-wizard',
  standalone: true,
  imports: [CommonModule, RouterLink, IconComponent, LogoComponent],
  template: `
    <div
      class="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-3 backdrop-blur-sm animate-fade-in sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
    >
      <div
        class="relative flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-hairline bg-surface shadow-2xl animate-scale-in"
      >
        <!-- ═══ HEADER ═══ -->
        <div class="flex shrink-0 items-center justify-between border-b border-hairline px-5 py-3">
          <app-logo size="sm" [link]="null" [showVersion]="false" />

          <!-- Progress dots -->
          <div
            class="flex items-center gap-1"
            role="progressbar"
            [attr.aria-valuenow]="step() + 1"
            aria-valuemin="1"
            [attr.aria-valuemax]="totalSteps"
            aria-label="Onboarding progress"
          >
            @for (i of stepIndexes(); track i) {
              <span
                class="rounded-full transition-all duration-300"
                [ngClass]="
                  step() === i
                    ? 'h-1.5 w-6 bg-relay-violet'
                    : 'h-1.5 w-1.5 bg-surface-3'
                "
              ></span>
            }
          </div>
        </div>

        <!-- ═══ BODY ═══ -->
        <div class="flex-1 overflow-y-auto px-5 py-6 sm:px-8 sm:py-8">
          @switch (step()) {
            @case (0) {
              <!-- Welcome -->
              <div class="text-center animate-slide-up">
                <div class="relative mx-auto inline-flex">
                  <div class="absolute inset-0 rounded-3xl bg-relay-violet/30 blur-2xl"></div>
                  <div class="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-relay-violet to-relay-cyan text-white shadow-lg sm:h-20 sm:w-20">
                    <app-icon name="rocket" [size]="32" [strokeWidth]="2" />
                  </div>
                </div>
                <h2 id="onboarding-title" class="mt-5 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                  Welcome to Relayon
                </h2>
                <p class="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-muted">
                  You're about to make webhooks a <strong class="text-foreground">solved problem</strong>.
                  In the next 30 seconds, we'll show you how to get your first webhook flowing.
                </p>
              </div>
            }

            @case (1) {
              <!-- What it does -->
              <div class="animate-slide-up">
                <h2 class="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                  What Relayon does
                </h2>
                <p class="mt-1.5 text-sm text-muted">
                  One pipeline. Five stages. Zero surprises.
                </p>

                <ul class="mt-5 space-y-2.5">
                  @for (f of features; track f.title) {
                    <li class="flex items-start gap-3 rounded-lg border border-hairline bg-surface-2/50 p-3">
                      <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-relay-violet/10 text-relay-violet">
                        <app-icon [name]="f.icon" [size]="15" [strokeWidth]="2" />
                      </span>
                      <div class="min-w-0 flex-1">
                        <p class="text-sm font-medium text-foreground">{{ f.title }}</p>
                        <p class="mt-0.5 text-xs text-muted">{{ f.desc }}</p>
                      </div>
                    </li>
                  }
                </ul>
              </div>
            }

            @case (2) {
              <!-- First workflow -->
              <div class="animate-slide-up">
                <h2 class="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                  Your first workflow in 3 steps
                </h2>
                <p class="mt-1.5 text-sm text-muted">
                  From zero to receiving webhooks — usually under a minute.
                </p>

                <ol class="mt-5 space-y-3">
                  @for (s of steps; track s.title; let i = $index) {
                    <li class="flex items-start gap-3">
                      <span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-relay-violet to-relay-cyan text-xs font-bold text-white">
                        {{ i + 1 }}
                      </span>
                      <div class="min-w-0 flex-1 pt-0.5">
                        <p class="text-sm font-semibold text-foreground">{{ s.title }}</p>
                        <p class="mt-0.5 text-xs text-muted">{{ s.desc }}</p>
                      </div>
                    </li>
                  }
                </ol>

                <div class="mt-5 flex items-start gap-2.5 rounded-lg border border-relay-cyan/30 bg-relay-cyan/[0.06] p-3">
                  <app-icon name="sparkles" [size]="14" [strokeWidth]="2" class="mt-0.5 shrink-0 text-relay-cyan" />
                  <p class="text-xs text-relay-cyan">
                    <strong>Pro tip:</strong> Try the webhook playground first — it gives you a real URL you can POST to, and shows everything instantly.
                  </p>
                </div>
              </div>
            }

            @case (3) {
              <!-- Ready -->
              <div class="text-center animate-slide-up">
                <div class="relative mx-auto inline-flex">
                  <div class="absolute inset-0 rounded-3xl bg-signal-green/25 blur-2xl"></div>
                  <div class="relative flex h-16 w-16 items-center justify-center rounded-2xl border border-signal-green/30 bg-signal-green/10 text-signal-green sm:h-20 sm:w-20">
                    <app-icon name="check-circle" [size]="36" [strokeWidth]="1.75" />
                  </div>
                </div>
                <h2 class="mt-5 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                  You're all set
                </h2>
                <p class="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-muted">
                  Everything is ready. Create your first workflow or try the playground — both take less than a minute.
                </p>

                <div class="mt-6 grid gap-2">
                  @if (auth.isAuthenticated()) {
                    <a
                      routerLink="/workflows"
                      [queryParams]="{ new: '1' }"
                      (click)="complete()"
                      class="btn-primary justify-center"
                    >
                      <app-icon name="plus" [size]="14" [strokeWidth]="2.5" />
                      <span>Create first workflow</span>
                    </a>
                    <a
                      routerLink="/playground"
                      (click)="complete()"
                      class="btn-secondary justify-center"
                    >
                      <app-icon name="flask" [size]="14" [strokeWidth]="2" />
                      <span>Try the playground</span>
                    </a>
                  } @else {
                    <button type="button" (click)="complete()" class="btn-primary justify-center">
                      Get started
                    </button>
                  }
                </div>
              </div>
            }
          }
        </div>

        <!-- ═══ FOOTER ═══ -->
        <div class="flex shrink-0 items-center justify-between gap-3 border-t border-hairline bg-surface-2/40 px-5 py-3 pb-safe">
          <button
            type="button"
            (click)="skip()"
            class="btn-ghost text-xs"
          >
            Skip
          </button>

          <div class="flex items-center gap-2">
            @if (step() > 0) {
              <button type="button" (click)="prev()" class="btn-secondary text-xs">
                <app-icon name="arrow-left" [size]="12" [strokeWidth]="2.5" />
                <span>Back</span>
              </button>
            }

            @if (step() < totalSteps - 1) {
              <button type="button" (click)="next()" class="btn-primary text-xs">
                <span>Next</span>
                <app-icon name="arrow-right" [size]="12" [strokeWidth]="2.5" />
              </button>
            }
          </div>
        </div>
      </div>
    </div>
  `,
})
export class OnboardingWizardComponent {
  readonly closed = output<void>();

  private readonly onboarding = inject(OnboardingService);
  readonly auth = inject(AuthService);

  readonly totalSteps = 4;
  readonly step = signal(0);
  readonly stepIndexes = computed(() =>
    Array.from({ length: this.totalSteps }, (_, i) => i),
  );

  readonly features: Feature[] = [
    { icon: 'inbox', title: 'Receives', desc: 'Webhooks from Stripe, GitHub, Shopify, or anything else' },
    { icon: 'sparkles', title: 'Enriches with AI', desc: 'Optional — summarize, classify, or extract fields' },
    { icon: 'edit', title: 'Transforms', desc: 'Reshape payloads so each destination gets exactly what it needs' },
    { icon: 'send', title: 'Delivers', desc: 'Route to Slack, email, or your API — with retries' },
    { icon: 'activity', title: 'Shows everything', desc: 'Every event, every retry, every response — full observability' },
  ];

  readonly steps: Step[] = [
    { title: 'Create a workflow', desc: 'Pick a name and select your source platform.' },
    { title: 'Copy the webhook URL', desc: 'Paste it into Stripe, GitHub, Shopify, or any service.' },
    { title: 'Add a destination', desc: 'Route events to Slack, email, or your own API.' },
  ];

  next(): void {
    if (this.step() < this.totalSteps - 1) this.step.update((v) => v + 1);
  }

  prev(): void {
    if (this.step() > 0) this.step.update((v) => v - 1);
  }

  skip(): void {
    this.complete();
  }

  complete(): void {
    this.onboarding.dismiss();
    this.closed.emit();
  }

  @HostListener('document:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      this.next();
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      this.prev();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      this.complete();
    }
  }
}