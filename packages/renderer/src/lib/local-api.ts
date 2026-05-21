import type {
  AiDetectPayload,
  AiDetectResult,
  AiDownloadProgress,
  AiStatus,
  AppLogEntry,
  DocxMatchPreviewPayload,
  DocxMatchPreviewResult,
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

export type LocalApi = {
  ping: () => Promise<{ message: string; time: string }>;
  getPathForFile: (file: File) => string;
  selectDocx: () => Promise<string | null>;
  selectRestoreFile: () => Promise<string | null>;
  selectOutputDir: () => Promise<string | null>;
  smokeMaskDocx: (payload: {
    filePath: string;
  }) => Promise<{ success: boolean; outputPath: string }>;
  readDocxFile: (payload: DocxReadFilePayload) => Promise<DocxReadFileResult>;
  maskDocx: (payload: MaskDocxPayload) => Promise<MaskDocxResult>;
  restoreDocx: (payload: RestoreDocxPayload) => Promise<RestoreDocxResult>;
  readSettings: () => Promise<Settings>;
  saveSettings: (payload: Settings) => Promise<Settings>;
  listMaskProfiles: () => Promise<MaskProfile[]>;
  saveMaskProfile: (payload: {
    id?: string;
    name: string;
    settings: Settings;
  }) => Promise<MaskProfile>;
  deleteMaskProfile: (id: string) => Promise<void>;
  exportMaskProfile: (id: string) => Promise<string | null>;
  importMaskProfile: () => Promise<MaskProfile | null>;
  readLogs: () => Promise<AppLogEntry[]>;
  showItemInFolder: (filePath: string) => Promise<void>;
  previewDocxMatches: (payload: DocxMatchPreviewPayload) => Promise<DocxMatchPreviewResult>;
  listTaskHistory: (limit?: number) => Promise<TaskHistoryEntry[]>;
  getStoragePaths: () => Promise<AppStoragePathsInfo>;
  openAppDataDir: () => Promise<void>;
  openUserDataDir: () => Promise<void>;
  pickUserDataDir: () => Promise<{ path: string; needsRestart: boolean } | null>;
  resetUserDataDir: () => Promise<{ path: string; needsRestart: boolean }>;
  relaunchApp: () => Promise<void>;
  getAiStatus: () => Promise<AiStatus>;
  fetchAiManifest: () => Promise<unknown>;
  downloadAiModel: (modelId?: string) => Promise<InstalledModel>;
  cancelAiDownload: () => Promise<void>;
  deleteAiModel: (modelId?: string) => Promise<void>;
  detectSensitive: (payload: AiDetectPayload) => Promise<AiDetectResult>;
  onAiDownloadProgress: (callback: (progress: AiDownloadProgress) => void) => () => void;
  onNavigate: (callback: (view: string) => void) => () => void;
};

declare global {
  interface Window {
    localApi?: LocalApi;
  }
}

export function isLocalApiReady(): boolean {
  const api = window.localApi;
  return (
    !!api &&
    typeof api.selectDocx === 'function' &&
    typeof api.readDocxFile === 'function' &&
    typeof api.listMaskProfiles === 'function' &&
    typeof api.previewDocxMatches === 'function' &&
    typeof api.listTaskHistory === 'function' &&
    typeof api.readLogs === 'function' &&
    typeof api.readSettings === 'function'
  );
}

export function getLocalApi(): LocalApi {
  if (!isLocalApiReady()) {
    throw new Error('服务不可用');
  }
  return window.localApi as LocalApi;
}
