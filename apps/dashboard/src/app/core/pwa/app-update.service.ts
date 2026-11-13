import { Injectable, ApplicationRef, inject, signal, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { SwUpdate, type VersionReadyEvent } from '@angular/service-worker';
import { filter } from 'rxjs/operators';
import { concat, first, interval } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AppUpdateService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly swUpdate = inject(SwUpdate, { optional: true });
  private readonly appRef = inject(ApplicationRef);

  readonly updateAvailable = signal(false);
  readonly reloading = signal(false);

  init(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    if (!this.swUpdate || !this.swUpdate.isEnabled) return;

    const appStable$ = this.appRef.isStable.pipe(first((s) => s));
    const every30Min$ = interval(30 * 60 * 1000);
    concat(appStable$, every30Min$).subscribe(async () => {
      try {
        await this.swUpdate!.checkForUpdate();
      } catch {
        /* silent */
      }
    });

    this.swUpdate.versionUpdates
      .pipe(
        filter(
          (evt): evt is VersionReadyEvent => evt.type === 'VERSION_READY',
        ),
      )
      .subscribe(() => this.updateAvailable.set(true));

    this.swUpdate.unrecoverable.subscribe(() => {
      document.location.reload();
    });
  }

  async reload(): Promise<void> {
    if (this.reloading()) return;
    if (!this.swUpdate) return;
    this.reloading.set(true);
    try {
      await this.swUpdate.activateUpdate();
      document.location.reload();
    } catch {
      this.reloading.set(false);
    }
  }
}