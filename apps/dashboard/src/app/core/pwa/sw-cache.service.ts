import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

@Injectable({ providedIn: 'root' })
export class SwCacheService {
  private readonly platformId = inject(PLATFORM_ID);

  async clearApiCaches(): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) return;
    if (!('caches' in window)) return;

    const names = await caches.keys();
    const toDelete = names.filter(
      (n) => n.startsWith('ngsw:') && (n.includes('api-') || n.includes(':data:')),
    );

    await Promise.all(toDelete.map((n) => caches.delete(n)));
  }

  async clearAll(): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) return;
    if (!('caches' in window)) return;
    const names = await caches.keys();
    await Promise.all(names.filter((n) => n.startsWith('ngsw:')).map((n) => caches.delete(n)));
  }
}