import type {Settings} from '../schema/settings.schema.js';

export type MaskDocxPayload = {
  inputPath: string;
  outputDir?: string;
  password: string;
  settings?: Settings;
};

export type MaskDocxResult = {
  maskedDocxPath: string;
  restoreFilePath: string;
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
  restoredDocxPath: string;
  restoredFingerprint: string;
  itemCount: number;
};

export type AppLogEntry = {
  timestamp: string;
  level: string;
  message: string;
};
