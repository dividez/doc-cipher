import type { AppModule } from '../AppModule.js';
import type { ModuleContext } from '../ModuleContext.js';
import { copyFile, readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, join } from 'node:path';
import { dialog, ipcMain, shell } from 'electron';
import {
  settingsSchema,
  type DocxMatchPreviewPayload,
  type DocxPreviewPayload,
  type MaskDocxPayload,
  type RestoreDocxPayload,
} from '@app/shared';
import { maskDocx } from '../services/docx-mask.service.js';
import { previewDocxMatches } from '../services/docx-match-preview.service.js';
import { previewDocx } from '../services/docx-preview.service.js';
import {
  deleteMaskProfile,
  getMaskProfile,
  importMaskProfile,
  listMaskProfiles,
  saveMaskProfile,
} from '../services/profile.service.js';
import { restoreDocx } from '../services/docx-restore.service.js';
import { readSettings, saveSettings } from '../services/settings.service.js';
import { configureLogger, logger, readAppLogs } from '../services/log.service.js';
import { listTaskHistory } from '../services/task.service.js';

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
      'docx:preview',
      async (_, payload: DocxPreviewPayload) => await previewDocx(payload),
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
  }
}

export function createIpcModule() {
  return new IpcModule();
}
