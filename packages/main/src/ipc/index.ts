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
  type DocxMatchPreviewPayload,
  type DocxReadFilePayload,
  type MaskDocxPayload,
  type RestoreDocxPayload,
} from '@app/shared';
import { maskDocx } from '../services/docx/docx-mask.service.js';
import { previewDocxMatches } from '../services/docx/docx-match-preview.service.js';
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
import { detectSensitiveEntities } from '../services/ai/ai-detect.service.js';
import { loadModelManifest } from '../services/ai/model-manifest.service.js';
import {
  broadcastAiDownloadProgress,
  cancelModelDownload,
  deleteInstalledModel,
  downloadModel,
  downloadRecommendedModel,
  getAiStatus,
  setAiDownloadProgressSink,
} from '../services/ai/model-manager.service.js';

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
      'docx:preview-matches',
      async (_, payload: DocxMatchPreviewPayload) => await previewDocxMatches(payload),
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

    ipcMain.handle('ai:get-status', async () => await getAiStatus());

    ipcMain.handle('ai:fetch-manifest', async () => await loadModelManifest(true));

    ipcMain.handle('ai:download-model', async (_, modelId?: string) => {
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
      await cancelModelDownload();
    });

    ipcMain.handle('ai:delete-model', async (_, modelId?: string) => {
      await deleteInstalledModel(modelId);
    });

    ipcMain.handle('ai:detect-sensitive', async (_, payload: AiDetectPayload) => {
      return await detectSensitiveEntities(payload.text);
    });
  }
}

export function createIpcModule() {
  return new IpcModule();
}
