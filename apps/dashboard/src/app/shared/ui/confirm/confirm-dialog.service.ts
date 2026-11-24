import { Injectable, signal } from '@angular/core';

export type ConfirmVariant = 'default' | 'danger';

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: ConfirmVariant;
  /** Optional icon override. */
  icon?: 'alert-triangle' | 'trash' | 'logout' | 'info';
}

// ⚠️ FIX: exported so the component's `state` property can be typed in .d.ts emit
export interface ConfirmState extends ConfirmOptions {
  id: number;
  resolve: (value: boolean) => void;
}

@Injectable({ providedIn: 'root' })
export class ConfirmDialogService {
  private readonly _state = signal<ConfirmState | null>(null);
  readonly state = this._state.asReadonly();

  /**
   * Promise-based confirm.
   *
   * Usage:
   *   const ok = await this.confirm.confirm({
   *     title: 'Revoke API key',
   *     message: `Revoke "${key.name}"? This cannot be undone.`,
   *     confirmText: 'Revoke',
   *     variant: 'danger',
   *   });
   *   if (!ok) return;
   */
  confirm(opts: ConfirmOptions): Promise<boolean> {
    // If already open, resolve the previous one as false
    const prev = this._state();
    if (prev) prev.resolve(false);

    return new Promise<boolean>((resolve) => {
      this._state.set({
        ...opts,
        id: Date.now(),
        resolve,
      });
    });
  }

  resolve(value: boolean): void {
    const state = this._state();
    if (!state) return;
    state.resolve(value);
    this._state.set(null);
  }
}