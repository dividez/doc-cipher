import type { AppModule } from '../AppModule.js';
import type { ModuleContext } from '../ModuleContext.js';
import { access, constants } from 'node:fs/promises';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, join } from 'node:path';
import { BrowserWindow, dialog, ipcMain, shell } from 'electron';
import { getAppStoragePathsInfo } from '../services/app/app-paths.service.js';
import {
  clearBootstrapUserDataDir,
  getDefaultUserDataDir,
  writeBootstrapUserDataDir,
} from '../services/app/data-dir-bootstrap.js';
import {
  settingsSchema,
  type AiDetectPayload,
  type AiDownloadProgress,
  type AiInferenceEstimatePayload,
  type DocxReadFilePayload,
  type DocxRecognizeMatchesPayload,
  type MaskDocxPayload,
  type RestoreDocxPayload,
  isLocalAiBundled,
} from '@app/shared';
import { maskDocx } from '../services/docx/docx-mask.service.js';
import { recognizeDocxMatches } from '../services/docx/docx-recognize-matches.service.js';
import { readDocxFile } from '../services/docx/docx-read-file.service.js';
import {
  deleteMaskProfile,
  getMaskProfile,
  importMaskProfile,
  listMaskProfiles,
  saveMaskProfile,
} from '../services/profile/profile.service.js';
import { restoreDocx } from '../services/docx/docx-restore.service.js';
import { readSettings, saveSettings } from '../services/settings/settings.service.js';
import { configureLogger, logger, readAppLogs } from '../services/app/log.service.js';
import { listTaskHistory } from '../services/task/task.service.js';
import { detectSensitiveEntitiesWithSlidingWindow } from '../services/ai/ai-detect.service.js';
import { estimateDocxInference } from '../services/ai/ai-estimate.service.js';
import {
  broadcastAiMaskProgress,
  broadcastAiRecognizeLog,
  cancelMaskTask,
  setAiMaskProgressSink,
  setAiRecognizeLogSink,
} from '../services/ai/ai-mask-task.service.js';
import { loadModelManifest } from '../services/ai/model-manifest.service.js';
import {
  broadcastAiDownloadProgress,
  cancelModelDownload,
  deleteInstalledModel,
  downloadModel,
  downloadRecommendedModel,
  getAiStatus,
  setActiveModel,
  setAiDownloadProgressSink,
} from '../services/ai/model-manager.service.js';

const LOCAL_AI_UNAVAILABLE = '本版本不支持本地 AI';

function requireLocalAiBundled(): void {
  if (!isLocalAiBundled()) {
    throw new Error(LOCAL_AI_UNAVAILABLE);
  }
}

class IpcModule implements AppModule {
  async enable({ app }: ModuleContext): Promise<void> {
    await app.whenReady();
    configureLogger();

    ipcMain.handle('app:ping', async () => {
      console.log('[main] received ping');
      return {
        message: 'pong',
        time: new Date().toISOString(),
      };
    });

    ipcMain.handle('app:get-storage-paths', async () => getAppStoragePathsInfo());

    ipcMain.handle('app:open-app-data-dir', async () => {
      const { appDataDir } = getAppStoragePathsInfo();
      await shell.openPath(appDataDir);
    });

    ipcMain.handle('app:open-user-data-dir', async () => {
      const { userDataDir } = getAppStoragePathsInfo();
      await shell.openPath(userDataDir);
    });

    ipcMain.handle('app:open-external-url', async (_, rawUrl: string) => {
      let parsed: URL;
      try {
        parsed = new URL(rawUrl);
      } catch {
        throw new Error('无效的链接');
      }
      if (parsed.protocol !== 'https:') {
        throw new Error('仅支持 https 链接');
      }
      const allowedHosts = new Set(['github.com', 'www.github.com', 'pdf24.org', 'www.pdf24.org']);
      const host = parsed.hostname.toLowerCase();
      if (!allowedHosts.has(host)) {
        throw new Error('不支持的链接域名');
      }
      await shell.openExternal(parsed.toString());
    });

    ipcMain.handle('app:pick-user-data-dir', async () => {
      const result = await dialog.showOpenDialog({
        title: '选择用户数据目录',
        properties: ['openDirectory', 'createDirectory'],
      });
      if (result.canceled || !result.filePaths[0]) {
        return null;
      }

      const pickedDir = result.filePaths[0];
      await access(pickedDir, constants.W_OK);
      await mkdir(pickedDir, { recursive: true });
      writeBootstrapUserDataDir(pickedDir);

      return {
        path: pickedDir,
        needsRestart: true,
      };
    });

    ipcMain.handle('app:reset-user-data-dir', async () => {
      clearBootstrapUserDataDir();
      return {
        path: getDefaultUserDataDir(),
        needsRestart: true,
      };
    });

    ipcMain.handle('app:relaunch', async () => {
      app.relaunch();
      app.exit(0);
    });

    ipcMain.handle('docx:smoke-mask', async (_, payload: { filePath: string }) => {
      const { filePath } = payload;
      const dir = dirname(filePath);
      const ext = extname(filePath);
      const base = basename(filePath, ext);
      const outputPath = join(dir, `${base}.masked${ext}`);
      await copyFile(filePath, outputPath);
      console.log('[main] smoke masked file:', outputPath);
      return {
        success: true,
        outputPath,
      };
    });

    ipcMain.handle('file:select-docx', async () => {
      const result = await dialog.showOpenDialog({
        title: '选择 Word 文档',
        properties: ['openFile'],
        filters: [{ name: 'Word docx', extensions: ['docx'] }],
      });

      return result.canceled ? null : (result.filePaths[0] ?? null);
    });

    ipcMain.handle('file:select-restore-file', async () => {
      const result = await dialog.showOpenDialog({
        title: '选择加密还原文件',
        properties: ['openFile'],
        filters: [{ name: 'DocCipher restore file', extensions: ['enc'] }],
      });

      return result.canceled ? null : (result.filePaths[0] ?? null);
    });

    ipcMain.handle('file:select-output-dir', async () => {
      const result = await dialog.showOpenDialog({
        title: '选择输出目录',
        properties: ['openDirectory', 'createDirectory'],
      });

      return result.canceled ? null : (result.filePaths[0] ?? null);
    });

    ipcMain.handle('settings:read', async () => await readSettings());

    ipcMain.handle('settings:save', async (_, payload) => {
      const settings = settingsSchema.parse(payload);
      logger().info('Settings saved');
      return await saveSettings(settings);
    });

    ipcMain.handle('profiles:list', async () => await listMaskProfiles());

    ipcMain.handle('profiles:save', async (_, payload) => {
      logger().info('Mask profile saved');
      return await saveMaskProfile(payload);
    });

    ipcMain.handle('profiles:delete', async (_, id: string) => {
      await deleteMaskProfile(id);
      logger().info(`Mask profile deleted: ${id}`);
    });

    ipcMain.handle('profiles:export', async (_, id: string) => {
      const profile = await getMaskProfile(id);
      if (!profile) {
        throw new Error('方案不存在');
      }
      const result = await dialog.showSaveDialog({
        title: '导出脱敏方案',
        defaultPath: `${profile.name}.doccipher-profile.json`,
        filters: [{ name: 'DocCipher profile', extensions: ['json'] }],
      });
      if (result.canceled || !result.filePath) {
        return null;
      }
      await writeFile(result.filePath, JSON.stringify(profile, null, 2), 'utf8');
      logger().info(`Mask profile exported: ${id}`);
      return result.filePath;
    });

    ipcMain.handle('profiles:import', async () => {
      const result = await dialog.showOpenDialog({
        title: '导入脱敏方案',
        properties: ['openFile'],
        filters: [{ name: 'DocCipher profile', extensions: ['json'] }],
      });
      if (result.canceled || !result.filePaths[0]) {
        return null;
      }
      const content = await readFile(result.filePaths[0], 'utf8');
      const imported = await importMaskProfile(JSON.parse(content));
      logger().info(`Mask profile imported: ${imported.id}`);
      return imported;
    });

    ipcMain.handle(
      'docx:read-file',
      async (_, payload: DocxReadFilePayload) => await readDocxFile(payload),
    );

    ipcMain.handle(
      'docx:recognize-matches',
      async (_, payload: DocxRecognizeMatchesPayload) => await recognizeDocxMatches(payload),
    );

    ipcMain.handle('tasks:list-history', async (_, limit?: number) => await listTaskHistory(limit));

    ipcMain.handle('docx:mask', async (_, payload: MaskDocxPayload) => {
      const settings = payload.settings
        ? settingsSchema.parse(payload.settings)
        : await readSettings();
      return await maskDocx({ ...payload, settings });
    });

    ipcMain.handle(
      'docx:restore',
      async (_, payload: RestoreDocxPayload) => await restoreDocx(payload),
    );
    ipcMain.handle('logs:read', async () => await readAppLogs());

    ipcMain.handle('shell:show-item-in-folder', async (_, filePath: string) => {
      shell.showItemInFolder(filePath);
    });

    setAiDownloadProgressSink((progress: AiDownloadProgress) => {
      broadcastAiDownloadProgress(BrowserWindow.getAllWindows(), progress);
    });

    setAiMaskProgressSink((progress) => {
      broadcastAiMaskProgress(BrowserWindow.getAllWindows(), progress);
    });

    setAiRecognizeLogSink((event) => {
      broadcastAiRecognizeLog(BrowserWindow.getAllWindows(), event);
    });

    ipcMain.handle('ai:get-status', async () => await getAiStatus());

    ipcMain.handle('ai:fetch-manifest', async () => {
      requireLocalAiBundled();
      return await loadModelManifest(true);
    });

    ipcMain.handle('ai:download-model', async (_, modelId?: string) => {
      requireLocalAiBundled();
      if (modelId) {
        const manifest = await loadModelManifest();
        const entry = manifest.models.find((m) => m.id === modelId);
        if (!entry) {
          throw new Error(`未知模型: ${modelId}`);
        }
        return await downloadModel(modelId, entry);
      }
      return await downloadRecommendedModel();
    });

    ipcMain.handle('ai:cancel-download', async () => {
      requireLocalAiBundled();
      await cancelModelDownload();
    });

    ipcMain.handle('ai:delete-model', async (_, modelId?: string) => {
      requireLocalAiBundled();
      await deleteInstalledModel(modelId);
    });

    ipcMain.handle('ai:set-active-model', async (_, modelId: string) => {
      requireLocalAiBundled();
      await setActiveModel(modelId);
    });

    ipcMain.handle('ai:detect-sensitive', async (_, payload: AiDetectPayload) => {
      requireLocalAiBundled();
      return await detectSensitiveEntitiesWithSlidingWindow(payload.text);
    });

    ipcMain.handle('ai:estimate-inference', async (_, payload: AiInferenceEstimatePayload) => {
      requireLocalAiBundled();
      return await estimateDocxInference(payload.filePath);
    });

    ipcMain.handle('ai:cancel-mask', async () => {
      requireLocalAiBundled();
      await cancelMaskTask();
    });
  }
}

export function createIpcModule() {
  return new IpcModule();
}
