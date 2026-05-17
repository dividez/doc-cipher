import type { DocxMatchHitKind } from '../lib/masking-rules.js';
import type { Settings } from '../schema/settings.schema.js';

export type { DocxMatchHitKind } from '../lib/masking-rules.js';

export type DocxStructureHint = {
  region: 'body' | 'header' | 'footer' | 'footnote' | 'endnote' | 'comment';
  inTable: boolean;
};

export type DocxTextBlock = {
  id: string;
  partName: string;
  blockIndex: number;
  text: string;
  structure?: DocxStructureHint;
};

export type ManualKeyword = {
  id: string;
  text: string;
};

export type DocxReadFilePayload = {
  filePath: string;
};

export type DocxReadFileResult = {
  base64: string;
};

export type MaskDocxPayload = {
  inputPath: string;
  outputDir?: string;
  password: string;
  settings?: Settings;
  manualKeywords?: string[];
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

export type RestoreDocxReportItem = {
  token: string;
  status: 'restored' | 'missing' | 'unknown';
  occurrences: number;
};

export type RestoreDocxReport = {
  version: '1.0.0';
  mode: 'partial_restore';
  fingerprint_match: boolean;
  expected_masked_sha256: string;
  current_docx_sha256: string;
  restored_sha256: string;
  total_tokens: number;
  restored_tokens: number;
  restored_occurrences: number;
  missing_tokens: number;
  unknown_tokens: number;
  unknown_occurrences: number;
  items: RestoreDocxReportItem[];
};

export type RestoreDocxResult = {
  taskId: string;
  taskDir: string;
  restoredDocxPath: string;
  reportPath: string;
  manifestPath: string;
  taskLogPath: string;
  maskedSha256: string;
  restoredFingerprint: string;
  fingerprintMatch: boolean;
  totalTokens: number;
  restoredTokens: number;
  restoredOccurrences: number;
  missingTokens: number;
  unknownTokens: number;
  unknownOccurrences: number;
  itemCount: number;
};

export type AppLogEntry = {
  timestamp: string;
  level: string;
  message: string;
};

export type DocxMatchHit = {
  partName: string;
  blockIndex: number;
  start: number;
  end: number;
  ruleId: string;
  kind: DocxMatchHitKind;
};

export type DocxMatchRuleHit = {
  ruleId: string;
  ruleName: string;
  kind: DocxMatchHitKind;
  count: number;
};

export type DocxMatchPreviewSample = {
  ruleId: string;
  ruleName: string;
  kind: DocxMatchHitKind;
  snippet: string;
};

export type DocxZeroHitRule = {
  ruleId: string;
  ruleName: string;
  kind: DocxMatchHitKind;
};

export type DocxMatchPreviewResult = {
  filePath: string;
  paragraphCount: number;
  totalHits: number;
  manualSelectionHits: number;
  ruleHits: DocxMatchRuleHit[];
  hits: DocxMatchHit[];
  zeroHitRules: DocxZeroHitRule[];
  samples: DocxMatchPreviewSample[];
};

export type DocxMatchPreviewPayload = {
  filePath: string;
  settings: Settings;
  manualKeywords?: string[];
};

export type TaskHistoryEntry = {
  task_id: string;
  kind: 'mask' | 'restore';
  status: 'running' | 'success' | 'failed';
  source_file_name: string;
  task_dir: string;
  manifest_path: string;
  created_at: string;
  updated_at: string;
  item_count: number;
};
