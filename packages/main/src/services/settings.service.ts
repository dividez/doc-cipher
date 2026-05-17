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
    return normalizeSettings(JSON.parse(content));
  } catch {
    await saveSettings(defaultSettings);
    return defaultSettings;
  }
}

function normalizeSettings(raw: unknown): Settings {
  const source = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
  return settingsSchema.parse({
    ...defaultSettings,
    ...source,
    app: {
      ...defaultSettings.app,
      ...(typeof source.app === 'object' && source.app !== null
        ? (source.app as Record<string, unknown>)
        : {}),
    },
    masking: {
      ...defaultSettings.masking,
      ...(typeof source.masking === 'object' && source.masking !== null
        ? (source.masking as Record<string, unknown>)
        : {}),
    },
    rules: Array.isArray(source.rules) ? source.rules : defaultSettings.rules,
  });
}

export async function saveSettings(settings: Settings): Promise<Settings> {
  const parsed = settingsSchema.parse(settings);
  const path = settingsPath();
  await mkdir(join(path, '..'), { recursive: true });
  await writeFile(path, JSON.stringify(parsed, null, 2), 'utf8');
  return parsed;
}
