import {z} from 'zod';

export const mappingItemSchema = z.object({
  token: z.string().min(1),
  original: z.string(),
  rule_id: z.string().min(1),
  location: z.object({
    part: z.string().min(1),
    index: z.number().int().positive(),
  }),
});

export const restoreMappingSchema = z.object({
  version: z.string().min(1),
  task_id: z.string().min(1).optional(),
  doc_fingerprint: z.string().min(1),
  masked_doc_fingerprint: z.string().min(1),
  created_at: z.string().min(1),
  rules_version: z.string().min(1),
  tokens: z.record(z.string().min(1), z.string()).optional(),
  items: z.array(mappingItemSchema),
});

export const encryptedMappingSchema = z.object({
  version: z.string().min(1),
  algorithm: z.literal('aes-256-gcm'),
  kdf: z.literal('scrypt'),
  salt: z.string().min(1),
  iv: z.string().min(1),
  authTag: z.string().min(1),
  ciphertext: z.string().min(1),
});

export type MappingItem = z.infer<typeof mappingItemSchema>;
export type RestoreMapping = z.infer<typeof restoreMappingSchema>;
export type EncryptedMapping = z.infer<typeof encryptedMappingSchema>;
