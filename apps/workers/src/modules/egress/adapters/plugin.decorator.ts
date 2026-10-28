import { SetMetadata } from '@nestjs/common';

export const DESTINATION_ADAPTER_METADATA = 'relayon:destination_adapter';

export type AdapterFieldType =
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

export interface AdapterFieldDescriptor {
  key: string;
  label: string;
  type: AdapterFieldType;
  required: boolean;
  placeholder?: string;
  help?: string;
  sensitive?: boolean;
  defaultValue?: string | number | boolean;
  options?: Array<{ value: string; label: string }>;
}

export interface DestinationAdapterMetadata {
  type: string;
  displayName: string;
  fields: AdapterFieldDescriptor[];
  testPayload?: unknown;
  supportsIdempotency?: boolean;
}

export const DestinationAdapter = (meta: DestinationAdapterMetadata) =>
  SetMetadata(DESTINATION_ADAPTER_METADATA, meta);