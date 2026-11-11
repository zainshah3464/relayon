import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { AuthService } from '../../../core/auth/auth.service';
import { PasswordStrengthMeterComponent } from '../../../shared/password-strength/password-strength-meter.component';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, TranslocoModule, PasswordStrengthMeterComponent],
  template: `
    <div class="flex min-h-screen items-center justify-center bg-midnight p-4">
      <div class="w-full max-w-md">
        <div class="mb-8 text-center">
          <div class="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-relay-violet to-relay-cyan text-xl font-bold text-white">R</div>
          <h1 class="text-2xl font-bold tracking-tightest text-white">{{ 'auth.resetPassword.title' | transloco }}</h1>
        </div>
        <div class="card">
          @if (success()) {
            <div class="text-center py-6">
              <div class="text-3xl mb-3">✅</div>
              <p class="text-sm text-white mb-4">{{ 'auth.resetPassword.successBody' | transloco }}</p>
              <a routerLink="/login" class="btn-primary text-xs">{{ 'auth.resetPassword.signIn' | transloco }}</a>
            </div>
          } @else {
            <form [formGroup]="form" (ngSubmit)="submit()" class="space-y-4">
              @if (error()) {
                <div class="rounded-lg border border-signal-rose/30 bg-signal-rose/10 px-3 py-2 text-sm text-signal-rose">{{ error()! | transloco }}</div>
              }
              <div>
                <label class="label">{{ 'auth.resetPassword.newPassword' | transloco }}</label>
                <input type="password" formControlName="password" autocomplete="new-password" class="input" placeholder="At least 12 characters" />
                <app-password-strength-meter [password]="form.controls.password.value" />
              </div>
              <div>
                <label class="label">{{ 'auth.resetPassword.confirmPassword' | transloco }}</label>
                <input type="password" formControlName="confirm" autocomplete="new-password" class="input" />
                @if (form.controls.confirm.touched && form.hasError('mismatch')) {
                  <p class="mt-1 text-xs text-signal-rose">{{ 'auth.resetPassword.errors.mismatch' | transloco }}</p>
                }
              </div>
              <button type="submit" [disabled]="loading() || form.invalid" class="btn-primary w-full">
                {{ (loading() ? 'auth.resetPassword.submitting' : 'auth.resetPassword.submit') | transloco }}
              </button>
            </form>
          }
        </div>
      </div>
    </div>
  `,
})
export class ResetPasswordComponent implements OnInit {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  loading = signal(false);
  success = signal(false);
  error = signal<string | null>(null);
  token = '';

  form = this.fb.nonNullable.group(
    {
      password: ['', [Validators.required, Validators.minLength(12)]],
      confirm: ['', [Validators.required]],
    },
    { validators: (g) => g.value.password === g.value.confirm ? null : { mismatch: true } },
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
      next: () => { this.loading.set(false); this.success.set(true); },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err?.error?.message ?? 'auth.resetPassword.errors.failed');
      },
    });
  }
}