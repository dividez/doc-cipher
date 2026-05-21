import { app } from 'electron';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import {
  getDefaultUserDataDir,
  isCustomUserDataDir,
  resolveBootstrapUserDataDir,
} from './data-dir-bootstrap.js';

export type AppStoragePaths = {
  appDataDir: string;
  appConfigDir: string;
  userDataDir: string;
  docCipherDir: string;
  modelsDir: string;
  modelDownloadsDir: string;
  modelStatePath: string;
  profilesDir: string;
  tasksDir: string;
  logsDir: string;
  keysDir: string;
  tempDir: string;
};

export type AppStoragePathsInfo = AppStoragePaths & {
  defaultUserDataDir: string;
  isCustomUserDataDir: boolean;
};

export function getAppStoragePaths(): AppStoragePaths {
  const appDataDir = app.getPath('userData');
  const userDataDir = resolveBootstrapUserDataDir();
  const docCipherDir = join(userDataDir, 'doc-cipher');

  return {
    appDataDir,
    appConfigDir: join(appDataDir, 'config'),
    userDataDir,
    docCipherDir,
    modelsDir: join(docCipherDir, 'models'),
    modelDownloadsDir: join(docCipherDir, 'downloads'),
    modelStatePath: join(docCipherDir, 'model-state.json'),
    profilesDir: join(userDataDir, 'profiles'),
    tasksDir: join(userDataDir, 'tasks'),
    logsDir: join(userDataDir, 'logs'),
    keysDir: join(userDataDir, 'keys'),
    tempDir: join(userDataDir, 'temp'),
  };
}

export function getModelInstallDir(modelId: string): string {
  return join(getAppStoragePaths().modelsDir, modelId);
}

export function getModelGgufPath(modelId: string, fileName = 'model.gguf'): string {
  return join(getModelInstallDir(modelId), fileName);
}

export function getAppStoragePathsInfo(): AppStoragePathsInfo {
  const paths = getAppStoragePaths();

  return {
    ...paths,
    defaultUserDataDir: getDefaultUserDataDir(),
    isCustomUserDataDir: isCustomUserDataDir(paths.userDataDir),
  };
}

export async function ensureAppStorageDirs(): Promise<AppStoragePaths> {
  const paths = getAppStoragePaths();
  await Promise.all([
    mkdir(paths.appConfigDir, { recursive: true }),
    mkdir(paths.docCipherDir, { recursive: true }),
    mkdir(paths.modelsDir, { recursive: true }),
    mkdir(paths.modelDownloadsDir, { recursive: true }),
    mkdir(paths.profilesDir, { recursive: true }),
    mkdir(paths.logsDir, { recursive: true }),
    mkdir(paths.tasksDir, { recursive: true }),
    mkdir(paths.keysDir, { recursive: true }),
    mkdir(paths.tempDir, { recursive: true }),
  ]);
  return paths;
}

/** @deprecated Use getAppStoragePaths */
export function getAppDataPaths(): AppStoragePaths {
  return getAppStoragePaths();
}

/** @deprecated Use ensureAppStorageDirs */
export async function ensureAppDataDirs(): Promise<AppStoragePaths> {
  return ensureAppStorageDirs();
}
