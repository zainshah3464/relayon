import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { AuthService } from '../../../core/auth/auth.service';
import { AuthLayoutComponent } from '../../../shared/layout/auth-layout/auth-layout.component';
import { IconComponent } from '../../../shared/ui/icon/icon.component';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    TranslocoModule,
    AuthLayoutComponent,
    IconComponent,
  ],
  template: `
    <app-auth-layout>
      @if (sent()) {
        <!-- Success state -->
        <div class="text-center animate-scale-in">
          <div class="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-signal-green/30 bg-signal-green/10">
            <app-icon name="mail" [size]="28" [strokeWidth]="1.75" class="text-signal-green" />
          </div>

          <h1 class="mt-6 text-2xl font-bold tracking-tight text-foreground">
            {{ 'auth.forgotPassword.sentTitle' | transloco }}
          </h1>
          <p class="mt-2 text-sm text-muted leading-relaxed">
            {{ 'auth.forgotPassword.sentBody' | transloco: { email: form.controls.email.value } }}
          </p>

          <a routerLink="/login" class="btn-secondary mt-6 inline-flex w-full justify-center">
            <app-icon name="arrow-left" [size]="14" [strokeWidth]="2" />
            <span>{{ 'auth.forgotPassword.backToLogin' | transloco }}</span>
          </a>
        </div>
      } @else {
        <!-- Form state -->
        <div class="animate-slide-up">
          <h1 class="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {{ 'auth.forgotPassword.title' | transloco }}
          </h1>
          <p class="mt-2 text-sm text-muted">
            {{ 'auth.forgotPassword.subtitle' | transloco }}
          </p>
        </div>

        <form [formGroup]="form" (ngSubmit)="submit()" class="mt-8 space-y-4 stagger-1 animate-slide-up">
          @if (error()) {
            <div class="flex items-start gap-2.5 rounded-lg border border-signal-rose/30 bg-signal-rose/10 px-3 py-2.5 text-sm text-signal-rose">
              <app-icon name="alert-circle" [size]="16" [strokeWidth]="2" class="mt-0.5 shrink-0" />
              <span>{{ error() }}</span>
            </div>
          }

          <div>
            <label for="email" class="label">{{ 'auth.forgotPassword.email' | transloco }}</label>
            <input
              id="email"
              type="email"
              formControlName="email"
              autocomplete="email"
              class="input"
              [placeholder]="'auth.login.emailPlaceholder' | transloco"
            />
            @if (form.controls.email.touched && form.controls.email.invalid) {
              <p class="mt-1.5 text-xs text-signal-rose">{{ 'auth.validation.emailRequired' | transloco }}</p>
            }
          </div>

          <button
            type="submit"
            [disabled]="loading() || form.invalid"
            class="btn-primary w-full"
          >
            @if (loading()) {
              <app-icon name="loader" [size]="14" [strokeWidth]="2.5" class="animate-spin" />
            }
            <span>{{ (loading() ? 'auth.forgotPassword.submitting' : 'auth.forgotPassword.submit') | transloco }}</span>
          </button>
        </form>

        <p class="mt-8 text-center text-sm text-muted">
          {{ 'auth.forgotPassword.remembered' | transloco }}
          <a routerLink="/login" class="font-medium text-relay-cyan transition-colors hover:text-foreground hover:underline">
            {{ 'auth.forgotPassword.signIn' | transloco }}
          </a>
        </p>
      }
    </app-auth-layout>
  `,
})
export class ForgotPasswordComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);

  readonly loading = signal(false);
  readonly sent = signal(false);
  readonly error = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
  });

  submit(): void {
    if (this.form.invalid || this.loading()) return;
    this.loading.set(true);
    this.error.set(null);

    this.auth.requestPasswordReset(this.form.controls.email.value).subscribe({
      next: () => {
        this.loading.set(false);
        this.sent.set(true);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err?.error?.message ?? 'Failed to send reset link');
      },
    });
  }
}