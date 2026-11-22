import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { AuthService } from '../../../core/auth/auth.service';
import { PasswordStrengthMeterComponent } from '../../../shared/password-strength/password-strength-meter.component';
import { SeoService } from '../../../core/seo/seo.service';
import { AuthLayoutComponent } from '../../../shared/layout/auth-layout/auth-layout.component';
import { IconComponent } from '../../../shared/ui/icon/icon.component';

@Component({
  selector: 'app-signup',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    TranslocoModule,
    PasswordStrengthMeterComponent,
    AuthLayoutComponent,
    IconComponent,
  ],
  template: `
    <app-auth-layout>
      @if (success()) {
        <!-- ═══ SUCCESS STATE ═══ -->
        <div class="text-center animate-scale-in">
          <div class="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-signal-green/30 bg-signal-green/10">
            <app-icon name="mail" [size]="28" [strokeWidth]="1.75" class="text-signal-green" />
          </div>

          <h1 class="mt-6 text-2xl font-bold tracking-tight text-foreground">
            {{ 'auth.signup.successTitle' | transloco }}
          </h1>
          <p class="mt-2 text-sm text-muted">
            {{ 'auth.signup.successBody' | transloco: { email: form.controls.email.value } }}
          </p>
          <p class="mt-1.5 text-xs text-muted-2">
            {{ 'auth.signup.successHint' | transloco }}
          </p>

          @if (resendSuccess()) {
            <div class="mt-4 flex items-start gap-2.5 rounded-lg border border-signal-green/30 bg-signal-green/10 px-3 py-2.5 text-xs text-signal-green">
              <app-icon name="check-circle" [size]="14" [strokeWidth]="2" class="mt-0.5 shrink-0" />
              <span>{{ 'auth.signup.resendSent' | transloco }}</span>
            </div>
          }

          <div class="mt-6 space-y-2">
            <button
              type="button"
              (click)="resend()"
              [disabled]="resending()"
              class="btn-secondary w-full"
            >
              @if (resending()) {
                <app-icon name="loader" [size]="14" [strokeWidth]="2.5" class="animate-spin" />
              }
              <span>{{ (resending() ? 'auth.signup.resending' : 'auth.signup.resend') | transloco }}</span>
            </button>
            <a routerLink="/login" class="btn-primary w-full">
              {{ 'auth.login.submit' | transloco }}
            </a>
          </div>
        </div>
      } @else {
        <!-- ═══ SIGNUP FORM ═══ -->
        <div class="animate-slide-up">
          <h1 class="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {{ 'auth.signup.title' | transloco }}
          </h1>
          <p class="mt-2 text-sm text-muted">
            {{ 'auth.signup.subtitle' | transloco }}
          </p>
        </div>

        <!-- OAuth -->
        <div class="mt-7 space-y-2 stagger-1 animate-slide-up">
          <button
            type="button"
            (click)="googleLogin()"
            class="btn-secondary w-full justify-start gap-3"
          >
            <svg class="h-4 w-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            <span class="flex-1 text-start">{{ 'auth.signup.continueWithGoogle' | transloco }}</span>
          </button>
          <button
            type="button"
            (click)="githubLogin()"
            class="btn-secondary w-full justify-start gap-3"
          >
            <svg class="h-4 w-4 shrink-0 text-foreground" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
            </svg>
            <span class="flex-1 text-start">{{ 'auth.signup.continueWithGitHub' | transloco }}</span>
          </button>
        </div>

        <!-- Divider -->
        <div class="relative my-6">
          <div class="absolute inset-0 flex items-center">
            <div class="w-full border-t border-hairline"></div>
          </div>
          <div class="relative flex justify-center text-[10px] font-medium uppercase tracking-wider">
            <span class="bg-midnight px-3 text-muted-2">{{ 'common.or' | transloco }}</span>
          </div>
        </div>

        <!-- Form -->
        <form [formGroup]="form" (ngSubmit)="submit()" class="space-y-4 stagger-2 animate-slide-up">
          @if (error()) {
            <div class="flex items-start gap-2.5 rounded-lg border border-signal-rose/30 bg-signal-rose/10 px-3 py-2.5 text-sm text-signal-rose">
              <app-icon name="alert-circle" [size]="16" [strokeWidth]="2" class="mt-0.5 shrink-0" />
              <span>{{ error() }}</span>
            </div>
          }

          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                <p class="mt-1.5 text-xs text-signal-rose">{{ 'auth.validation.nameMin2' | transloco }}</p>
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
                <p class="mt-1.5 text-xs text-signal-rose">{{ 'auth.validation.teamMin2' | transloco }}</p>
              }
            </div>
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
              <p class="mt-1.5 text-xs text-signal-rose">{{ 'auth.validation.emailRequired' | transloco }}</p>
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

            @if (form.controls.password.value) {
              <app-password-strength-meter
                [password]="form.controls.password.value"
                [userInputs]="userInputs()"
                (strengthChange)="onPasswordStrengthChange($event)"
              />
            }

            @if (form.controls.password.touched && form.controls.password.invalid) {
              <p class="mt-1.5 text-xs text-signal-rose">
                {{ 'auth.validation.passwordMin12' | transloco }}
              </p>
            }
          </div>

          <button
            type="submit"
            [disabled]="loading() || form.invalid || !passwordStrong()"
            class="btn-primary w-full"
          >
            @if (loading()) {
              <app-icon name="loader" [size]="14" [strokeWidth]="2.5" class="animate-spin" />
            }
            <span>{{ (loading() ? 'auth.signup.submitting' : 'auth.signup.submit') | transloco }}</span>
          </button>
        </form>

        <p class="mt-8 text-center text-sm text-muted">
          {{ 'auth.signup.hasAccount' | transloco }}
          <a routerLink="/login" class="font-medium text-relay-cyan transition-colors hover:text-foreground hover:underline">
            {{ 'auth.signup.signIn' | transloco }}
          </a>
        </p>
      }
    </app-auth-layout>
  `,
})
export class SignupComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly success = signal(false);
  readonly resending = signal(false);
  readonly resendSuccess = signal(false);
  readonly passwordStrong = signal(false);

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    tenantName: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(12)]],
  });

  readonly userInputs = (): string[] => {
    const email = this.form.controls.email.value;
    const name = this.form.controls.name.value;
    const tenant = this.form.controls.tenantName.value;
    return [email, name, tenant].filter((x): x is string => !!x);
  };

  constructor() {
    inject(SeoService).set({
      title: 'Create Free Account — Relayon',
      description:
        'Sign up for Relayon free. 10,000 events/month, 100,000 AI tokens, unlimited workflows. Google and GitHub sign-in supported.',
      path: '/signup',
      keywords: ['free webhook relay signup', 'webhook platform free trial'],
    });
  }

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