import { SetMetadata } from '@nestjs/common';

export const DESTINATION_ADAPTER_METADATA = 'relayon:destination_adapter';

export interface DestinationAdapterMetadata {
  type: string;
  displayName: string;
  /** JSON Schema–lite for config validation — surfaced in dashboard */
  configSchema: {
    required: string[];
    optional?: string[];
  };
  /** Does this adapter send an Idempotency-Key header? */
  supportsIdempotency?: boolean;
}

/**
 * Marks a class as a destination adapter. The registry scans for this
 * metadata at bootstrap and wires adapters automatically.
 *
 * Usage:
 *   @DestinationAdapter({
 *     type: 'discord',
 *     displayName: 'Discord',
 *     configSchema: { required: ['webhookUrl'] },
 *   })
 *   export class DiscordAdapter implements DeliveryAdapter { ... }
 */
export const DestinationAdapter = (meta: DestinationAdapterMetadata) =>
  SetMetadata(DESTINATION_ADAPTER_METADATA, meta);