import { z } from 'zod';

export const ManifestSchema = z.object({
  schemaVersion: z.literal(1),
  type: z
    .string()
    .regex(/^[a-z][a-z0-9-]{1,39}$/, 'type must be lowercase alphanumeric + dash (2-40 chars)'),
  displayName: z.string().min(1).max(80),
  version: z.string().regex(/^\d+\.\d+\.\d+$/, 'version must be semver'),
  trust: z.enum(['sandboxed', 'trusted']),
  author: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
  entrypoint: z.string().regex(/^[a-zA-Z0-9._-]+\.js$/, 'entrypoint must be a .js file'),
  fields: z.array(
    z.object({
      key: z.string().regex(/^[a-zA-Z][a-zA-Z0-9_]*$/),
      label: z.string().min(1).max(80),
      type: z.enum([
        'text', 'url', 'password', 'email', 'textarea',
        'number', 'boolean', 'select', 'json', 'string-array',
      ]),
      required: z.boolean(),
      placeholder: z.string().max(200).optional(),
      help: z.string().max(300).optional(),
      sensitive: z.boolean().optional(),
      defaultValue: z.union([z.string(), z.number(), z.boolean()]).optional(),
      options: z
        .array(z.object({ value: z.string(), label: z.string() }))
        .optional(),
    }),
  ),
  testPayload: z.unknown().optional(),
});

export type Manifest = z.infer<typeof ManifestSchema>;