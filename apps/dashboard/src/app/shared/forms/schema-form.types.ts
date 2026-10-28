import { FormBuilder, FormGroup, Validators } from '@angular/forms';

export type SchemaFieldType =
  | 'text'
  | 'url'
  | 'password'
  | 'email'
  | 'textarea'
  | 'number'
  | 'boolean'
  | 'select'
  | 'json'
  | 'string-array';

export interface SchemaField {
  key: string;
  label: string;
  type: SchemaFieldType;
  required: boolean;
  placeholder?: string;
  help?: string;
  sensitive?: boolean;
  defaultValue?: string | number | boolean;
  options?: Array<{ value: string; label: string }>;
}

export function buildSchemaForm(fields: SchemaField[], fb: FormBuilder): FormGroup {
  const controls: Record<string, unknown> = {};

  for (const field of fields) {
    const validators = [];
    if (field.required) validators.push(Validators.required);
    if (field.type === 'url') {
      validators.push(Validators.pattern(/^https?:\/\/.+/));
    }
    if (field.type === 'email') {
      validators.push(Validators.email);
    }

    let defaultValue: unknown = field.defaultValue ?? '';
    if (field.type === 'boolean') defaultValue = field.defaultValue ?? false;
    if (field.type === 'json' && field.defaultValue === undefined) defaultValue = '';

    controls[field.key] = [defaultValue, validators];
  }

  return fb.group(controls);
}

export function readSchemaForm(
  fields: SchemaField[],
  form: FormGroup,
): Record<string, unknown> {
  const raw = form.getRawValue() as Record<string, unknown>;
  const out: Record<string, unknown> = {};

  for (const field of fields) {
    const value = raw[field.key];

    if (value === '' || value === null || value === undefined) {
      if (field.required) {
        throw new Error(`Field "${field.label}" is required`);
      }
      continue;
    }

    switch (field.type) {
      case 'string-array': {
        if (Array.isArray(value)) {
          out[field.key] = value.map((v) => String(v).trim()).filter(Boolean);
        } else {
          out[field.key] = String(value)
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);
        }
        break;
      }
      case 'json': {
        if (typeof value === 'string') {
          if (!value.trim()) continue;
          try {
            out[field.key] = JSON.parse(value);
          } catch {
            throw new Error(`Field "${field.label}" is not valid JSON`);
          }
        } else {
          out[field.key] = value;
        }
        break;
      }
      case 'number': {
        const n = Number(value);
        if (!Number.isFinite(n)) {
          throw new Error(`Field "${field.label}" must be a number`);
        }
        out[field.key] = n;
        break;
      }
      case 'boolean': {
        out[field.key] = Boolean(value);
        break;
      }
      default:
        out[field.key] = value;
    }
  }

  return out;
}

export function patchSchemaForm(
  fields: SchemaField[],
  form: FormGroup,
  config: Record<string, unknown>,
): void {
  const patch: Record<string, unknown> = {};

  for (const field of fields) {
    const value = config[field.key];
    if (value === undefined) continue;

    if (field.type === 'json' && typeof value === 'object') {
      patch[field.key] = JSON.stringify(value, null, 2);
    } else if (field.type === 'string-array' && Array.isArray(value)) {
      patch[field.key] = value.join(', ');
    } else {
      patch[field.key] = value;
    }
  }

  form.patchValue(patch);
}