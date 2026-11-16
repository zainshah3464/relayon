import { Component, inject, signal, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { OnboardingService } from '../../core/onboarding/onboarding.service';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-onboarding-wizard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="fixed inset-0 z-[100] bg-black/70 flex items-center justify-center p-4">
      <div class="bg-surface rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl border border-hairline">
        <!-- Progress bar -->
        <div class="h-1 bg-surface-2">
          <div
            class="h-full bg-gradient-to-r from-relay-violet to-relay-cyan transition-all duration-300"
            [style.width.%]="((step() + 1) / totalSteps) * 100"
          ></div>
        </div>

        <!-- Slide content -->
        <div class="p-8">
          @switch (step()) {
            @case (0) {
              <div class="text-center">
                <div class="text-5xl mb-4">👋</div>
                <h2 class="text-2xl font-bold text-white mb-3">Welcome to Relayon!</h2>
                <p class="text-sm text-muted leading-relaxed">
                  You're about to make webhooks a <strong class="text-white">solved problem</strong>.
                  In the next 30 seconds, we'll show you how to get your first
                  webhook flowing from any source to any destination.
                </p>
              </div>
            }

            @case (1) {
              <div>
                <div class="text-4xl mb-4">🎯</div>
                <h2 class="text-xl font-bold text-white mb-3">What Relayon does</h2>
                <div class="space-y-2">
                  <div class="flex items-start gap-2 text-sm">
                    <span class="text-signal-green">📥</span>
                    <span class="text-muted"><strong class="text-white">Receives</strong> webhooks from Stripe, GitHub, Shopify, etc.</span>
                  </div>
                  <div class="flex items-start gap-2 text-sm">
                    <span class="text-signal-green">🧠</span>
                    <span class="text-muted"><strong class="text-white">Enriches</strong> with AI (optional — summarize, classify, extract)</span>
                  </div>
                  <div class="flex items-start gap-2 text-sm">
                    <span class="text-signal-green">🔄</span>
                    <span class="text-muted"><strong class="text-white">Transforms</strong> the payload if your destination needs it</span>
                  </div>
                  <div class="flex items-start gap-2 text-sm">
                    <span class="text-signal-green">🎯</span>
                    <span class="text-muted"><strong class="text-white">Delivers</strong> to Slack, email, your API — reliably, with retries</span>
                  </div>
                  <div class="flex items-start gap-2 text-sm">
                    <span class="text-signal-green">📊</span>
                    <span class="text-muted"><strong class="text-white">Shows you</strong> everything — every event, every retry, every response</span>
                  </div>
                </div>
              </div>
            }

            @case (2) {
              <div>
                <div class="text-4xl mb-4">🚀</div>
                <h2 class="text-xl font-bold text-white mb-3">Your first workflow in 3 steps</h2>
                <div class="space-y-3">
                  <div class="flex items-start gap-3">
                    <div class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-relay-violet text-white text-xs font-bold">1</div>
                    <div class="text-sm text-muted">
                      <strong class="text-white">Create workflow</strong><br>
                      Go to Workflows → + New workflow
                    </div>
                  </div>
                  <div class="flex items-start gap-3">
                    <div class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-relay-violet text-white text-xs font-bold">2</div>
                    <div class="text-sm text-muted">
                      <strong class="text-white">Copy webhook URL</strong><br>
                      Paste into Stripe/GitHub/Shopify settings
                    </div>
                  </div>
                  <div class="flex items-start gap-3">
                    <div class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-relay-violet text-white text-xs font-bold">3</div>
                    <div class="text-sm text-muted">
                      <strong class="text-white">Add a destination</strong><br>
                      Slack, email, or your own API — one click
                    </div>
                  </div>
                </div>
                <div class="mt-4 p-3 rounded-lg bg-relay-cyan/10 border border-relay-cyan/30 text-xs text-relay-cyan">
                  💡 Stuck? The full guide is one click away in the sidebar.
                </div>
              </div>
            }

            @case (3) {
              <div class="text-center">
                <div class="text-5xl mb-4">✅</div>
                <h2 class="text-2xl font-bold text-white mb-3">You're ready!</h2>
                <p class="text-sm text-muted leading-relaxed mb-4">
                  Everything is set up. Your workspace is live.
                  Let's create your first workflow and watch webhooks flow.
                </p>
                <div class="text-xs text-muted">
                  Need help anytime? Click <strong class="text-white">Guide</strong> in the sidebar.
                </div>
              </div>
            }
          }
        </div>

        <!-- Footer -->
        <div class="border-t border-hairline p-4 flex justify-between items-center">
          <div class="text-xs text-muted">
            Step {{ step() + 1 }} of {{ totalSteps }}
          </div>
          <div class="flex gap-2">
            @if (step() > 0) {
              <button (click)="prev()" class="btn-secondary text-xs">Back</button>
            }
            @if (step() < totalSteps - 1) {
              <button (click)="next()" class="btn-primary text-xs">Next</button>
            } @else {
              @if (auth.isAuthenticated()) {
                <a routerLink="/workflows" (click)="complete()" class="btn-primary text-xs">Create first workflow →</a>
              } @else {
                <button (click)="complete()" class="btn-primary text-xs">Get started</button>
              }
            }
            @if (step() < totalSteps - 1) {
              <button (click)="skip()" class="text-xs text-muted hover:text-white">Skip</button>
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
  step = signal(0);

  next(): void {
    if (this.step() < this.totalSteps - 1) this.step.set(this.step() + 1);
  }

  prev(): void {
    if (this.step() > 0) this.step.set(this.step() - 1);
  }

  skip(): void {
    this.complete();
  }

  complete(): void {
    this.onboarding.dismiss();
    this.closed.emit();
  }
}