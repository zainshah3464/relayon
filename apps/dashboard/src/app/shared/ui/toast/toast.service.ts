import { Injectable, signal, computed } from '@angular/core';

export type ToastVariant = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  variant: ToastVariant;
  title?: string;
  message: string;
  /** Duration in ms. Default 4000. Set to 0 for persistent. */
  duration: number;
  /** Optional action button. */
  action?: { label: string; handler: () => void };
  /** Whether this toast is currently exiting (for animation). */
  exiting?: boolean;
}

export interface ToastOptions {
  title?: string;
  duration?: number;
  action?: { label: string; handler: () => void };
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly _toasts = signal<Toast[]>([]);
  readonly toasts = this._toasts.asReadonly();
  readonly count = computed(() => this._toasts().length);

  success(message: string, opts: ToastOptions = {}): string {
    return this.add('success', message, opts);
  }

  error(message: string, opts: ToastOptions = {}): string {
    return this.add('error', message, { duration: 6000, ...opts });
  }

  warning(message: string, opts: ToastOptions = {}): string {
    return this.add('warning', message, opts);
  }

  info(message: string, opts: ToastOptions = {}): string {
    return this.add('info', message, opts);
  }

  dismiss(id: string): void {
    const toast = this._toasts().find((t) => t.id === id);
    if (!toast || toast.exiting) return;

    // Trigger exit animation
    this._toasts.update((list) =>
      list.map((t) => (t.id === id ? { ...t, exiting: true } : t)),
    );

    // Remove after animation
    setTimeout(() => {
      this._toasts.update((list) => list.filter((t) => t.id !== id));
    }, 200);
  }

  dismissAll(): void {
    this._toasts().forEach((t) => this.dismiss(t.id));
  }

  private add(
    variant: ToastVariant,
    message: string,
    opts: ToastOptions,
  ): string {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const toast: Toast = {
      id,
      variant,
      message,
      title: opts.title,
      duration: opts.duration ?? 4000,
      action: opts.action,
    };

    this._toasts.update((list) => [...list, toast]);

    if (toast.duration > 0) {
      setTimeout(() => this.dismiss(id), toast.duration);
    }

    return id;
  }
}