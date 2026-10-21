import type { DeliveryAdapter } from './types';
import { HttpAdapter } from './http.adapter';
import { SlackAdapter } from './slack.adapter';
import { EmailAdapter } from './email.adapter';
import { SheetsAdapter } from './sheets.adapter';

const adapters: DeliveryAdapter[] = [
  new HttpAdapter(),
  new SlackAdapter(),
  new EmailAdapter(),
  new SheetsAdapter(),
];

const registry = new Map<string, DeliveryAdapter>();
for (const a of adapters) registry.set(a.type, a);

export function getAdapter(type: string): DeliveryAdapter | null {
  return registry.get(type) ?? null;
}

export function supportedAdapterTypes(): string[] {
  return Array.from(registry.keys());
}