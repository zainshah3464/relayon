import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { AuthService } from '../../../core/auth/auth.service';
import { PasswordStrengthMeterComponent } from '../../../shared/password-strength/password-strength-meter.component';
import { AuthLayoutComponent } from '../../../shared/layout/auth-layout/auth-layout.component';
import { IconComponent } from '../../../shared/ui/icon/icon.component';

@Component({
  selector: 'app-reset-password',
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
        <div class="text-center animate-scale-in">
          <div class="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-signal-green/30 bg-signal-green/10">
            <app-icon name="check-circle" [size]="28" [strokeWidth]="1.75" class="text-signal-green" />
          </div>

          <h1 class="mt-6 text-2xl font-bold tracking-tight text-foreground">
            {{ 'auth.resetPassword.successTitle' | transloco }}
          </h1>
          <p class="mt-2 text-sm text-muted">
            {{ 'auth.resetPassword.successBody' | transloco }}
          </p>

          <a routerLink="/login" class="btn-primary mt-6 inline-flex w-full justify-center">
            {{ 'auth.resetPassword.signIn' | transloco }}
          </a>
        </div>
      } @else {
        <div class="animate-slide-up">
          <h1 class="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {{ 'auth.resetPassword.title' | transloco }}
          </h1>
          <p class="mt-2 text-sm text-muted">
            Choose a strong password — at least 12 characters.
          </p>
        </div>

        <form [formGroup]="form" (ngSubmit)="submit()" class="mt-8 space-y-4 stagger-1 animate-slide-up">
          @if (error()) {
            <div class="flex items-start gap-2.5 rounded-lg border border-signal-rose/30 bg-signal-rose/10 px-3 py-2.5 text-sm text-signal-rose">
              <app-icon name="alert-circle" [size]="16" [strokeWidth]="2" class="mt-0.5 shrink-0" />
              <span>{{ error()! | transloco }}</span>
            </div>
          }

          <div>
            <label for="password" class="label">{{ 'auth.resetPassword.newPassword' | transloco }}</label>
            <input
              id="password"
              type="password"
              formControlName="password"
              autocomplete="new-password"
              class="input"
              placeholder="At least 12 characters"
            />
            @if (form.controls.password.value) {
              <app-password-strength-meter [password]="form.controls.password.value" />
            }
          </div>

          <div>
            <label for="confirm" class="label">{{ 'auth.resetPassword.confirmPassword' | transloco }}</label>
            <input
              id="confirm"
              type="password"
              formControlName="confirm"
              autocomplete="new-password"
              class="input"
              placeholder="Repeat password"
            />
            @if (form.controls.confirm.touched && form.hasError('mismatch')) {
              <p class="mt-1.5 text-xs text-signal-rose">{{ 'auth.resetPassword.errors.mismatch' | transloco }}</p>
            }
          </div>

          <button
            type="submit"
            [disabled]="loading() || form.invalid || !token"
            class="btn-primary w-full"
          >
            @if (loading()) {
              <app-icon name="loader" [size]="14" [strokeWidth]="2.5" class="animate-spin" />
            }
            <span>{{ (loading() ? 'auth.resetPassword.submitting' : 'auth.resetPassword.submit') | transloco }}</span>
          </button>
        </form>

        <p class="mt-8 text-center text-sm text-muted">
          <a routerLink="/login" class="font-medium text-relay-cyan transition-colors hover:text-foreground hover:underline">
            {{ 'auth.forgotPassword.backToLogin' | transloco }}
          </a>
        </p>
      }
    </app-auth-layout>
  `,
})
export class ResetPasswordComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);

  readonly loading = signal(false);
  readonly success = signal(false);
  readonly error = signal<string | null>(null);
  token = '';

  readonly form = this.fb.nonNullable.group(
    {
      password: ['', [Validators.required, Validators.minLength(12)]],
      confirm: ['', [Validators.required]],
    },
    {
      validators: (g) =>
        g.value.password === g.value.confirm ? null : { mismatch: true },
    },
  );

  ngOnInit(): void {
    this.token = this.route.snapshot.queryParamMap.get('token') ?? '';
    if (!this.token) {
      this.error.set('auth.resetPassword.errors.missingToken');
    }
  }

  submit(): void {
    if (this.form.invalid || this.loading() || !this.token) return;
    this.loading.set(true);
    this.error.set(null);

    this.auth.resetPassword(this.token, this.form.controls.password.value).subscribe({
      next: () => {
        this.loading.set(false);
        this.success.set(true);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err?.error?.message ?? 'auth.resetPassword.errors.failed');
      },
    });
  }
}