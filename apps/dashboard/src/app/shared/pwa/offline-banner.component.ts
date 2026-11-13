import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NetworkStatusService } from '../../core/pwa/network-status.service';

@Component({
  selector: 'app-offline-banner',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (!network.isOnline()) {
      <div class="fixed top-0 inset-x-0 z-50 bg-signal-amber/90 text-midnight text-xs font-medium py-1.5 px-4 text-center">
        ⚠ You're offline — showing cached data. New changes require internet.
      </div>
    }
    @if (network.justReconnected() && network.isOnline()) {
      <div class="fixed top-0 inset-x-0 z-50 bg-signal-green/90 text-midnight text-xs font-medium py-1.5 px-4 text-center">
        ✓ Back online
      </div>
    }
  `,
})
export class OfflineBannerComponent {
  network = inject(NetworkStatusService);
}