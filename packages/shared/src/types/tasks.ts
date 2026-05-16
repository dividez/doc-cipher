import type { Settings } from '../schema/settings.schema.js';

export type MaskDocxPayload = {
  inputPath: string;
  outputDir?: string;
  password: string;
  settings?: Settings;
};

export type MaskDocxResult = {
  taskId: string;
  taskDir: string;
  maskedDocxPath: string;
  restoreFilePath: string;
  manifestPath: string;
  taskLogPath: string;
  sourceSha256: string;
  maskedSha256: string;
  originalFingerprint: string;
  maskedFingerprint: string;
  itemCount: number;
};

export type RestoreDocxPayload = {
  maskedDocxPath: string;
  restoreFilePath: string;
  outputDir?: string;
  password: string;
};

export type RestoreDocxResult = {
  taskId: string;
  taskDir: string;
  restoredDocxPath: string;
  manifestPath: string;
  taskLogPath: string;
  maskedSha256: string;
  restoredFingerprint: string;
  itemCount: number;
};

export type AppLogEntry = {
  timestamp: string;
  level: string;
  message: string;
};
