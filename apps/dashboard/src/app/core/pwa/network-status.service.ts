import { Injectable, signal, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

@Injectable({ providedIn: 'root' })
export class NetworkStatusService {
  private readonly platformId = inject(PLATFORM_ID);

  readonly isOnline = signal(true);
  readonly justReconnected = signal(false);

  constructor() {
    if (!isPlatformBrowser(this.platformId)) return;

    this.isOnline.set(navigator.onLine);

    window.addEventListener('online', () => {
      this.isOnline.set(true);
      this.justReconnected.set(true);
      setTimeout(() => this.justReconnected.set(false), 3000);
    });

    window.addEventListener('offline', () => {
      this.isOnline.set(false);
    });
  }
}