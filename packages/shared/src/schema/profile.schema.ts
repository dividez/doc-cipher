import { z } from 'zod';
import { settingsSchema } from './settings.schema.js';

export const maskProfileSchema = z.object({
  id: z
    .string()
    .min(1)
    .max(128)
    .regex(/^[a-zA-Z0-9_-]+$/, 'profile id must be ascii'),
  name: z.string().min(1),
  created_at: z.string().min(1),
  updated_at: z.string().min(1),
  settings: settingsSchema,
});

export type MaskProfile = z.infer<typeof maskProfileSchema>;
