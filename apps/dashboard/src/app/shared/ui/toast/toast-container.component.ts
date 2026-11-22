import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastService, type ToastVariant } from './toast.service';
import { IconComponent, type IconName } from '../icon/icon.component';

@Component({
  selector: 'app-toast-container',
  standalone: true,
  imports: [CommonModule, IconComponent],
  template: `
    <div
      class="pointer-events-none fixed top-4 end-4 z-[200] flex w-full max-w-sm flex-col gap-2 px-4 sm:px-0 pt-safe"
      role="region"
      aria-label="Notifications"
      aria-live="polite"
    >
      @for (toast of toasts(); track toast.id) {
        <div
          class="pointer-events-auto overflow-hidden rounded-xl border shadow-xl"
          [ngClass]="containerClass(toast.variant)"
          [class.animate-slide-down]="!toast.exiting"
          [class.animate-fade-out]="toast.exiting"
          role="alert"
        >
          <div class="flex items-start gap-3 p-3.5">
            <app-icon
              [name]="iconFor(toast.variant)"
              [size]="18"
              [strokeWidth]="2"
              [class]="iconClass(toast.variant)"
            />

            <div class="min-w-0 flex-1">
              @if (toast.title) {
                <p class="text-sm font-semibold text-foreground leading-snug">
                  {{ toast.title }}
                </p>
              }
              <p
                class="text-sm text-muted leading-snug"
                [class.mt-0.5]="toast.title"
              >
                {{ toast.message }}
              </p>

              @if (toast.action) {
                <button
                  (click)="runAction(toast)"
                  class="mt-2 text-xs font-medium hover:underline"
                  [ngClass]="iconClass(toast.variant)"
                >
                  {{ toast.action.label }}
                </button>
              }
            </div>

            <button
              (click)="dismiss(toast.id)"
              class="shrink-0 rounded p-1 text-muted-2 hover:bg-surface-3 hover:text-foreground transition-colors"
              aria-label="Dismiss"
            >
              <app-icon name="x" [size]="14" [strokeWidth]="2" />
            </button>
          </div>
        </div>
      }
    </div>
  `,
})
export class ToastContainerComponent {
  private readonly service = inject(ToastService);
  readonly toasts = this.service.toasts;

  iconFor(variant: ToastVariant): IconName {
    switch (variant) {
      case 'success':
        return 'check-circle';
      case 'error':
        return 'x-circle';
      case 'warning':
        return 'alert-circle';
      default:
        return 'info';
    }
  }

  iconClass(variant: ToastVariant): string {
    switch (variant) {
      case 'success':
        return 'text-signal-green';
      case 'error':
        return 'text-signal-rose';
      case 'warning':
        return 'text-signal-amber';
      default:
        return 'text-info';
    }
  }

  containerClass(variant: ToastVariant): string {
    switch (variant) {
      case 'success':
        return 'bg-surface border-signal-green/30';
      case 'error':
        return 'bg-surface border-signal-rose/30';
      case 'warning':
        return 'bg-surface border-signal-amber/30';
      default:
        return 'bg-surface border-info/30';
    }
  }

  dismiss(id: string): void {
    this.service.dismiss(id);
  }

  runAction(toast: { action?: { handler: () => void } }): void {
    toast.action?.handler?.();
  }
}