import {
  Component,
  inject,
  ElementRef,
  viewChild,
  AfterViewInit,
  OnDestroy,
  type Signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ConfirmDialogService,
  type ConfirmState,
} from './confirm-dialog.service';
import { IconComponent, type IconName } from '../icon/icon.component';

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [CommonModule, IconComponent],
  template: `
    @if (state(); as s) {
      <div
        class="fixed inset-0 z-[250] flex items-center justify-center p-4 animate-fade-in"
        role="alertdialog"
        aria-modal="true"
        [attr.aria-labelledby]="'confirm-title-' + s.id"
        [attr.aria-describedby]="'confirm-body-' + s.id"
        (click)="onBackdrop($event)"
        (keydown)="onKeydown($event)"
      >
        <div class="absolute inset-0 bg-black/70 backdrop-blur-sm" data-backdrop="true"></div>

        <div
          #dialog
          class="relative w-full max-w-md overflow-hidden rounded-2xl border border-hairline bg-surface shadow-2xl animate-scale-in"
          tabindex="-1"
        >
          <div class="p-6">
            <div class="flex items-start gap-4">
              <div [ngClass]="iconWrapClass(s.variant)">
                <app-icon
                  [name]="iconFor(s)"
                  [size]="22"
                  [strokeWidth]="2"
                />
              </div>
              <div class="min-w-0 flex-1 pt-0.5">
                <h2
                  [id]="'confirm-title-' + s.id"
                  class="text-base font-semibold text-foreground"
                >
                  {{ s.title }}
                </h2>
                <p
                  [id]="'confirm-body-' + s.id"
                  class="mt-1.5 text-sm text-muted leading-relaxed whitespace-pre-line"
                >
                  {{ s.message }}
                </p>
              </div>
            </div>
          </div>

          <div class="flex justify-end gap-2 border-t border-hairline bg-surface-2/40 px-6 py-3.5">
            <button type="button" (click)="cancel()" class="btn-secondary">
              {{ s.cancelText || 'Cancel' }}
            </button>
            <button
              type="button"
              [class.btn-danger]="s.variant === 'danger'"
              [class.btn-primary]="s.variant !== 'danger'"
              (click)="ok()"
            >
              {{ s.confirmText || 'Confirm' }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class ConfirmDialogComponent implements AfterViewInit, OnDestroy {
  private readonly service = inject(ConfirmDialogService);

  // ⚠️ FIX: explicit type annotation so TS can emit the .d.ts without
  // needing to infer the (previously non-exported) ConfirmState name.
  readonly state: Signal<ConfirmState | null> = this.service.state;

  private readonly dialogRef = viewChild<ElementRef<HTMLDivElement>>('dialog');

  ngAfterViewInit(): void {
    setTimeout(() => this.dialogRef()?.nativeElement?.focus(), 0);
  }

  ngOnDestroy(): void {}

  iconFor(s: { icon?: string; variant?: string }): IconName {
    if (s.icon) return s.icon as IconName;
    if (s.variant === 'danger') return 'alert-triangle';
    return 'info';
  }

  iconWrapClass(variant?: string): string {
    const base =
      'shrink-0 flex h-11 w-11 items-center justify-center rounded-full';
    if (variant === 'danger') {
      return `${base} bg-signal-rose/10 text-signal-rose`;
    }
    return `${base} bg-info/10 text-info`;
  }

  ok(): void {
    this.service.resolve(true);
  }

  cancel(): void {
    this.service.resolve(false);
  }

  onBackdrop(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (target.dataset['backdrop'] === 'true') {
      this.cancel();
    }
  }

  onKeydown(event: KeyboardEvent): void {
    // ⚠️ Stop propagation so parent modals' document-level Escape handlers don't also fire
    event.stopPropagation();
    if (event.key === 'Escape') {
      event.preventDefault();
      this.cancel();
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      this.ok();
    }
  }
}