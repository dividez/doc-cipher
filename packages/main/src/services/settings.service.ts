import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { defaultSettings, settingsSchema, type Settings } from '@app/shared';
import { getAppDataPaths } from './app-paths.service.js';

function settingsPath(): string {
  return join(getAppDataPaths().configDir, 'setting.json');
}

export async function readSettings(): Promise<Settings> {
  const path = settingsPath();

  try {
    const content = await readFile(path, 'utf8');
    return settingsSchema.parse(JSON.parse(content));
  } catch {
    await saveSettings(defaultSettings);
    return defaultSettings;
  }
}

export async function saveSettings(settings: Settings): Promise<Settings> {
  const parsed = settingsSchema.parse(settings);
  const path = settingsPath();
  await mkdir(join(path, '..'), { recursive: true });
  await writeFile(path, JSON.stringify(parsed, null, 2), 'utf8');
  return parsed;
}
