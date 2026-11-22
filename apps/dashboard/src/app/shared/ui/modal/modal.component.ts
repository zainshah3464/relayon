import {
  Component,
  input,
  output,
  computed,
  ElementRef,
  viewChild,
  AfterViewInit,
  OnDestroy,
  HostListener,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconComponent } from '../icon/icon.component';

type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';

/**
 * Accessible modal.
 *
 * Features:
 * - Focus trap
 * - Escape to close
 * - Backdrop click to close
 * - Body scroll lock
 * - Restores focus on close
 * - Safe-area aware
 *
 * Usage:
 *   @if (open()) {
 *     <app-modal title="Create API key" (closed)="open.set(false)">
 *       <div>Body content</div>
 *       <div modal-footer>
 *         <button class="btn-secondary" (click)="open.set(false)">Cancel</button>
 *         <button class="btn-primary" (click)="save()">Save</button>
 *       </div>
 *     </app-modal>
 *   }
 */
@Component({
  selector: 'app-modal',
  standalone: true,
  imports: [CommonModule, IconComponent],
  template: `
    <div
      class="fixed inset-0 z-[150] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in"
      role="dialog"
      aria-modal="true"
      [attr.aria-labelledby]="titleId"
      (click)="onBackdrop($event)"
    >
      <div class="absolute inset-0 bg-black/70 backdrop-blur-sm"></div>

      <div
        #dialog
        class="relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl sm:rounded-2xl border border-hairline bg-surface shadow-2xl animate-slide-up sm:animate-scale-in"
        [ngClass]="sizeClass()"
        tabindex="-1"
      >
        <!-- Header -->
        @if (title() || subtitle() || showClose()) {
          <div class="flex shrink-0 items-start justify-between gap-4 border-b border-hairline px-5 sm:px-6 py-4">
            <div class="min-w-0 flex-1">
              @if (title()) {
                <h2
                  [id]="titleId"
                  class="text-base sm:text-lg font-semibold text-foreground leading-tight"
                >
                  {{ title() }}
                </h2>
              }
              @if (subtitle()) {
                <p class="mt-1 text-xs sm:text-sm text-muted leading-snug">
                  {{ subtitle() }}
                </p>
              }
            </div>
            @if (showClose()) {
              <button
                type="button"
                (click)="close()"
                class="shrink-0 rounded-lg p-2 -m-1 text-muted hover:bg-surface-2 hover:text-foreground transition-colors"
                aria-label="Close dialog"
              >
                <app-icon name="x" [size]="18" [strokeWidth]="2" />
              </button>
            }
          </div>
        }

        <!-- Body -->
        <div class="min-h-0 flex-1 overflow-y-auto px-5 sm:px-6 py-5">
          <ng-content />
        </div>

        <!-- Footer -->
        <div
          class="shrink-0 flex flex-col-reverse sm:flex-row sm:justify-end gap-2 border-t border-hairline bg-surface-2/30 px-5 sm:px-6 py-4 pb-safe"
        >
          <ng-content select="[modal-footer]" />
        </div>
      </div>
    </div>
  `,
})
export class ModalComponent implements AfterViewInit, OnDestroy {
  readonly title = input<string>('');
  readonly subtitle = input<string>('');
  readonly size = input<ModalSize>('md');
  readonly showClose = input(true);
  readonly closeOnBackdrop = input(true);

  readonly closed = output<void>();

  readonly titleId = `modal-title-${Math.random().toString(36).slice(2, 8)}`;

  private readonly dialogRef = viewChild<ElementRef<HTMLDivElement>>('dialog');
  private readonly previousOverflow = { value: '' };
  private readonly previousFocus: HTMLElement | null = null;

  readonly sizeClass = computed(() => {
    switch (this.size()) {
      case 'sm':
        return 'sm:max-w-sm';
      case 'lg':
        return 'sm:max-w-2xl';
      case 'xl':
        return 'sm:max-w-4xl';
      case 'full':
        return 'sm:max-w-6xl';
      default:
        return 'sm:max-w-lg';
    }
  });

  constructor() {
    // Capture focus + lock body scroll
    if (typeof document !== 'undefined') {
      this.previousFocus = document.activeElement as HTMLElement;
      this.previousOverflow.value = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }
  }

  ngAfterViewInit(): void {
    setTimeout(() => {
      const dialog = this.dialogRef()?.nativeElement;
      if (!dialog) return;
      // Focus first focusable, or the dialog itself
      const first = dialog.querySelector<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      (first ?? dialog).focus();
    }, 0);
  }

  ngOnDestroy(): void {
    if (typeof document !== 'undefined') {
      document.body.style.overflow = this.previousOverflow.value;
      this.previousFocus?.focus?.();
    }
  }

  close(): void {
    this.closed.emit();
  }

  onBackdrop(event: MouseEvent): void {
    if (!this.closeOnBackdrop()) return;
    // Only close if the click was on the backdrop, not the dialog
    const target = event.target as HTMLElement;
    if (target === event.currentTarget) {
      this.close();
    }
  }

  @HostListener('document:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.close();
      return;
    }

    if (event.key !== 'Tab') return;

    const dialog = this.dialogRef()?.nativeElement;
    if (!dialog) return;

    const focusables = Array.from(
      dialog.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((el) => el.offsetParent !== null);

    if (focusables.length === 0) {
      event.preventDefault();
      dialog.focus();
      return;
    }

    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement;

    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }
}