import { readFile } from 'node:fs/promises';
import { modelManifestSchema, type ModelManifest } from '@app/shared';
import { resolveBuildResourcesPath } from '../app/build-resources-paths.service.js';
import { logger } from '../app/log.service.js';

let cachedManifest: ModelManifest | null = null;

async function readBundledManifest(): Promise<ModelManifest> {
  const manifestPath = await resolveBuildResourcesPath('default-model-manifest.json');
  if (!manifestPath) {
    throw new Error(
      '未找到内置模型清单 buildResources/default-model-manifest.json（请确认仓库根目录存在该文件）',
    );
  }
  const raw = await readFile(manifestPath, 'utf8');
  return modelManifestSchema.parse(JSON.parse(raw));
}

/** 加载内置本地模型清单。 */
export async function loadModelManifest(force = false): Promise<ModelManifest> {
  if (!force && cachedManifest) {
    return cachedManifest;
  }
  cachedManifest = await readBundledManifest();
  logger().info('manifest loaded from bundled default-model-manifest.json');
  return cachedManifest;
}

/** @deprecated 使用 loadModelManifest */
export const fetchModelManifest = loadModelManifest;

export function getRecommendedModel(manifest: ModelManifest) {
  return manifest.models.find((m) => m.recommended) ?? manifest.models[0] ?? null;
}

export function clearManifestCache(): void {
  cachedManifest = null;
}
