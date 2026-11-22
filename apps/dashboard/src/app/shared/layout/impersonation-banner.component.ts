import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ImpersonationClientService } from '../../core/admin/impersonation.service';
import { IconComponent } from '../../shared/ui/icon/icon.component';

@Component({
  selector: 'app-impersonation-banner',
  standalone: true,
  imports: [CommonModule, IconComponent],
  template: `
    @if (imp.isActive()) {
      <div class="fixed top-0 inset-x-0 z-[60] bg-signal-amber text-midnight py-1.5 px-4 flex items-center justify-between text-xs font-medium">
        <div class="flex items-center gap-2">
          <app-icon name="alert-triangle" [size]="14" [strokeWidth]="2.5" />
          <span>
            Impersonating <strong>{{ imp.target()?.name }}</strong>
            · {{ imp.minutesRemaining() }}min remaining
          </span>
        </div>
        <button
          (click)="imp.exit()"
          class="bg-midnight text-signal-amber px-3 py-1 rounded text-xs font-semibold hover:bg-midnight/80"
        >
          Exit impersonation
        </button>
      </div>
    }
  `,
})
export class ImpersonationBannerComponent {
  imp = inject(ImpersonationClientService);
}