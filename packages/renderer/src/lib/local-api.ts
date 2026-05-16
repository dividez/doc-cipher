import type {
  AppLogEntry,
  MaskDocxPayload,
  MaskDocxResult,
  RestoreDocxPayload,
  RestoreDocxResult,
  Settings,
} from '@app/shared';

export type LocalApi = {
  ping: () => Promise<{ message: string; time: string }>;
  selectDocx: () => Promise<string | null>;
  selectRestoreFile: () => Promise<string | null>;
  selectOutputDir: () => Promise<string | null>;
  smokeMaskDocx: (payload: {
    filePath: string;
  }) => Promise<{ success: boolean; outputPath: string }>;
  maskDocx: (payload: MaskDocxPayload) => Promise<MaskDocxResult>;
  restoreDocx: (payload: RestoreDocxPayload) => Promise<RestoreDocxResult>;
  readSettings: () => Promise<Settings>;
  saveSettings: (payload: Settings) => Promise<Settings>;
  readLogs: () => Promise<AppLogEntry[]>;
  showItemInFolder: (filePath: string) => Promise<void>;
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
