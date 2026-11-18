import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { TranslocoModule } from '@jsverse/transloco';
import { AuthService } from '../../../core/auth/auth.service';
import { SeoService } from '../../../core/seo/seo.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, TranslocoModule],
  template: `
    <div class="flex min-h-screen items-center justify-center bg-midnight p-4">
      <div class="w-full max-w-md">
        <!-- Logo -->
        <div class="mb-8 text-center">
          <div class="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-relay-violet to-relay-cyan text-xl font-bold text-white">
            R
          </div>
          <h1 class="text-2xl font-bold tracking-tightest text-white">{{ 'auth.login.title' | transloco }}</h1>
          <p class="mt-1 text-sm text-muted">{{ 'auth.login.subtitle' | transloco }}</p>
        </div>

        <!-- Card -->
        <div class="card">
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
              {{ 'auth.login.continueWithGoogle' | transloco }}
            </button>
            <button
              type="button"
              (click)="githubLogin()"
              class="btn-secondary w-full flex items-center justify-center gap-2"
            >
              <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
              </svg>
              {{ 'auth.login.continueWithGitHub' | transloco }}
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
                {{ error()! | transloco }}
              </div>
            }

            @if (unverifiedEmail()) {
              <div class="rounded-lg border border-signal-amber/30 bg-signal-amber/10 px-3 py-2 text-xs text-signal-amber flex items-center justify-between gap-2">
                <span>{{ 'auth.login.errors.resendVerification' | transloco }}</span>
                <button
                  type="button"
                  (click)="resendVerification()"
                  [disabled]="resending()"
                  class="font-medium underline hover:no-underline disabled:opacity-50"
                >
                  {{ resending() ? '...' : '↻' }}
                </button>
              </div>
            }

            @if (resendSuccess()) {
              <div class="rounded-lg border border-signal-emerald/30 bg-signal-emerald/10 px-3 py-2 text-xs text-signal-emerald">
                {{ 'auth.login.errors.resendSent' | transloco }}
              </div>
            }

            <div>
              <label for="email" class="label">{{ 'auth.login.email' | transloco }}</label>
              <input
                id="email"
                type="email"
                formControlName="email"
                autocomplete="email"
                class="input"
                [placeholder]="'auth.login.emailPlaceholder' | transloco"
              />
              @if (form.controls.email.touched && form.controls.email.invalid) {
                <p class="mt-1 text-xs text-signal-rose">{{ 'auth.validation.emailRequired' | transloco }}</p>
              }
            </div>

            <div>
              <div class="flex items-center justify-between">
                <label for="password" class="label">{{ 'auth.login.password' | transloco }}</label>
                <a
                  routerLink="/forgot-password"
                  class="text-xs text-muted hover:text-white"
                >
                  {{ 'auth.login.forgotPassword' | transloco }}
                </a>
              </div>
              <input
                id="password"
                type="password"
                formControlName="password"
                autocomplete="current-password"
                class="input"
                [placeholder]="'auth.login.passwordPlaceholder' | transloco"
              />
              @if (form.controls.password.touched && form.controls.password.invalid) {
                <p class="mt-1 text-xs text-signal-rose">{{ 'auth.validation.passwordMin8' | transloco }}</p>
              }
            </div>

            <button
              type="submit"
              [disabled]="loading() || form.invalid"
              class="btn-primary w-full"
            >
              {{ (loading() ? 'auth.login.submitting' : 'auth.login.submit') | transloco }}
            </button>
          </form>

          <p class="mt-6 text-center text-sm text-muted">
            {{ 'auth.login.noAccount' | transloco }}
            <a routerLink="/signup" class="font-medium text-relay-cyan hover:underline">
              {{ 'auth.login.createOne' | transloco }}
            </a>
          </p>
        </div>

        <p class="mt-6 text-center text-xs text-muted">
          {{ 'footer' | transloco }}
        </p>
      </div>
    </div>
  `,
})
export class LoginComponent {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  // ⚠️ v3.3 — SEO metadata
  constructor() {
    inject(SeoService).set({
      title: 'Sign In',
      description: 'Sign in to your Relayon account to manage webhooks, workflows, and deliveries.',
      path: '/login',
    });
  }

  loading = signal(false);
  error = signal<string | null>(null);
  unverifiedEmail = signal<string | null>(null);
  resending = signal(false);
  resendSuccess = signal(false);

  form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

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
    this.unverifiedEmail.set(null);
    this.resendSuccess.set(false);

    const { email, password } = this.form.getRawValue();

    this.auth.login({ email, password }).subscribe({
      next: () => {
        const returnUrl =
          this.route.snapshot.queryParamMap.get('returnUrl') || '/dashboard';
        this.router.navigateByUrl(returnUrl);
      },
      error: (err) => {
        this.loading.set(false);
        const body = err?.error;

        if (body?.code === 'EMAIL_NOT_VERIFIED') {
          this.error.set('auth.login.errors.emailNotVerified');
          this.unverifiedEmail.set(this.form.controls.email.value);
        } else {
          this.error.set('auth.login.errors.invalidCredentials');
        }
      },
    });
  }

  resendVerification(): void {
    const email = this.unverifiedEmail();
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