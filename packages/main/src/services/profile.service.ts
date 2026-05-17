import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { maskProfileSchema, settingsSchema, type MaskProfile, type Settings } from '@app/shared';
import { createProfileId } from '../lib/profile-id.js';
import { getAppDataPaths } from './app-paths.service.js';

type SaveProfilePayload = {
  id?: string;
  name: string;
  settings: Settings;
};

function profilesDir(): string {
  return join(getAppDataPaths().configDir, 'mask-profiles');
}

function profilePath(id: string): string {
  return join(profilesDir(), `${id}.json`);
}

export async function listMaskProfiles(): Promise<MaskProfile[]> {
  const dir = profilesDir();
  await mkdir(dir, { recursive: true });

  const files = await readdir(dir);
  const profiles = await Promise.all(
    files
      .filter((file) => file.endsWith('.json'))
      .map(async (file) => {
        try {
          const content = await readFile(join(dir, file), 'utf8');
          return maskProfileSchema.parse(JSON.parse(content));
        } catch {
          return null;
        }
      }),
  );

  return profiles
    .filter((profile): profile is MaskProfile => profile !== null)
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
}

export async function saveMaskProfile(payload: SaveProfilePayload): Promise<MaskProfile> {
  const now = new Date().toISOString();
  const id = payload.id ?? createProfileId();
  const existing = await readMaskProfile(id);
  const profile = maskProfileSchema.parse({
    id,
    name: payload.name,
    created_at: existing?.created_at ?? now,
    updated_at: now,
    settings: settingsSchema.parse(payload.settings),
  });

  await mkdir(profilesDir(), { recursive: true });
  await writeFile(profilePath(id), JSON.stringify(profile, null, 2), 'utf8');
  return profile;
}

export async function getMaskProfile(id: string): Promise<MaskProfile | null> {
  return await readMaskProfile(id);
}

export async function importMaskProfile(profile: unknown): Promise<MaskProfile> {
  const parsed = maskProfileSchema.parse(profile);
  return await saveMaskProfile({
    name: parsed.name,
    settings: parsed.settings,
  });
}

export async function deleteMaskProfile(id: string): Promise<void> {
  await rm(profilePath(id), { force: true });
}

async function readMaskProfile(id: string): Promise<MaskProfile | null> {
  try {
    const content = await readFile(profilePath(id), 'utf8');
    return maskProfileSchema.parse(JSON.parse(content));
  } catch {
    return null;
  }
}
