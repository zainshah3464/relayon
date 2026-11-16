import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { AuthService } from '../auth/auth.service';

const STORAGE_PREFIX = 'relayon_onboarded_v1';

@Injectable({ providedIn: 'root' })
export class OnboardingService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly auth = inject(AuthService);

  readonly shouldShowWizard = signal(false);

  /** Call after login/dashboard init. Returns true if this user hasn't seen the wizard. */
  check(): boolean {
    if (!isPlatformBrowser(this.platformId)) return false;
    if (!this.auth.isAuthenticated()) return false;

    const userId = this.auth.user()?.id;
    if (!userId) return false;

    const key = `${STORAGE_PREFIX}:${userId}`;
    const seen = localStorage.getItem(key);

    if (!seen) {
      this.shouldShowWizard.set(true);
      return true;
    }
    return false;
  }

  /** Mark wizard as completed (or dismissed). */
  dismiss(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const userId = this.auth.user()?.id;
    if (!userId) return;

    localStorage.setItem(`${STORAGE_PREFIX}:${userId}`, '1');
    this.shouldShowWizard.set(false);
  }

  /** Reset onboarding (useful for "Replay tour" button in Settings). */
  reset(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const userId = this.auth.user()?.id;
    if (!userId) return;

    localStorage.removeItem(`${STORAGE_PREFIX}:${userId}`);
    this.shouldShowWizard.set(true);
  }
}