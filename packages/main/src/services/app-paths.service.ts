import {app} from 'electron';
import {mkdir} from 'node:fs/promises';
import {join} from 'node:path';

export type AppDataPaths = {
  userDataDir: string;
  configDir: string;
  logsDir: string;
  tasksDir: string;
  keysDir: string;
  tempDir: string;
};

export function getAppDataPaths(): AppDataPaths {
  const userDataDir = app.getPath('userData');

  return {
    userDataDir,
    configDir: join(userDataDir, 'config'),
    logsDir: join(userDataDir, 'logs'),
    tasksDir: join(userDataDir, 'tasks'),
    keysDir: join(userDataDir, 'keys'),
    tempDir: join(userDataDir, 'temp'),
  };
}

export async function ensureAppDataDirs(): Promise<AppDataPaths> {
  const paths = getAppDataPaths();
  await Promise.all([
    mkdir(paths.configDir, {recursive: true}),
    mkdir(paths.logsDir, {recursive: true}),
    mkdir(paths.tasksDir, {recursive: true}),
    mkdir(paths.keysDir, {recursive: true}),
    mkdir(paths.tempDir, {recursive: true}),
  ]);
  return paths;
}
