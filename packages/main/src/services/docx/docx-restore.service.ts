import AdmZip from 'adm-zip';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, extname, join } from 'node:path';
import type {
  RestoreDocxPayload,
  RestoreDocxReport,
  RestoreDocxReportItem,
  RestoreDocxResult,
} from '@app/shared';
import { decryptMapping, sha256 } from '../crypto/crypto.service.js';
import { shouldProcessPart } from './docx-parts.js';
import { restoreXmlPart } from './docx-restore-xml.js';
import { logger } from '../app/log.service.js';
import { createTaskContext, writeTaskLog, writeTaskManifest } from '../task/task.service.js';

export async function restoreDocx(payload: RestoreDocxPayload): Promise<RestoreDocxResult> {
  const task = await createTaskContext({
    kind: 'restore',
    sourcePath: payload.maskedDocxPath,
    outputRoot: payload.outputDir,
  });
  const outputDir = task.taskDir;
  const baseName = basename(payload.maskedDocxPath, extname(payload.maskedDocxPath)).replace(
    /\.masked$/,
    '',
  );
  const restoredDocxPath = join(outputDir, `${baseName}.restored.docx`);
  const restoreReportPath = join(outputDir, 'restore-report.json');

  try {
    await writeTaskLog(task, `Start restoring ${basename(payload.maskedDocxPath)}`);
    const maskedBuffer = await readFile(payload.maskedDocxPath);
    const encrypted = JSON.parse(await readFile(payload.restoreFilePath, 'utf8'));
    const mapping = await decryptMapping(encrypted, payload.password);
    const maskedFingerprint = sha256(maskedBuffer);
    const fingerprintMatch = mapping.masked_doc_fingerprint === maskedFingerprint;

    if (!fingerprintMatch) {
      await writeTaskLog(
        task,
        '当前 docx 指纹与 restore.enc 记录不一致，将按完整 token 执行部分还原',
        'warn',
      );
    }

    const zip = new AdmZip(maskedBuffer);
    const tokenVault =
      mapping.tokens ??
      Object.fromEntries(mapping.items.map((item) => [item.token, item.original]));
    const tokenEntries = Object.entries(tokenVault);
    const knownTokens = new Set(Object.keys(tokenVault));
    const replacements = Object.entries(tokenVault)
      .map(([token, original]) => ({ token, original }))
      .sort((a, b) => b.token.length - a.token.length);
    const restoredCounts = new Map<string, number>();
    const unknownCounts = new Map<string, number>();

    for (const entry of zip.getEntries()) {
      if (!shouldProcessPart(entry.entryName)) {
        continue;
      }

      await writeTaskLog(task, `Restore ${entry.entryName}`);
      const xml = entry.getData().toString('utf8');
      const result = restoreXmlPart(xml, replacements, knownTokens);
      addCounts(restoredCounts, result.restoredCounts);
      addCounts(unknownCounts, result.unknownCounts);
      const updatedXml = result.updatedXml;
      zip.updateFile(entry.entryName, Buffer.from(updatedXml, 'utf8'));
    }

    await mkdir(outputDir, { recursive: true });
    const restoredBuffer = zip.toBuffer();
    const restoredFingerprint = sha256(restoredBuffer);
    const report = buildRestoreReport({
      tokenEntries,
      restoredCounts,
      unknownCounts,
      expectedMaskedSha256: mapping.masked_doc_fingerprint,
      currentDocxSha256: maskedFingerprint,
      restoredSha256: restoredFingerprint,
      fingerprintMatch,
    });
    await writeFile(restoredDocxPath, restoredBuffer);
    await writeFile(restoreReportPath, JSON.stringify(report, null, 2), 'utf8');
    await writeTaskLog(task, `Generated ${basename(restoredDocxPath)}`);
    await writeTaskLog(task, `Generated ${basename(restoreReportPath)}`);
    await writeTaskManifest(task, {
      status: 'success',
      restore_file_name: basename(payload.restoreFilePath),
      restored_file_name: basename(restoredDocxPath),
      restore_report_file_name: basename(restoreReportPath),
      masked_sha256: maskedFingerprint,
      restored_sha256: restoredFingerprint,
      expected_masked_sha256: mapping.masked_doc_fingerprint,
      fingerprint_match: fingerprintMatch,
      total_tokens: report.total_tokens,
      restored_tokens: report.restored_tokens,
      restored_occurrences: report.restored_occurrences,
      missing_tokens: report.missing_tokens,
      unknown_tokens: report.unknown_tokens,
      unknown_occurrences: report.unknown_occurrences,
      item_count: report.restored_occurrences,
    });
    logger().info(
      `Restored ${basename(payload.maskedDocxPath)} -> ${restoredDocxPath}; ${report.restored_occurrences} occurrences`,
    );

    return {
      taskId: task.taskId,
      taskDir: task.taskDir,
      restoredDocxPath,
      reportPath: restoreReportPath,
      manifestPath: task.manifestPath,
      taskLogPath: task.taskLogPath,
      maskedSha256: maskedFingerprint,
      restoredFingerprint,
      fingerprintMatch,
      totalTokens: report.total_tokens,
      restoredTokens: report.restored_tokens,
      restoredOccurrences: report.restored_occurrences,
      missingTokens: report.missing_tokens,
      unknownTokens: report.unknown_tokens,
      unknownOccurrences: report.unknown_occurrences,
      itemCount: report.restored_occurrences,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : '还原失败';
    await writeTaskLog(task, message, 'error');
    await writeTaskManifest(task, {
      status: 'failed',
      restore_file_name: basename(payload.restoreFilePath),
      restored_file_name: basename(restoredDocxPath),
      restore_report_file_name: basename(restoreReportPath),
      item_count: 0,
      error_message: message,
    });
    throw error;
  }
}

function addCounts(target: Map<string, number>, source: Map<string, number>): void {
  for (const [key, value] of source.entries()) {
    target.set(key, (target.get(key) ?? 0) + value);
  }
}

function buildRestoreReport(payload: {
  tokenEntries: Array<[string, string]>;
  restoredCounts: Map<string, number>;
  unknownCounts: Map<string, number>;
  expectedMaskedSha256: string;
  currentDocxSha256: string;
  restoredSha256: string;
  fingerprintMatch: boolean;
}): RestoreDocxReport {
  const items: RestoreDocxReportItem[] = payload.tokenEntries.map(([token]) => {
    const occurrences = payload.restoredCounts.get(token) ?? 0;
    return {
      token,
      status: occurrences > 0 ? ('restored' as const) : ('missing' as const),
      occurrences,
    };
  });

  for (const [token, occurrences] of [...payload.unknownCounts.entries()].sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    items.push({
      token,
      status: 'unknown',
      occurrences,
    });
  }

  const restoredTokens = items.filter((item) => item.status === 'restored').length;
  const restoredOccurrences = sumCounts(payload.restoredCounts);
  const unknownTokens = payload.unknownCounts.size;

  return {
    version: '1.0.0',
    mode: 'partial_restore',
    fingerprint_match: payload.fingerprintMatch,
    expected_masked_sha256: payload.expectedMaskedSha256,
    current_docx_sha256: payload.currentDocxSha256,
    restored_sha256: payload.restoredSha256,
    total_tokens: payload.tokenEntries.length,
    restored_tokens: restoredTokens,
    restored_occurrences: restoredOccurrences,
    missing_tokens: payload.tokenEntries.length - restoredTokens,
    unknown_tokens: unknownTokens,
    unknown_occurrences: sumCounts(payload.unknownCounts),
    items,
  };
}

function sumCounts(counts: Map<string, number>): number {
  let total = 0;
  for (const value of counts.values()) {
    total += value;
  }
  return total;
}
