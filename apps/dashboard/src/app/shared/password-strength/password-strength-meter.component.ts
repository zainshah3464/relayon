import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnChanges,
  SimpleChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslocoModule } from '@jsverse/transloco';
import zxcvbn from 'zxcvbn';

interface ZxcvbnResult {
  score: 0 | 1 | 2 | 3 | 4;
  feedback: { warning: string; suggestions: string[] };
  crack_times_display: {
    offline_slow_hashing_1e4_per_second: string;
    online_no_throttling_10_per_second: string;
  };
}

@Component({
  selector: 'app-password-strength-meter',
  standalone: true,
  imports: [CommonModule, TranslocoModule],
  template: `
    @if (password) {
      <div class="mt-2.5">
        <!-- Bars -->
        <div class="flex gap-1" role="progressbar" [attr.aria-valuenow]="score + 1" aria-valuemin="1" aria-valuemax="5" aria-label="Password strength">
          @for (i of [0, 1, 2, 3]; track i) {
            <div
              class="h-1 flex-1 rounded-full transition-all duration-200"
              [ngClass]="barClass(i)"
            ></div>
          }
        </div>

        <!-- Label + crack time -->
        <div class="mt-2 flex items-center justify-between text-xs">
          <span
            [ngClass]="labelClass()"
            class="font-medium"
            aria-live="polite"
          >
            {{ labelKey() | transloco }}
          </span>
          @if (crackTime()) {
            <span class="text-muted-2">{{ crackTime() }}</span>
          }
        </div>

        <!-- Feedback warning -->
        @if (warning()) {
          <p class="mt-1 text-xs text-muted">{{ warning() }}</p>
        }
      </div>
    }
  `,
})
export class PasswordStrengthMeterComponent implements OnChanges {
  @Input() password = '';
  @Input() userInputs: string[] = [];
  @Output() strengthChange = new EventEmitter<boolean>();

  private result: ZxcvbnResult | null = null;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['password'] || changes['userInputs']) {
      this.recalculate();
    }
  }

  private recalculate(): void {
    if (!this.password) {
      this.result = null;
      this.strengthChange.emit(false);
      return;
    }

    const raw = zxcvbn(this.password, this.userInputs);
    this.result = raw as unknown as ZxcvbnResult;

    const strong = raw.score >= 3 && this.password.length >= 12;
    this.strengthChange.emit(strong);
  }

  get score(): number {
    return this.result?.score ?? 0;
  }

  labelKey(): string {
    const s = this.score;
    if (s <= 1) return 'passwordStrength.weak';
    if (s === 2) return 'passwordStrength.fair';
    if (s === 3) return 'passwordStrength.strong';
    return 'passwordStrength.veryStrong';
  }

  labelClass(): string {
    const s = this.score;
    if (s <= 1) return 'text-signal-rose';
    if (s === 2) return 'text-signal-amber';
    return 'text-signal-green';
  }

  barClass(index: number): string {
    if (index >= this.score) return 'bg-surface-3';

    const s = this.score;
    if (s <= 1) return 'bg-signal-rose';
    if (s === 2) return 'bg-signal-amber';
    return 'bg-signal-green';
  }

  warning(): string {
    return this.result?.feedback?.warning ?? '';
  }

  crackTime(): string {
    return (
      this.result?.crack_times_display?.offline_slow_hashing_1e4_per_second ??
      ''
    );
  }
}