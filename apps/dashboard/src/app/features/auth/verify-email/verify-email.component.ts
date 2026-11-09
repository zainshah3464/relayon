import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';

@Component({
  selector: 'app-verify-email',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="flex min-h-screen items-center justify-center bg-midnight p-4">
      <div class="w-full max-w-md">
        <div class="card text-center py-10">
          @if (loading()) {
            <div class="text-sm text-muted">Verifying your email...</div>
          } @else if (success()) {
            <div class="text-4xl mb-3">🎉</div>
            <h1 class="text-xl font-bold text-white mb-2">Email verified</h1>
            <p class="text-sm text-muted mb-6">Your account is active. You can now sign in.</p>
            <a routerLink="/login" class="btn-primary text-sm">Sign in</a>
          } @else {
            <div class="text-4xl mb-3">⚠️</div>
            <h1 class="text-xl font-bold text-white mb-2">Verification failed</h1>
            <p class="text-sm text-signal-rose mb-6">{{ error() }}</p>
            <a routerLink="/login" class="btn-secondary text-sm">Back to sign in</a>
          }
        </div>
      </div>
    </div>
  `,
})
export class VerifyEmailComponent implements OnInit {
  private auth = inject(AuthService);
  private route = inject(ActivatedRoute);
  loading = signal(true);
  success = signal(false);
  error = signal('');

  ngOnInit(): void {
    const token = this.route.snapshot.queryParamMap.get('token');
    if (!token) {
      this.loading.set(false);
      this.error.set('Missing verification token');
      return;
    }
    this.auth.verifyEmail(token).subscribe({
      next: () => { this.loading.set(false); this.success.set(true); },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err?.error?.message ?? 'Invalid or expired verification link');
      },
    });
  }
}