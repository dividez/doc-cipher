import { app } from 'electron';
import { access } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * 解析 buildResources 下资源路径。开发时 Electron cwd 通常为仓库根目录。
 */
export async function resolveBuildResourcesPath(...segments: string[]): Promise<string | null> {
  const fromModule = fileURLToPath(
    new URL(`../../../../buildResources/${segments.join('/')}`, import.meta.url),
  );
  const candidates = [
    join(process.resourcesPath, ...segments),
    join(process.cwd(), 'buildResources', ...segments),
    join(app.getAppPath(), 'buildResources', ...segments),
    join(app.getAppPath(), '..', '..', 'buildResources', ...segments),
    fromModule,
  ];

  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // try next
    }
  }

  return null;
}
