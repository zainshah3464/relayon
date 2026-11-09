import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  template: `
    <div class="flex min-h-screen items-center justify-center bg-midnight p-4">
      <div class="w-full max-w-md">
        <div class="mb-8 text-center">
          <div class="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-relay-violet to-relay-cyan text-xl font-bold text-white">R</div>
          <h1 class="text-2xl font-bold tracking-tightest text-white">Forgot password?</h1>
          <p class="mt-1 text-sm text-muted">We'll email you a reset link.</p>
        </div>
        <div class="card">
          @if (sent()) {
            <div class="text-center py-6">
              <div class="text-3xl mb-3">📬</div>
              <p class="text-sm text-white mb-2">Check your email</p>
              <p class="text-xs text-muted mb-4">If an account exists for <strong class="text-white">{{ form.controls.email.value }}</strong>, you'll receive a reset link within a minute.</p>
              <a routerLink="/login" class="btn-secondary text-xs">Back to sign in</a>
            </div>
          } @else {
            <form [formGroup]="form" (ngSubmit)="submit()" class="space-y-4">
              @if (error()) {
                <div class="rounded-lg border border-signal-rose/30 bg-signal-rose/10 px-3 py-2 text-sm text-signal-rose">{{ error() }}</div>
              }
              <div>
                <label for="email" class="label">Email</label>
                <input id="email" type="email" formControlName="email" autocomplete="email" class="input" placeholder="you@company.com" />
              </div>
              <button type="submit" [disabled]="loading() || form.invalid" class="btn-primary w-full">
                {{ loading() ? 'Sending...' : 'Send reset link' }}
              </button>
            </form>
            <p class="mt-6 text-center text-sm text-muted">
              Remember it? <a routerLink="/login" class="font-medium text-relay-cyan hover:underline">Sign in</a>
            </p>
          }
        </div>
      </div>
    </div>
  `,
})
export class ForgotPasswordComponent {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  loading = signal(false);
  sent = signal(false);
  error = signal<string | null>(null);
  form = this.fb.nonNullable.group({ email: ['', [Validators.required, Validators.email]] });

  submit(): void {
    if (this.form.invalid || this.loading()) return;
    this.loading.set(true);
    this.error.set(null);
    this.auth.requestPasswordReset(this.form.controls.email.value).subscribe({
      next: () => { this.loading.set(false); this.sent.set(true); },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err?.error?.message ?? 'Failed to send reset link');
      },
    });
  }
}