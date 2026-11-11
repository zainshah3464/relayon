import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { AuthService } from '../../../core/auth/auth.service';

@Component({
  selector: 'app-oauth-callback',
  standalone: true,
  imports: [CommonModule, RouterLink, TranslocoModule],
  template: `
    <div class="flex min-h-screen items-center justify-center bg-midnight p-4">
      <div class="w-full max-w-md">
        <div class="card text-center py-10">
          @if (loading()) {
            <div class="text-sm text-muted">{{ 'auth.oauthCallback.loading' | transloco }}</div>
          } @else if (error()) {
            <div class="text-4xl mb-3">⚠️</div>
            <h1 class="text-xl font-bold text-white mb-2">{{ 'auth.oauthCallback.errorTitle' | transloco }}</h1>
            <p class="text-sm text-signal-rose mb-6">{{ error() | transloco }}</p>
            <a routerLink="/login" class="btn-secondary text-sm">{{ 'auth.oauthCallback.tryAgain' | transloco }}</a>
          }
        </div>
      </div>
    </div>
  `,
})
export class OAuthCallbackComponent implements OnInit {
  private auth = inject(AuthService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  loading = signal(true);
  error = signal<string | null>(null);

  ngOnInit(): void {
    const ticket = this.route.snapshot.queryParamMap.get('ticket');
    const err = this.route.snapshot.queryParamMap.get('error');
    if (err) {
      this.loading.set(false);
      this.error.set(err);
      return;
    }
    if (!ticket) {
      this.loading.set(false);
      this.error.set('auth.oauthCallback.missingTicket');
      return;
    }
    this.auth.exchangeOAuthTicket(ticket).subscribe({
      next: (res) => {
        // Clean URL (remove ticket from browser history)
        window.history.replaceState({}, '', '/auth/oauth-callback');
        this.router.navigateByUrl(res.returnTo || '/dashboard');
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err?.error?.message ?? 'auth.oauthCallback.failed');
      },
    });
  }
}