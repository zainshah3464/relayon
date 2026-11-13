import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PwaInstallService } from '../../core/pwa/pwa-install.service';

@Component({
  selector: 'app-install-prompt',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (install.canInstall()) {
      <div class="fixed bottom-6 end-6 z-50 max-w-sm rounded-xl border border-hairline bg-surface p-4 shadow-2xl me-20">
        <div class="flex items-start gap-3">
          <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-relay-violet to-relay-cyan text-white font-bold">R</div>
          <div class="flex-1">
            <p class="text-sm font-medium text-white">Install Relayon</p>
            <p class="text-xs text-muted mt-1">Get faster access and offline support.</p>
          </div>
        </div>
        <div class="flex gap-2 mt-3">
          <button (click)="install.install()" class="btn-primary text-xs flex-1">Install</button>
          <button (click)="install.dismiss()" class="btn-secondary text-xs">Not now</button>
        </div>
      </div>
    }
  `,
})
export class InstallPromptComponent {
  install = inject(PwaInstallService);
}