import { createWriteStream } from 'node:fs';
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import type { BrowserWindow } from 'electron';
import {
  type AiDownloadProgress,
  type AiStatus,
  type DownloadTask,
  type InstalledModel,
  type ManifestModelEntry,
  type ModelState,
  modelStateSchema,
} from '@app/shared';
import {
  ensureAppStorageDirs,
  getAppStoragePaths,
  getModelGgufPath,
  getModelInstallDir,
} from '../app/app-paths.service.js';
import { sha256 } from '../crypto/crypto.service.js';
import { loadModelManifest, getRecommendedModel } from './model-manifest.service.js';
import {
  isLlamaRuntimeAvailable,
  isLlamaServerRunning,
  stopLlamaServer,
} from './llama-runtime.service.js';
import { logger } from '../app/log.service.js';

let downloadAbort: AbortController | null = null;
let progressSink: ((progress: AiDownloadProgress) => void) | null = null;

export function setAiDownloadProgressSink(
  sink: ((progress: AiDownloadProgress) => void) | null,
): void {
  progressSink = sink;
}

function emitProgress(progress: AiDownloadProgress): void {
  progressSink?.(progress);
}

async function readModelState(): Promise<ModelState> {
  const { modelStatePath } = getAppStoragePaths();
  try {
    const raw = await readFile(modelStatePath, 'utf8');
    return modelStateSchema.parse(JSON.parse(raw));
  } catch {
    return modelStateSchema.parse({});
  }
}

async function writeModelState(state: ModelState): Promise<void> {
  await ensureAppStorageDirs();
  const { modelStatePath } = getAppStoragePaths();
  await writeFile(modelStatePath, JSON.stringify(state, null, 2), 'utf8');
}

export async function getInstalledModel(modelId: string): Promise<InstalledModel | null> {
  const state = await readModelState();
  return state.installed.find((m) => m.id === modelId) ?? null;
}

export async function getActiveModel(): Promise<InstalledModel | null> {
  const state = await readModelState();
  if (!state.active_model_id) {
    return null;
  }
  return state.installed.find((m) => m.id === state.active_model_id) ?? null;
}

export async function getActiveModelGgufPath(): Promise<string | null> {
  const active = await getActiveModel();
  if (!active) {
    return null;
  }
  return active.path;
}

async function hashFile(path: string): Promise<string> {
  const buffer = await readFile(path);
  return sha256(buffer);
}

async function verifyModelFile(filePath: string, entry: ManifestModelEntry): Promise<void> {
  if (!entry.sha256) {
    logger().warn(`模型 ${entry.id} 未配置 sha256，跳过校验`);
    return;
  }
  const digest = await hashFile(filePath);
  if (digest !== entry.sha256.toLowerCase()) {
    throw new Error('模型文件 SHA256 校验失败');
  }
}

async function downloadWithResume(
  entry: ManifestModelEntry,
  partPath: string,
  signal: AbortSignal,
  onProgress: (bytesDone: number, total: number) => void,
): Promise<void> {
  let startAt = 0;
  try {
    const partStat = await stat(partPath);
    startAt = partStat.size;
  } catch {
    startAt = 0;
  }

  const headers: Record<string, string> = {};
  if (startAt > 0) {
    headers.Range = `bytes=${startAt}-`;
  }

  const res = await fetch(entry.download_url, { headers, signal, redirect: 'follow' });
  if (!res.ok && res.status !== 206) {
    if (startAt > 0 && res.status === 416) {
      await rm(partPath, { force: true });
      return downloadWithResume(entry, partPath, signal, onProgress);
    }
    throw new Error(`下载失败 HTTP ${res.status}`);
  }

  const contentRange = res.headers.get('content-range');
  const contentLength = res.headers.get('content-length');
  let totalBytes = entry.size_bytes;
  if (contentRange) {
    const m = /\/(\d+)$/.exec(contentRange);
    if (m) {
      totalBytes = Number(m[1]);
    }
  } else if (contentLength) {
    totalBytes = startAt + Number(contentLength);
  }

  const writeFlags = startAt > 0 ? { flags: 'a' as const } : undefined;
  await mkdir(dirname(partPath), { recursive: true });
  const fileStream = createWriteStream(partPath, writeFlags);
  const body = res.body;
  if (!body) {
    throw new Error('下载响应无内容');
  }

  let bytesDone = startAt;
  const reader = body.getReader();
  try {
    while (true) {
      if (signal.aborted) {
        await reader.cancel();
        throw new Error('下载已取消');
      }
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      if (signal.aborted) {
        await reader.cancel();
        throw new Error('下载已取消');
      }
      fileStream.write(value);
      bytesDone += value.length;
      onProgress(bytesDone, totalBytes);
    }
  } finally {
    if (!fileStream.destroyed) {
      fileStream.end();
      await new Promise<void>((resolve, reject) => {
        fileStream.on('finish', () => resolve());
        fileStream.on('error', reject);
      });
    }
  }

  if (bytesDone < totalBytes * 0.99) {
    throw new Error('下载未完成，请重试');
  }
}

export async function downloadRecommendedModel(): Promise<InstalledModel> {
  const manifest = await loadModelManifest();
  const entry = getRecommendedModel(manifest);
  if (!entry) {
    throw new Error('模型清单中没有推荐模型');
  }
  return downloadModel(entry.id, entry);
}

export async function downloadModel(
  modelId: string,
  entryOverride?: ManifestModelEntry,
): Promise<InstalledModel> {
  const manifest = await loadModelManifest();
  const entry = entryOverride ?? manifest.models.find((m) => m.id === modelId);
  if (!entry) {
    throw new Error(`未知模型: ${modelId}`);
  }

  if (downloadAbort) {
    downloadAbort.abort();
  }
  downloadAbort = new AbortController();
  const signal = downloadAbort.signal;

  await ensureAppStorageDirs();
  const { modelDownloadsDir } = getAppStoragePaths();
  const installDir = getModelInstallDir(entry.id);
  const partPath = join(modelDownloadsDir, `${entry.id}.part`);
  const finalPath = getModelGgufPath(entry.id, entry.file_name);

  let state = await readModelState();
  state = {
    ...state,
    download_task: {
      model_id: entry.id,
      status: 'downloading',
      bytes_done: 0,
      total_bytes: entry.size_bytes,
    },
  };
  await writeModelState(state);

  emitProgress({
    model_id: entry.id,
    bytes_done: 0,
    total_bytes: entry.size_bytes,
    status: 'downloading',
  });

  const report = (bytesDone: number, total: number, status: DownloadTask['status']) => {
    emitProgress({
      model_id: entry.id,
      bytes_done: bytesDone,
      total_bytes: total,
      status: status === 'verifying' ? 'verifying' : 'downloading',
    });
    void (async () => {
      const current = await readModelState();
      await writeModelState({
        ...current,
        download_task: {
          model_id: entry.id,
          status,
          bytes_done: bytesDone,
          total_bytes: total,
        },
      });
    })();
  };

  try {
    await downloadWithResume(entry, partPath, signal, (bytesDone, total) => {
      report(bytesDone, total, 'downloading');
    });

    if (signal.aborted) {
      throw new Error('下载已取消');
    }

    report(entry.size_bytes, entry.size_bytes, 'verifying');
    emitProgress({
      model_id: entry.id,
      bytes_done: entry.size_bytes,
      total_bytes: entry.size_bytes,
      status: 'verifying',
    });

    await mkdir(installDir, { recursive: true });
    const { rename } = await import('node:fs/promises');
    await rename(partPath, finalPath);

    if (signal.aborted) {
      await rm(finalPath, { force: true }).catch(() => undefined);
      throw new Error('下载已取消');
    }

    await verifyModelFile(finalPath, entry);

    const digest = entry.sha256 ?? (await hashFile(finalPath));
    const meta = {
      id: entry.id,
      name: entry.name,
      manifest_version: manifest.version,
      file_name: entry.file_name,
      size_bytes: entry.size_bytes,
      sha256: digest,
      installed_at: new Date().toISOString(),
    };
    await writeFile(join(installDir, 'model.json'), JSON.stringify(meta, null, 2), 'utf8');

    const installed: InstalledModel = {
      id: entry.id,
      name: entry.name,
      path: finalPath,
      file_name: entry.file_name,
      size_bytes: entry.size_bytes,
      sha256: digest,
      installed_at: meta.installed_at,
    };

    state = await readModelState();
    const others = state.installed.filter((m) => m.id !== entry.id);
    state = {
      ...state,
      active_model_id: entry.id,
      installed: [...others, installed],
      download_task: null,
    };
    await writeModelState(state);

    emitProgress({
      model_id: entry.id,
      bytes_done: entry.size_bytes,
      total_bytes: entry.size_bytes,
      status: 'completed',
    });

    logger().info(`Model installed: ${entry.id}`);
    return installed;
  } catch (error) {
    const cancelled = signal.aborted || (error instanceof Error && error.message.includes('取消'));
    state = await readModelState();
    if (cancelled) {
      const bytesDone = state.download_task?.bytes_done ?? 0;
      await writeModelState({ ...state, download_task: null });
      emitProgress({
        model_id: entry.id,
        bytes_done: bytesDone,
        total_bytes: entry.size_bytes,
        status: 'cancelled',
      });
      throw new Error('下载已取消');
    }
    const message = error instanceof Error ? error.message : '下载失败';
    state = {
      ...state,
      download_task: {
        model_id: entry.id,
        status: 'failed',
        bytes_done: state.download_task?.bytes_done ?? 0,
        total_bytes: entry.size_bytes,
        error_message: message,
      },
    };
    await writeModelState(state);
    emitProgress({
      model_id: entry.id,
      bytes_done: state.download_task?.bytes_done ?? 0,
      total_bytes: entry.size_bytes,
      status: 'failed',
      error_message: message,
    });
    throw error;
  } finally {
    downloadAbort = null;
  }
}

export async function cancelModelDownload(): Promise<void> {
  const state = await readModelState();
  const task = state.download_task;
  downloadAbort?.abort();
  downloadAbort = null;
  if (!task) {
    return;
  }
  await writeModelState({ ...state, download_task: null });
  emitProgress({
    model_id: task.model_id,
    bytes_done: task.bytes_done,
    total_bytes: task.total_bytes,
    status: 'cancelled',
  });
}

export async function setActiveModel(modelId: string): Promise<void> {
  const state = await readModelState();
  const target = state.installed.find((m) => m.id === modelId);
  if (!target) {
    throw new Error(`未安装模型: ${modelId}`);
  }
  if (state.active_model_id === modelId) {
    return;
  }
  await writeModelState({
    ...state,
    active_model_id: modelId,
  });
  await stopLlamaServer();
  logger().info(`Active model set: ${modelId}`);
}

export async function deleteInstalledModel(modelId?: string): Promise<void> {
  const state = await readModelState();
  const id = modelId ?? state.active_model_id;
  if (!id) {
    return;
  }
  await rm(getModelInstallDir(id), { recursive: true, force: true });
  const nextInstalled = state.installed.filter((m) => m.id !== id);
  await writeModelState({
    ...state,
    active_model_id: state.active_model_id === id ? null : state.active_model_id,
    installed: nextInstalled,
    download_task: state.download_task?.model_id === id ? null : state.download_task,
  });
}

export async function getAiStatus(): Promise<AiStatus> {
  let manifest = null;
  let manifestError: string | null = null;
  try {
    manifest = await loadModelManifest();
  } catch (error) {
    manifestError = error instanceof Error ? error.message : '模型清单加载失败';
    logger().error(manifestError);
  }
  const recommended = manifest ? getRecommendedModel(manifest) : null;
  const state = await readModelState();
  const active = state.active_model_id
    ? (state.installed.find((m) => m.id === state.active_model_id) ?? null)
    : null;

  return {
    runtime_available: await isLlamaRuntimeAvailable(),
    server_running: isLlamaServerRunning(),
    manifest_version: manifest?.version ?? null,
    active_model_id: state.active_model_id,
    active_model_name: active?.name ?? null,
    model_installed: state.installed.length > 0,
    installed_models: state.installed,
    download_task: state.download_task,
    recommended_model: recommended,
    available_models: manifest?.models ?? [],
    manifest_error: manifestError,
  };
}

export function broadcastAiDownloadProgress(
  windows: BrowserWindow[],
  progress: AiDownloadProgress,
): void {
  for (const win of windows) {
    if (!win.isDestroyed()) {
      win.webContents.send('ai:download-progress', progress);
    }
  }
}
