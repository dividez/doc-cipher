import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { app } from 'electron';

const ICON_RELATIVE_PATHS = ['buildResources/icon.png', 'icon.png'];

export function resolveAppIconPath(): string | undefined {
  const roots = app.isPackaged
    ? [process.resourcesPath, join(process.resourcesPath, '..')]
    : [process.cwd()];

  for (const root of roots) {
    for (const relativePath of ICON_RELATIVE_PATHS) {
      const candidate = join(root, relativePath);
      if (existsSync(candidate)) {
        return candidate;
      }
    }
  }

  return undefined;
}
