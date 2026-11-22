import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { AuthService } from '../../../core/auth/auth.service';
import { AuthLayoutComponent } from '../../../shared/layout/auth-layout/auth-layout.component';
import { IconComponent } from '../../../shared/ui/icon/icon.component';

@Component({
  selector: 'app-verify-email',
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
            {{ 'auth.verifyEmail.verifying' | transloco }}
          </h1>
          <p class="mt-2 text-sm text-muted">One moment please…</p>
        </div>
      } @else if (success()) {
        <div class="text-center animate-scale-in">
          <div class="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-signal-green/30 bg-signal-green/10">
            <app-icon name="check-circle" [size]="28" [strokeWidth]="1.75" class="text-signal-green" />
          </div>

          <h1 class="mt-6 text-2xl font-bold tracking-tight text-foreground">
            {{ 'auth.verifyEmail.successTitle' | transloco }}
          </h1>
          <p class="mt-2 text-sm text-muted">
            {{ 'auth.verifyEmail.successBody' | transloco }}
          </p>

          <a routerLink="/login" class="btn-primary mt-6 inline-flex w-full justify-center">
            {{ 'auth.verifyEmail.signIn' | transloco }}
            <app-icon name="arrow-right" [size]="14" [strokeWidth]="2" />
          </a>
        </div>
      } @else {
        <div class="text-center animate-scale-in">
          <div class="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-signal-rose/30 bg-signal-rose/10">
            <app-icon name="x-circle" [size]="28" [strokeWidth]="1.75" class="text-signal-rose" />
          </div>

          <h1 class="mt-6 text-2xl font-bold tracking-tight text-foreground">
            {{ 'auth.verifyEmail.failedTitle' | transloco }}
          </h1>
          <p class="mt-2 text-sm text-muted">{{ error() | transloco }}</p>

          <a routerLink="/login" class="btn-secondary mt-6 inline-flex w-full justify-center">
            <app-icon name="arrow-left" [size]="14" [strokeWidth]="2" />
            <span>{{ 'auth.verifyEmail.backToLogin' | transloco }}</span>
          </a>
        </div>
      }
    </app-auth-layout>
  `,
})
export class VerifyEmailComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);

  readonly loading = signal(true);
  readonly success = signal(false);
  readonly error = signal('');

  ngOnInit(): void {
    const token = this.route.snapshot.queryParamMap.get('token');
    if (!token) {
      this.loading.set(false);
      this.error.set('auth.verifyEmail.missingToken');
      return;
    }

    this.auth.verifyEmail(token).subscribe({
      next: () => {
        this.loading.set(false);
        this.success.set(true);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err?.error?.message ?? 'auth.verifyEmail.invalidLink');
      },
    });
  }
}