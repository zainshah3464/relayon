import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../core/auth/auth.service';

@Component({
  selector: 'app-signup',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  template: `
    <div class="flex min-h-screen items-center justify-center bg-midnight p-4">
      <div class="w-full max-w-md">
        <div class="mb-8 text-center">
          <div class="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-relay-violet to-relay-cyan text-xl font-bold text-white">
            R
          </div>
          <h1 class="text-2xl font-bold tracking-tightest text-white">Create your account</h1>
          <p class="mt-1 text-sm text-muted">Start relaying webhooks in minutes</p>
        </div>

        <div class="card">
          <form [formGroup]="form" (ngSubmit)="submit()" class="space-y-4">
            @if (error()) {
              <div class="rounded-lg border border-signal-rose/30 bg-signal-rose/10 px-3 py-2 text-sm text-signal-rose">
                {{ error() }}
              </div>
            }

            <div>
              <label for="name" class="label">Your name</label>
              <input id="name" type="text" formControlName="name" class="input" placeholder="Zain Shah" />
              @if (form.controls.name.touched && form.controls.name.invalid) {
                <p class="mt-1 text-xs text-signal-rose">Name is required</p>
              }
            </div>

            <div>
              <label for="tenantName" class="label">Workspace name</label>
              <input id="tenantName" type="text" formControlName="tenantName" class="input" placeholder="Acme Corp" />
              @if (form.controls.tenantName.touched && form.controls.tenantName.invalid) {
                <p class="mt-1 text-xs text-signal-rose">Workspace name is required</p>
              }
            </div>

            <div>
              <label for="email" class="label">Email</label>
              <input id="email" type="email" formControlName="email" autocomplete="email" class="input" placeholder="you@company.com" />
              @if (form.controls.email.touched && form.controls.email.invalid) {
                <p class="mt-1 text-xs text-signal-rose">Valid email is required</p>
              }
            </div>

            <div>
              <label for="password" class="label">Password</label>
              <input id="password" type="password" formControlName="password" autocomplete="new-password" class="input" placeholder="At least 8 characters" />
              @if (form.controls.password.touched && form.controls.password.invalid) {
                <p class="mt-1 text-xs text-signal-rose">Password must be at least 8 characters</p>
              }
            </div>

            <button type="submit" [disabled]="loading() || form.invalid" class="btn-primary w-full">
              @if (loading()) {
                <span>Creating account...</span>
              } @else {
                <span>Create account</span>
              }
            </button>
          </form>

          <p class="mt-6 text-center text-sm text-muted">
            Already have an account?
            <a routerLink="/login" class="font-medium text-relay-cyan hover:underline">Sign in</a>
          </p>
        </div>

        <p class="mt-6 text-center text-xs text-muted">
          By signing up, you agree to the MIT license terms.
        </p>
      </div>
    </div>
  `,
})
export class SignupComponent {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private router = inject(Router);

  loading = signal(false);
  error = signal<string | null>(null);

  form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    tenantName: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  submit(): void {
    if (this.form.invalid || this.loading()) return;

    this.loading.set(true);
    this.error.set(null);

    const payload = this.form.getRawValue();

    this.auth.signup(payload).subscribe({
      next: () => this.router.navigate(['/dashboard']),
      error: (err) => {
        this.loading.set(false);
        this.error.set(
          err?.error?.message || 'Signup failed. Please try again.'
        );
      },
    });
  }
}