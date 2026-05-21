import { app } from 'electron';
import { access } from 'node:fs/promises';
import { spawn, type ChildProcess } from 'node:child_process';
import { join } from 'node:path';
import { getAppStoragePaths } from '../app/app-paths.service.js';
import { resolveBuildResourcesPath } from '../app/build-resources-paths.service.js';
import { logger } from '../app/log.service.js';

const DEFAULT_PORT = 17_389;
const START_TIMEOUT_MS = 120_000;

type RuntimePlatformKey = 'darwin-arm64' | 'darwin-x64' | 'win32-x64';

let serverProcess: ChildProcess | null = null;
let serverPort = DEFAULT_PORT;
let loadedModelPath: string | null = null;
let startingPromise: Promise<void> | null = null;

function getRuntimePlatformKey(): RuntimePlatformKey | null {
  if (process.platform === 'darwin') {
    return process.arch === 'arm64' ? 'darwin-arm64' : 'darwin-x64';
  }
  if (process.platform === 'win32' && process.arch === 'x64') {
    return 'win32-x64';
  }
  return null;
}

export function isLlamaRuntimeSupported(): boolean {
  return getRuntimePlatformKey() !== null;
}

function getBundledRuntimeDir(): string {
  return join(process.resourcesPath, 'llama-runtime');
}

export async function resolveLlamaServerPath(): Promise<string | null> {
  const key = getRuntimePlatformKey();
  if (!key) {
    return null;
  }

  const binaryName = process.platform === 'win32' ? 'llama-server.exe' : 'llama-server';
  const candidates = [
    join(getBundledRuntimeDir(), key, binaryName),
    await resolveBuildResourcesPath('llama-runtime', key, binaryName),
  ].filter((item): item is string => Boolean(item));

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

export async function isLlamaRuntimeAvailable(): Promise<boolean> {
  return (await resolveLlamaServerPath()) !== null;
}

export function getLlamaServerBaseUrl(): string {
  return `http://127.0.0.1:${serverPort}`;
}

export function isLlamaServerRunning(): boolean {
  return serverProcess !== null && !serverProcess.killed;
}

async function waitForHealth(baseUrl: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${baseUrl}/health`, { signal: AbortSignal.timeout(2000) });
      if (res.ok) {
        return;
      }
    } catch {
      // retry
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error('llama-server 启动超时');
}

function killServer(): void {
  if (!serverProcess) {
    return;
  }
  serverProcess.kill('SIGTERM');
  serverProcess = null;
  loadedModelPath = null;
}

export async function stopLlamaServer(): Promise<void> {
  killServer();
}

export async function ensureLlamaServer(modelPath: string): Promise<string> {
  if (
    isLlamaServerRunning() &&
    loadedModelPath === modelPath &&
    serverProcess &&
    !serverProcess.killed
  ) {
    return getLlamaServerBaseUrl();
  }

  if (startingPromise) {
    await startingPromise;
    if (loadedModelPath === modelPath && isLlamaServerRunning()) {
      return getLlamaServerBaseUrl();
    }
  }

  startingPromise = (async () => {
    killServer();
    const binary = await resolveLlamaServerPath();
    if (!binary) {
      throw new Error('未找到内置 llama.cpp 运行时，请重新安装客户端或使用支持的平台');
    }

    const { tempDir } = getAppStoragePaths();
    serverPort = DEFAULT_PORT;

    serverProcess = spawn(
      binary,
      [
        '--model',
        modelPath,
        '--host',
        '127.0.0.1',
        '--port',
        String(serverPort),
        '--ctx-size',
        '4096',
        '--parallel',
        '1',
      ],
      {
        cwd: tempDir,
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
      },
    );

    serverProcess.on('exit', (code, signal) => {
      logger().warn(`llama-server exited code=${code} signal=${signal}`);
      serverProcess = null;
      loadedModelPath = null;
    });

    serverProcess.stderr?.on('data', (chunk: Buffer) => {
      logger().warn(`llama-server: ${chunk.toString('utf8').trim()}`);
    });

    const baseUrl = getLlamaServerBaseUrl();
    await waitForHealth(baseUrl, START_TIMEOUT_MS);
    loadedModelPath = modelPath;
    logger().info(`llama-server ready at ${baseUrl}`);
  })();

  try {
    await startingPromise;
    return getLlamaServerBaseUrl();
  } finally {
    startingPromise = null;
  }
}

app.on('will-quit', () => {
  killServer();
});
