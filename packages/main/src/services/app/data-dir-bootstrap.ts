import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { app } from 'electron';

const BOOTSTRAP_FILE = 'bootstrap.json';

export type BootstrapConfig = {
  userDataDir?: string;
};

export function getAppDataDir(): string {
  return app.getPath('userData');
}

export function getBootstrapPath(): string {
  return join(getAppDataDir(), BOOTSTRAP_FILE);
}

export function getDefaultUserDataDir(): string {
  return join(getAppDataDir(), 'user-data');
}

export function readBootstrapConfig(): BootstrapConfig {
  const bootstrapPath = getBootstrapPath();
  if (!existsSync(bootstrapPath)) {
    return {};
  }

  try {
    const raw = JSON.parse(readFileSync(bootstrapPath, 'utf8')) as BootstrapConfig;
    if (typeof raw.userDataDir === 'string' && raw.userDataDir.trim()) {
      return { userDataDir: raw.userDataDir.trim() };
    }
    return {};
  } catch {
    return {};
  }
}

export function resolveBootstrapUserDataDir(): string {
  const configured = readBootstrapConfig().userDataDir;
  if (configured && existsSync(configured)) {
    return configured;
  }
  return getDefaultUserDataDir();
}

export function isCustomUserDataDir(userDataDir: string): boolean {
  return userDataDir !== getDefaultUserDataDir();
}

export function writeBootstrapUserDataDir(dir: string): void {
  mkdirSync(getAppDataDir(), { recursive: true });
  const bootstrapPath = getBootstrapPath();
  writeFileSync(
    bootstrapPath,
    JSON.stringify({ userDataDir: dir } satisfies BootstrapConfig, null, 2),
    'utf8',
  );
}

export function clearBootstrapUserDataDir(): void {
  const bootstrapPath = getBootstrapPath();
  if (existsSync(bootstrapPath)) {
    rmSync(bootstrapPath, { force: true });
  }
}
