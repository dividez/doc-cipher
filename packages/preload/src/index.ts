import type {
  AiDetectPayload,
  AiDetectResult,
  AiDownloadProgress,
  AiInferenceEstimate,
  AiInferenceEstimatePayload,
  AiMaskProgress,
  AiRecognizeLogEvent,
  AiStatus,
  AppLogEntry,
  DocxMatchPreviewResult,
  DocxRecognizeMatchesPayload,
  DocxReadFilePayload,
  DocxReadFileResult,
  InstalledModel,
  MaskProfile,
  MaskDocxPayload,
  MaskDocxResult,
  RestoreDocxPayload,
  RestoreDocxResult,
  Settings,
  TaskHistoryEntry,
} from '@app/shared';

const { ipcRenderer, webUtils } = require('electron') as typeof import('electron');

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
  getPathForFile: (file: File) => webUtils.getPathForFile(file),
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
  recognizeDocxMatches: (payload: DocxRecognizeMatchesPayload) =>
    invoke<DocxMatchPreviewResult>('docx:recognize-matches', payload),
  listTaskHistory: (limit?: number) => invoke<TaskHistoryEntry[]>('tasks:list-history', limit),
  getStoragePaths: () => invoke<AppStoragePathsInfo>('app:get-storage-paths'),
  openAppDataDir: () => invoke<void>('app:open-app-data-dir'),
  openUserDataDir: () => invoke<void>('app:open-user-data-dir'),
  openExternalUrl: (url: string) => invoke<void>('app:open-external-url', url),
  pickUserDataDir: () =>
    invoke<{ path: string; needsRestart: boolean } | null>('app:pick-user-data-dir'),
  resetUserDataDir: () =>
    invoke<{ path: string; needsRestart: boolean }>('app:reset-user-data-dir'),
  relaunchApp: () => invoke<void>('app:relaunch'),
  getAiStatus: () => invoke<AiStatus>('ai:get-status'),
  fetchAiManifest: () => invoke<unknown>('ai:fetch-manifest'),
  downloadAiModel: (modelId?: string) => invoke<InstalledModel>('ai:download-model', modelId),
  cancelAiDownload: () => invoke<void>('ai:cancel-download'),
  deleteAiModel: (modelId?: string) => invoke<void>('ai:delete-model', modelId),
  setActiveAiModel: (modelId: string) => invoke<void>('ai:set-active-model', modelId),
  detectSensitive: (payload: AiDetectPayload) =>
    invoke<AiDetectResult>('ai:detect-sensitive', payload),
  estimateAiInference: (payload: AiInferenceEstimatePayload) =>
    invoke<AiInferenceEstimate>('ai:estimate-inference', payload),
  cancelAiMask: () => invoke<void>('ai:cancel-mask'),
  onAiDownloadProgress: (callback: (progress: AiDownloadProgress) => void) => {
    const listener = (_event: unknown, progress: AiDownloadProgress) => {
      callback(progress);
    };
    ipcRenderer.on('ai:download-progress', listener);
    return () => {
      ipcRenderer.removeListener('ai:download-progress', listener);
    };
  },
  onAiMaskProgress: (callback: (progress: AiMaskProgress) => void) => {
    const listener = (_event: unknown, progress: AiMaskProgress) => {
      callback(progress);
    };
    ipcRenderer.on('ai:mask-progress', listener);
    return () => {
      ipcRenderer.removeListener('ai:mask-progress', listener);
    };
  },
  onAiRecognizeLog: (callback: (event: AiRecognizeLogEvent) => void) => {
    const listener = (_event: unknown, event: AiRecognizeLogEvent) => {
      callback(event);
    };
    ipcRenderer.on('ai:recognize-log', listener);
    return () => {
      ipcRenderer.removeListener('ai:recognize-log', listener);
    };
  },
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
