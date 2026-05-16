import type {AppModule} from '../AppModule.js';
import type {ModuleContext} from '../ModuleContext.js';
import {dialog, ipcMain, shell} from 'electron';
import {settingsSchema, type MaskDocxPayload, type RestoreDocxPayload} from '@app/shared';
import {maskDocx} from '../services/docx-mask.service.js';
import {restoreDocx} from '../services/docx-restore.service.js';
import {readSettings, saveSettings} from '../services/settings.service.js';
import {configureLogger, logger, readAppLogs} from '../services/log.service.js';

class IpcModule implements AppModule {
  async enable({app}: ModuleContext): Promise<void> {
    await app.whenReady();
    configureLogger();

    ipcMain.handle('file:select-docx', async () => {
      const result = await dialog.showOpenDialog({
        title: '选择 Word 文档',
        properties: ['openFile'],
        filters: [
          {name: 'Word docx', extensions: ['docx']},
        ],
      });

      return result.canceled ? null : result.filePaths[0] ?? null;
    });

    ipcMain.handle('file:select-restore-file', async () => {
      const result = await dialog.showOpenDialog({
        title: '选择加密还原文件',
        properties: ['openFile'],
        filters: [
          {name: 'DocCipher restore file', extensions: ['enc']},
        ],
      });

      return result.canceled ? null : result.filePaths[0] ?? null;
    });

    ipcMain.handle('file:select-output-dir', async () => {
      const result = await dialog.showOpenDialog({
        title: '选择输出目录',
        properties: ['openDirectory', 'createDirectory'],
      });

      return result.canceled ? null : result.filePaths[0] ?? null;
    });

    ipcMain.handle('settings:read', async () => await readSettings());

    ipcMain.handle('settings:save', async (_, payload) => {
      const settings = settingsSchema.parse(payload);
      logger().info('Settings saved');
      return await saveSettings(settings);
    });

    ipcMain.handle('docx:mask', async (_, payload: MaskDocxPayload) => {
      const settings = payload.settings ? settingsSchema.parse(payload.settings) : await readSettings();
      return await maskDocx({...payload, settings});
    });

    ipcMain.handle('docx:restore', async (_, payload: RestoreDocxPayload) => await restoreDocx(payload));
    ipcMain.handle('logs:read', async () => await readAppLogs());

    ipcMain.handle('shell:show-item-in-folder', async (_, filePath: string) => {
      shell.showItemInFolder(filePath);
    });
  }
}

export function createIpcModule() {
  return new IpcModule();
}
