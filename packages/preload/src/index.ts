import type {
  AppLogEntry,
  DocxMatchPreviewPayload,
  DocxMatchPreviewResult,
  DocxPreviewPayload,
  DocxPreviewResult,
  MaskProfile,
  MaskDocxPayload,
  MaskDocxResult,
  RestoreDocxPayload,
  RestoreDocxResult,
  Settings,
  TaskHistoryEntry,
} from '@app/shared';

const { ipcRenderer } = require('electron') as typeof import('electron');

function invoke<T>(channel: string, payload?: unknown): Promise<T> {
  return ipcRenderer.invoke(channel, payload) as Promise<T>;
}

export const localApi = {
  ping: () => invoke<{ message: string; time: string }>('app:ping'),
  selectDocx: () => invoke<string | null>('file:select-docx'),
  selectRestoreFile: () => invoke<string | null>('file:select-restore-file'),
  selectOutputDir: () => invoke<string | null>('file:select-output-dir'),
  smokeMaskDocx: (payload: { filePath: string }) =>
    invoke<{ success: boolean; outputPath: string }>('docx:smoke-mask', payload),
  previewDocx: (payload: DocxPreviewPayload) => invoke<DocxPreviewResult>('docx:preview', payload),
  maskDocx: (payload: MaskDocxPayload) => invoke<MaskDocxResult>('docx:mask', payload),
  restoreDocx: (payload: RestoreDocxPayload) => invoke<RestoreDocxResult>('docx:restore', payload),
  readSettings: () => invoke<Settings>('settings:read'),
  saveSettings: (payload: Settings) => invoke<Settings>('settings:save', payload),
  listMaskProfiles: () => invoke<MaskProfile[]>('profiles:list'),
  saveMaskProfile: (payload: { id?: string; name: string; settings: Settings }) =>
    invoke<MaskProfile>('profiles:save', payload),
  deleteMaskProfile: (id: string) => invoke<void>('profiles:delete', id),
  exportMaskProfile: (id: string) => invoke<string | null>('profiles:export', id),
  importMaskProfile: () => invoke<MaskProfile | null>('profiles:import'),
  readLogs: () => invoke<AppLogEntry[]>('logs:read'),
  showItemInFolder: (filePath: string) => invoke<void>('shell:show-item-in-folder', filePath),
  previewDocxMatches: (payload: DocxMatchPreviewPayload) =>
    invoke<DocxMatchPreviewResult>('docx:preview-matches', payload),
  listTaskHistory: (limit?: number) => invoke<TaskHistoryEntry[]>('tasks:list-history', limit),
};
