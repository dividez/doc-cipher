import type {
  AppLogEntry,
  DocxMatchPreviewPayload,
  DocxMatchPreviewResult,
  DocxReadFilePayload,
  DocxReadFileResult,
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

export type AppStoragePathsInfo = {
  appDataDir: string;
  appConfigDir: string;
  userDataDir: string;
  profilesDir: string;
  tasksDir: string;
  logsDir: string;
  keysDir: string;
  tempDir: string;
  defaultUserDataDir: string;
  isCustomUserDataDir: boolean;
};

export const localApi = {
  ping: () => invoke<{ message: string; time: string }>('app:ping'),
  selectDocx: () => invoke<string | null>('file:select-docx'),
  selectRestoreFile: () => invoke<string | null>('file:select-restore-file'),
  selectOutputDir: () => invoke<string | null>('file:select-output-dir'),
  smokeMaskDocx: (payload: { filePath: string }) =>
    invoke<{ success: boolean; outputPath: string }>('docx:smoke-mask', payload),
  readDocxFile: (payload: DocxReadFilePayload) =>
    invoke<DocxReadFileResult>('docx:read-file', payload),
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
  getStoragePaths: () => invoke<AppStoragePathsInfo>('app:get-storage-paths'),
  openAppDataDir: () => invoke<void>('app:open-app-data-dir'),
  openUserDataDir: () => invoke<void>('app:open-user-data-dir'),
  pickUserDataDir: () =>
    invoke<{ path: string; needsRestart: boolean } | null>('app:pick-user-data-dir'),
  resetUserDataDir: () =>
    invoke<{ path: string; needsRestart: boolean }>('app:reset-user-data-dir'),
  relaunchApp: () => invoke<void>('app:relaunch'),
  onNavigate: (callback: (view: string) => void) => {
    const listener = (_event: unknown, view: string) => {
      callback(view);
    };
    ipcRenderer.on('app:navigate', listener);
    return () => {
      ipcRenderer.removeListener('app:navigate', listener);
    };
  },
};
