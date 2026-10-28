import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import type { SchemaField } from './schema-form.types';

@Component({
  selector: 'app-schema-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="space-y-4">
      @for (field of fields(); track field.key) {
        <div>
          <label [for]="'field-' + field.key" class="label">
            {{ field.label }}
            @if (field.required) {
              <span class="text-signal-rose">*</span>
            }
          </label>

          @switch (field.type) {
            @case ('textarea') {
              <textarea
                [id]="'field-' + field.key"
                [formControlName]="field.key"
                rows="4"
                class="input font-mono text-xs"
                [placeholder]="field.placeholder ?? ''"
              ></textarea>
            }
            @case ('json') {
              <textarea
                [id]="'field-' + field.key"
                [formControlName]="field.key"
                rows="3"
                class="input font-mono text-xs"
                [placeholder]="field.placeholder ?? ''"
              ></textarea>
            }
            @case ('boolean') {
              <label class="flex items-center gap-2 text-sm text-white">
                <input
                  [id]="'field-' + field.key"
                  type="checkbox"
                  [formControlName]="field.key"
                  class="rounded border-hairline"
                />
                <span>{{ field.help ?? 'Enable' }}</span>
              </label>
            }
            @case ('select') {
              <select
                [id]="'field-' + field.key"
                [formControlName]="field.key"
                class="input"
              >
                @if (!field.required) {
                  <option value="">—</option>
                }
                @for (opt of field.options ?? []; track opt.value) {
                  <option [value]="opt.value">{{ opt.label }}</option>
                }
              </select>
            }
            @case ('number') {
              <input
                [id]="'field-' + field.key"
                type="number"
                [formControlName]="field.key"
                class="input"
                [placeholder]="field.placeholder ?? ''"
              />
            }
            @default {
              <input
                [id]="'field-' + field.key"
                [type]="inputType(field)"
                [formControlName]="field.key"
                class="input"
                [class.font-mono]="field.sensitive"
                [placeholder]="field.placeholder ?? ''"
                [autocomplete]="field.sensitive ? 'new-password' : 'off'"
              />
            }
          }

          @if (field.help && field.type !== 'boolean') {
            <p class="text-xs text-muted mt-1">{{ field.help }}</p>
          }

          @if (field.required && controlInvalid(field.key)) {
            <p class="text-xs text-signal-rose mt-1">{{ field.label }} is required</p>
          }
        </div>
      }
    </div>
  `,
})
export class SchemaFormComponent {
  readonly fields = input.required<SchemaField[]>();
  readonly form = input.required<FormGroup>();

  inputType(field: SchemaField): string {
    switch (field.type) {
      case 'password':
        return 'password';
      case 'url':
        return 'url';
      case 'email':
        return 'email';
      case 'number':
        return 'number';
      default:
        return 'text';
    }
  }

  controlInvalid(key: string): boolean {
    const c = this.form().get(key);
    return !!c && c.invalid && c.touched;
  }
}