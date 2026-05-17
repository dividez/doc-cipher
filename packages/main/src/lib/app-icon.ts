import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { app } from 'electron';

/** 与 electron-builder 的 buildResources 目录一致 */
const BUILD_RESOURCES_ICON_PATHS = [
  'buildResources/icon.png',
  'buildResources/macos/AppIcon512.png',
  'buildResources/macos/AppIcon256.png',
];

/** 打包后 Resources 内的应用图标（由 buildResources/icon.png 生成） */
const PACKAGED_ICON_PATHS = ['icon.icns', 'icon.png'];

function firstExistingPath(paths: string[]): string | undefined {
  for (const candidate of paths) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  return undefined;
}

export function resolveAppIconPath(): string | undefined {
  const candidates: string[] = [];

  if (app.isPackaged) {
    for (const name of PACKAGED_ICON_PATHS) {
      candidates.push(join(process.resourcesPath, name));
    }
  }

  const roots = app.isPackaged
    ? [process.resourcesPath, join(process.resourcesPath, '..'), app.getAppPath()]
    : [process.cwd(), app.getAppPath()];

  for (const root of roots) {
    for (const relativePath of BUILD_RESOURCES_ICON_PATHS) {
      candidates.push(join(root, relativePath));
    }
  }

  return firstExistingPath(candidates);
}
