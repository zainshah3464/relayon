import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../core/auth/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  template: `
    <div class="flex min-h-screen items-center justify-center bg-midnight p-4">
      <div class="w-full max-w-md">
        <!-- Logo -->
        <div class="mb-8 text-center">
          <div class="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-relay-violet to-relay-cyan text-xl font-bold text-white">
            R
          </div>
          <h1 class="text-2xl font-bold tracking-tightest text-white">Welcome back</h1>
          <p class="mt-1 text-sm text-muted">Sign in to your Relayon dashboard</p>
        </div>

        <!-- Card -->
        <div class="card">
          <form [formGroup]="form" (ngSubmit)="submit()" class="space-y-4">
            <!-- Error banner -->
            @if (error()) {
              <div class="rounded-lg border border-signal-rose/30 bg-signal-rose/10 px-3 py-2 text-sm text-signal-rose">
                {{ error() }}
              </div>
            }

            <!-- Email -->
            <div>
              <label for="email" class="label">Email</label>
              <input
                id="email"
                type="email"
                formControlName="email"
                autocomplete="email"
                class="input"
                placeholder="you@company.com"
              />
              @if (form.controls.email.touched && form.controls.email.invalid) {
                <p class="mt-1 text-xs text-signal-rose">Valid email is required</p>
              }
            </div>

            <!-- Password -->
            <div>
              <label for="password" class="label">Password</label>
              <input
                id="password"
                type="password"
                formControlName="password"
                autocomplete="current-password"
                class="input"
                placeholder="••••••••"
              />
              @if (form.controls.password.touched && form.controls.password.invalid) {
                <p class="mt-1 text-xs text-signal-rose">Password must be at least 8 characters</p>
              }
            </div>

            <!-- Submit -->
            <button type="submit" [disabled]="loading() || form.invalid" class="btn-primary w-full">
              @if (loading()) {
                <span>Signing in...</span>
              } @else {
                <span>Sign in</span>
              }
            </button>
          </form>

          <p class="mt-6 text-center text-sm text-muted">
            Don't have an account?
            <a routerLink="/signup" class="font-medium text-relay-cyan hover:underline">Create one</a>
          </p>
        </div>

        <p class="mt-6 text-center text-xs text-muted">
          Relayon · Your webhooks, relayed right.
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

  loading = signal(false);
  error = signal<string | null>(null);

  form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  submit(): void {
    if (this.form.invalid || this.loading()) return;

    this.loading.set(true);
    this.error.set(null);

    const { email, password } = this.form.getRawValue();

    this.auth.login({ email, password }).subscribe({
      next: () => {
        const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') || '/dashboard';
        this.router.navigateByUrl(returnUrl);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(
          err?.error?.message || 'Login failed. Please check your credentials.'
        );
      },
    });
  }
}