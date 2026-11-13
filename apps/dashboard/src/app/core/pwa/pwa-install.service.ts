import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISSED_KEY = 'relayon_pwa_install_dismissed_at';
const DISMISS_TTL_DAYS = 30;

@Injectable({ providedIn: 'root' })
export class PwaInstallService {
  private readonly platformId = inject(PLATFORM_ID);
  private deferredPrompt: BeforeInstallPromptEvent | null = null;

  readonly canInstall = signal(false);
  readonly isInstalled = signal(false);

  constructor() {
    if (!isPlatformBrowser(this.platformId)) return;

    if (window.matchMedia('(display-mode: standalone)').matches) {
      this.isInstalled.set(true);
    }

    const dismissed = Number(localStorage.getItem(DISMISSED_KEY) ?? '0');
    const recentlyDismissed = Date.now() - dismissed < DISMISS_TTL_DAYS * 86_400_000;

    window.addEventListener('beforeinstallprompt', (event) => {
      event.preventDefault();
      this.deferredPrompt = event as BeforeInstallPromptEvent;
      if (!recentlyDismissed) this.canInstall.set(true);
    });

    window.addEventListener('appinstalled', () => {
      this.isInstalled.set(true);
      this.canInstall.set(false);
      this.deferredPrompt = null;
    });
  }

  async install(): Promise<boolean> {
    if (!this.deferredPrompt) return false;
    this.deferredPrompt.prompt();
    const { outcome } = await this.deferredPrompt.userChoice;
    this.deferredPrompt = null;
    this.canInstall.set(false);
    if (outcome === 'accepted') this.isInstalled.set(true);
    return outcome === 'accepted';
  }

  dismiss(): void {
    localStorage.setItem(DISMISSED_KEY, String(Date.now()));
    this.canInstall.set(false);
  }
}