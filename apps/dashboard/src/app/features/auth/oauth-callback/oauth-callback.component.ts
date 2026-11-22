import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { AuthService } from '../../../core/auth/auth.service';
import { AuthLayoutComponent } from '../../../shared/layout/auth-layout/auth-layout.component';
import { IconComponent } from '../../../shared/ui/icon/icon.component';

@Component({
  selector: 'app-oauth-callback',
  standalone: true,
  imports: [CommonModule, RouterLink, TranslocoModule, AuthLayoutComponent, IconComponent],
  template: `
    <app-auth-layout>
      @if (loading()) {
        <div class="text-center animate-fade-in">
          <div class="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-hairline bg-surface-2">
            <app-icon name="loader" [size]="26" [strokeWidth]="2" class="animate-spin text-relay-violet" />
          </div>
          <h1 class="mt-6 text-xl font-bold text-foreground">
            {{ 'auth.oauthCallback.loading' | transloco }}
          </h1>
          <p class="mt-2 text-sm text-muted">One moment please…</p>
        </div>
      } @else if (error()) {
        <div class="text-center animate-scale-in">
          <div class="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-signal-rose/30 bg-signal-rose/10">
            <app-icon name="x-circle" [size]="28" [strokeWidth]="1.75" class="text-signal-rose" />
          </div>

          <h1 class="mt-6 text-2xl font-bold tracking-tight text-foreground">
            {{ 'auth.oauthCallback.errorTitle' | transloco }}
          </h1>
          <p class="mt-2 text-sm text-muted">{{ error() | transloco }}</p>

          <a routerLink="/login" class="btn-secondary mt-6 inline-flex w-full justify-center">
            <app-icon name="arrow-left" [size]="14" [strokeWidth]="2" />
            <span>{{ 'auth.oauthCallback.tryAgain' | transloco }}</span>
          </a>
        </div>
      }
    </app-auth-layout>
  `,
})
export class OAuthCallbackComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

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
        if (typeof window !== 'undefined') {
          window.history.replaceState({}, '', '/auth/oauth-callback');
        }
        this.router.navigateByUrl(res.returnTo || '/dashboard');
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err?.error?.message ?? 'auth.oauthCallback.failed');
      },
    });
  }
}