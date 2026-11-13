import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AppUpdateService } from '../../core/pwa/app-update.service';

@Component({
  selector: 'app-update-prompt',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (update.updateAvailable()) {
      <div class="fixed bottom-6 start-6 z-50 max-w-sm rounded-xl border border-relay-violet/40 bg-surface p-4 shadow-2xl">
        <p class="text-sm font-medium text-white">New version available</p>
        <p class="text-xs text-muted mt-1">Reload to get the latest features and fixes.</p>
        <div class="flex gap-2 mt-3">
          <button (click)="update.reload()" [disabled]="update.reloading()" class="btn-primary text-xs">
            {{ update.reloading() ? 'Reloading...' : 'Reload now' }}
          </button>
        </div>
      </div>
    }
  `,
})
export class UpdatePromptComponent {
  update = inject(AppUpdateService);
}