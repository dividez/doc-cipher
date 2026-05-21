import { z } from 'zod';

export const modelHardwareSchema = z.object({
  min_memory_gb: z.number().positive(),
  recommended_memory_gb: z.number().positive().optional(),
  min_cpu_cores: z.number().int().positive().optional(),
  disk_gb: z.number().positive().optional(),
  cpu: z.string().optional(),
  gpu: z.string().optional(),
  notes: z.string().optional(),
});

export const manifestModelEntrySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().default(''),
  runtime: z.literal('llama.cpp').default('llama.cpp'),
  format: z.literal('gguf').default('gguf'),
  file_name: z.string().min(1).default('model.gguf'),
  download_url: z.string().url(),
  size_bytes: z.number().int().positive(),
  sha256: z.string().length(64).optional(),
  /** @deprecated 请使用 hardware.min_memory_gb */
  min_memory_gb: z.number().positive().optional(),
  hardware: modelHardwareSchema.optional(),
  tier: z.enum(['light', 'balanced', 'quality']).optional(),
  recommended: z.boolean().default(false),
});

export const modelManifestSchema = z.object({
  version: z.string().min(1),
  models: z.array(manifestModelEntrySchema).min(1),
});

export const installedModelSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  path: z.string().min(1),
  file_name: z.string().min(1),
  size_bytes: z.number().int().nonnegative(),
  sha256: z.string().optional(),
  installed_at: z.string().min(1),
});

export const downloadTaskSchema = z.object({
  model_id: z.string().min(1),
  status: z.enum(['downloading', 'verifying', 'failed', 'cancelled']),
  bytes_done: z.number().int().nonnegative(),
  total_bytes: z.number().int().nonnegative(),
  error_message: z.string().optional(),
});

export const modelStateSchema = z.object({
  version: z.string().default('1.0.0'),
  active_model_id: z.string().nullable().default(null),
  installed: z.array(installedModelSchema).default([]),
  download_task: downloadTaskSchema.nullable().default(null),
});

export const aiDetectEntitySchema = z.object({
  text: z.string().min(1),
  type: z.enum(['person_name', 'company_name', 'address', 'project_name', 'other']),
  confidence: z.number().min(0).max(1),
});

export const aiDetectPayloadSchema = z.object({
  text: z.string().min(1),
});

export const aiDetectResultSchema = z.object({
  entities: z.array(aiDetectEntitySchema),
});

export const aiDownloadProgressSchema = z.object({
  model_id: z.string().min(1),
  bytes_done: z.number().int().nonnegative(),
  total_bytes: z.number().int().nonnegative(),
  status: z.enum(['downloading', 'verifying', 'completed', 'failed', 'cancelled']),
  error_message: z.string().optional(),
});

export const aiStatusSchema = z.object({
  runtime_available: z.boolean(),
  server_running: z.boolean(),
  manifest_version: z.string().nullable(),
  active_model_id: z.string().nullable(),
  active_model_name: z.string().nullable(),
  model_installed: z.boolean(),
  download_task: downloadTaskSchema.nullable(),
  recommended_model: manifestModelEntrySchema.nullable(),
  available_models: z.array(manifestModelEntrySchema).default([]),
  manifest_error: z.string().nullable().default(null),
});

export type ModelHardware = z.infer<typeof modelHardwareSchema>;
export type ManifestModelEntry = z.infer<typeof manifestModelEntrySchema>;
export type ModelManifest = z.infer<typeof modelManifestSchema>;
export type InstalledModel = z.infer<typeof installedModelSchema>;
export type DownloadTask = z.infer<typeof downloadTaskSchema>;
export type ModelState = z.infer<typeof modelStateSchema>;
export type AiDetectEntity = z.infer<typeof aiDetectEntitySchema>;
export type AiDetectPayload = z.infer<typeof aiDetectPayloadSchema>;
export type AiDetectResult = z.infer<typeof aiDetectResultSchema>;
export type AiDownloadProgress = z.infer<typeof aiDownloadProgressSchema>;
export type AiStatus = z.infer<typeof aiStatusSchema>;
