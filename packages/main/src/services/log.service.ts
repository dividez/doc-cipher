import log from 'electron-log/main';
import { mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { AppLogEntry } from '@app/shared';
import { getAppDataPaths } from './app-paths.service.js';

let configured = false;

export function configureLogger(): void {
  if (configured) {
    return;
  }

  const logDir = getAppDataPaths().logsDir;
  log.transports.file.resolvePathFn = () => join(logDir, 'app.log');
  log.transports.file.level = 'info';
  log.transports.console.level = import.meta.env.DEV ? 'debug' : 'warn';
  configured = true;
}

export function logger() {
  configureLogger();
  return log;
}

export async function readAppLogs(): Promise<AppLogEntry[]> {
  configureLogger();
  const logDir = getAppDataPaths().logsDir;
  const logPath = join(logDir, 'app.log');
  await mkdir(logDir, { recursive: true });

  try {
    const content = await readFile(logPath, 'utf8');
    return content
      .trim()
      .split('\n')
      .filter(Boolean)
      .slice(-200)
      .map((line) => {
        const match = line.match(/^\[?([^\]]+)\]?\s+\[?([^\]]+)\]?\s+(.*)$/);
        return {
          timestamp: match?.[1] ?? '',
          level: match?.[2] ?? 'info',
          message: match?.[3] ?? line,
        };
      });
  } catch {
    return [];
  }
}
