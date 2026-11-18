import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { AuthService } from '../../../core/auth/auth.service';
import { PasswordStrengthMeterComponent } from '../../../shared/password-strength/password-strength-meter.component';
import { SeoService } from '../../../core/seo/seo.service';

@Component({
  selector: 'app-signup',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    TranslocoModule,
    PasswordStrengthMeterComponent,
  ],
  template: `
    <div class="flex min-h-screen items-center justify-center bg-midnight p-4">
      <div class="w-full max-w-md">
        <div class="mb-8 text-center">
          <div class="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-relay-violet to-relay-cyan text-xl font-bold text-white">
            R
          </div>
          <h1 class="text-2xl font-bold tracking-tightest text-white">{{ 'auth.signup.title' | transloco }}</h1>
          <p class="mt-1 text-sm text-muted">{{ 'auth.signup.subtitle' | transloco }}</p>
        </div>

        <div class="card">
          @if (success()) {
            <!-- Success state — check email -->
            <div class="text-center py-6">
              <div class="text-4xl mb-3">📬</div>
              <h2 class="text-lg font-semibold text-white mb-2">{{ 'auth.signup.successTitle' | transloco }}</h2>
              <p class="text-sm text-muted mb-4">
                {{ 'auth.signup.successBody' | transloco: { email: form.controls.email.value } }}
              </p>
              <p class="text-xs text-muted mb-6">
                {{ 'auth.signup.successHint' | transloco }}
              </p>

              @if (resendSuccess()) {
                <div class="rounded-lg border border-signal-emerald/30 bg-signal-emerald/10 px-3 py-2 text-xs text-signal-emerald mb-3">
                  {{ 'auth.signup.resendSent' | transloco }}
                </div>
              }

              <div class="space-y-2">
                <button
                  type="button"
                  (click)="resend()"
                  [disabled]="resending()"
                  class="btn-secondary w-full text-sm"
                >
                  {{ (resending() ? 'auth.signup.resending' : 'auth.signup.resend') | transloco }}
                </button>
                <a routerLink="/login" class="btn-primary w-full block text-sm text-center">
                  {{ 'auth.login.submit' | transloco }}
                </a>
              </div>
            </div>
          } @else {
            <!-- Social buttons -->
            <div class="space-y-2 mb-4">
              <button
                type="button"
                (click)="googleLogin()"
                class="btn-secondary w-full flex items-center justify-center gap-2"
              >
                <svg class="w-4 h-4" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                {{ 'auth.signup.continueWithGoogle' | transloco }}
              </button>
              <button
                type="button"
                (click)="githubLogin()"
                class="btn-secondary w-full flex items-center justify-center gap-2"
              >
                <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
                </svg>
                {{ 'auth.signup.continueWithGitHub' | transloco }}
              </button>
            </div>

            <!-- Divider -->
            <div class="relative my-4">
              <div class="absolute inset-0 flex items-center">
                <div class="w-full border-t border-hairline"></div>
              </div>
              <div class="relative flex justify-center text-xs">
                <span class="bg-surface px-2 text-muted">{{ 'common.or' | transloco }}</span>
              </div>
            </div>

            <!-- Form -->
            <form [formGroup]="form" (ngSubmit)="submit()" class="space-y-4">
              @if (error()) {
                <div class="rounded-lg border border-signal-rose/30 bg-signal-rose/10 px-3 py-2 text-sm text-signal-rose">
                  {{ error() }}
                </div>
              }

              <div>
                <label for="name" class="label">{{ 'auth.signup.name' | transloco }}</label>
                <input
                  id="name"
                  type="text"
                  formControlName="name"
                  autocomplete="name"
                  class="input"
                  placeholder="Jane Doe"
                />
                @if (form.controls.name.touched && form.controls.name.invalid) {
                  <p class="mt-1 text-xs text-signal-rose">{{ 'auth.validation.nameMin2' | transloco }}</p>
                }
              </div>

              <div>
                <label for="tenantName" class="label">{{ 'auth.signup.tenantName' | transloco }}</label>
                <input
                  id="tenantName"
                  type="text"
                  formControlName="tenantName"
                  autocomplete="organization"
                  class="input"
                  placeholder="Acme Inc."
                />
                @if (form.controls.tenantName.touched && form.controls.tenantName.invalid) {
                  <p class="mt-1 text-xs text-signal-rose">{{ 'auth.validation.teamMin2' | transloco }}</p>
                }
              </div>

              <div>
                <label for="email" class="label">{{ 'auth.signup.email' | transloco }}</label>
                <input
                  id="email"
                  type="email"
                  formControlName="email"
                  autocomplete="email"
                  class="input"
                  placeholder="you@company.com"
                />
                @if (form.controls.email.touched && form.controls.email.invalid) {
                  <p class="mt-1 text-xs text-signal-rose">{{ 'auth.validation.emailRequired' | transloco }}</p>
                }
              </div>

              <div>
                <label for="password" class="label">{{ 'auth.signup.password' | transloco }}</label>
                <input
                  id="password"
                  type="password"
                  formControlName="password"
                  autocomplete="new-password"
                  class="input"
                  placeholder="At least 12 characters"
                />

                <!-- Password strength meter -->
                @if (form.controls.password.value) {
                  <app-password-strength-meter
                    [password]="form.controls.password.value"
                    [userInputs]="userInputs()"
                    (strengthChange)="onPasswordStrengthChange($event)"
                  />
                }

                @if (form.controls.password.touched && form.controls.password.invalid) {
                  <p class="mt-1 text-xs text-signal-rose">
                    {{ 'auth.validation.passwordMin12' | transloco }}
                  </p>
                }
              </div>

              <button
                type="submit"
                [disabled]="loading() || form.invalid || !passwordStrong()"
                class="btn-primary w-full"
              >
                {{ (loading() ? 'auth.signup.submitting' : 'auth.signup.submit') | transloco }}
              </button>
            </form>

            <p class="mt-6 text-center text-sm text-muted">
              {{ 'auth.signup.hasAccount' | transloco }}
              <a routerLink="/login" class="font-medium text-relay-cyan hover:underline">
                {{ 'auth.signup.signIn' | transloco }}
              </a>
            </p>
          }
        </div>

        <p class="mt-6 text-center text-xs text-muted">
          {{ 'footer' | transloco }}
        </p>
      </div>
    </div>
  `,
})
export class SignupComponent {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);

  // ⚠️ v3.3 — SEO metadata
  constructor() {
    inject(SeoService).set({
      title: 'Create Free Account — No Credit Card Required',
      description: 'Sign up for Relayon free. 10,000 events/month, 100,000 AI tokens, unlimited workflows. Google and GitHub sign-in supported.',
      path: '/signup',
      keywords: ['free webhook relay signup', 'webhook platform free trial'],
    });
  }

  loading = signal(false);
  error = signal<string | null>(null);
  success = signal(false);
  resending = signal(false);
  resendSuccess = signal(false);

  // Track password strength for submit button state
  passwordStrong = signal(false);

  form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    tenantName: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(12)]],
  });

  // zxcvbn user inputs — prevents "john-doe-2024" style passwords
  userInputs = (): string[] => {
    const email = this.form.controls.email.value;
    const name = this.form.controls.name.value;
    const tenant = this.form.controls.tenantName.value;
    return [email, name, tenant].filter((x): x is string => !!x);
  };

  // ⚠️ v2.2 — FIXED: this method now receives events via (strengthChange)
  onPasswordStrengthChange(strong: boolean): void {
    this.passwordStrong.set(strong);
  }

  googleLogin(): void {
    this.auth.startGoogleOAuth('/dashboard');
  }

  githubLogin(): void {
    this.auth.startGitHubOAuth('/dashboard');
  }

  submit(): void {
    if (this.form.invalid || this.loading()) return;

    this.loading.set(true);
    this.error.set(null);

    const { name, tenantName, email, password } = this.form.getRawValue();

    this.auth.signup({ name, tenantName, email, password }).subscribe({
      next: () => {
        this.loading.set(false);
        this.success.set(true);
        // ⚠️ Do NOT navigate — user must verify email first.
        // Login will be blocked until verification.
      },
      error: (err) => {
        this.loading.set(false);
        const body = err?.error;
        if (Array.isArray(body?.message)) {
          this.error.set(body.message.join('. '));
        } else {
          this.error.set(body?.message ?? 'Signup failed. Please try again.');
        }
      },
    });
  }

  resend(): void {
    const email = this.form.controls.email.value;
    if (!email || this.resending()) return;

    this.resending.set(true);
    this.resendSuccess.set(false);

    this.auth.resendVerification(email).subscribe({
      next: () => {
        this.resending.set(false);
        this.resendSuccess.set(true);
      },
      error: () => {
        this.resending.set(false);
      },
    });
  }
}