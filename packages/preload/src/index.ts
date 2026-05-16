import {ipcRenderer} from 'electron';
import type {
  AppLogEntry,
  MaskDocxPayload,
  MaskDocxResult,
  RestoreDocxPayload,
  RestoreDocxResult,
  Settings,
} from '@app/shared';

function invoke<T>(channel: string, payload?: unknown): Promise<T> {
  return ipcRenderer.invoke(channel, payload) as Promise<T>;
}

export const localApi = {
  selectDocx: () => invoke<string | null>('file:select-docx'),
  selectRestoreFile: () => invoke<string | null>('file:select-restore-file'),
  selectOutputDir: () => invoke<string | null>('file:select-output-dir'),
  maskDocx: (payload: MaskDocxPayload) => invoke<MaskDocxResult>('docx:mask', payload),
  restoreDocx: (payload: RestoreDocxPayload) => invoke<RestoreDocxResult>('docx:restore', payload),
  readSettings: () => invoke<Settings>('settings:read'),
  saveSettings: (payload: Settings) => invoke<Settings>('settings:save', payload),
  readLogs: () => invoke<AppLogEntry[]>('logs:read'),
};
