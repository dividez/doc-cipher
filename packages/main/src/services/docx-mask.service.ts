import AdmZip from 'adm-zip';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import type { Document as XmlDocument, Element as XmlElement } from '@xmldom/xmldom';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, extname, join } from 'node:path';
import type {
  DocxManualSelection,
  MappingItem,
  MaskDocxPayload,
  MaskDocxResult,
  MaskingRule,
  RestoreMapping,
  Settings,
} from '@app/shared';
import { expandManualSegments, settingsSchema } from '@app/shared';
import { encryptMapping, sha256 } from './crypto.service.js';
import { shouldProcessPart } from './docx-parts.js';
import { logger } from './log.service.js';
import {
  createTaskContext,
  summarizeRules,
  writeTaskLog,
  writeTaskManifest,
} from './task.service.js';

type TextNodeRef = {
  element: XmlElement;
  text: string;
  start: number;
  end: number;
};

type Match = {
  start: number;
  end: number;
  original: string;
  ruleId: string;
  token: string;
  order: number;
};

type PendingMatch = Omit<Match, 'token'>;

export async function maskDocx(payload: MaskDocxPayload): Promise<MaskDocxResult> {
  const settings = settingsSchema.parse(payload.settings);
  const inputPath = payload.inputPath;
  const task = await createTaskContext({
    kind: 'mask',
    sourcePath: inputPath,
    outputRoot: payload.outputDir,
  });
  const outputDir = task.taskDir;
  const baseName = basename(inputPath, extname(inputPath));
  const maskedDocxPath = join(outputDir, `${baseName}.masked.docx`);
  const restoreFilePath = join(outputDir, `${baseName}.restore.enc`);

  try {
    await writeTaskLog(task, `Start masking ${basename(inputPath)}`);
    const originalBuffer = await readFile(inputPath);
    const originalFingerprint = sha256(originalBuffer);
    const zip = new AdmZip(inputPath);
    const counters = new Map<string, number>();
    const items: MappingItem[] = [];
    const manualSelections = payload.manualSelections ?? [];

    for (const entry of zip.getEntries()) {
      if (!shouldProcessPart(entry.entryName)) {
        continue;
      }

      await writeTaskLog(task, `Parse ${entry.entryName}`);
      const xml = entry.getData().toString('utf8');
      const { updatedXml, matches } = maskXmlPart(
        xml,
        entry.entryName,
        settings,
        counters,
        manualSelections,
      );

      if (matches.length > 0) {
        zip.updateFile(entry.entryName, Buffer.from(updatedXml, 'utf8'));
        items.push(
          ...matches.map((match, index) => ({
            token: match.token,
            original: match.original,
            rule_id: match.ruleId,
            location: {
              part: entry.entryName,
              index: index + 1,
            },
          })),
        );
        await writeTaskLog(task, `${entry.entryName} matched ${matches.length} items`);
      }
    }

    await mkdir(outputDir, { recursive: true });
    const maskedBuffer = zip.toBuffer();
    const maskedFingerprint = sha256(maskedBuffer);
    await writeFile(maskedDocxPath, maskedBuffer);
    await writeTaskLog(task, `Generated ${basename(maskedDocxPath)}`);

    const mapping: RestoreMapping = {
      version: '1.0.0',
      task_id: task.taskId,
      doc_fingerprint: originalFingerprint,
      masked_doc_fingerprint: maskedFingerprint,
      created_at: new Date().toISOString(),
      rules_version: settings.version,
      tokens: Object.fromEntries(items.map((item) => [item.token, item.original])),
      items,
    };

    const encrypted = await encryptMapping(mapping, payload.password);
    await writeFile(restoreFilePath, JSON.stringify(encrypted, null, 2), 'utf8');
    await writeTaskLog(task, `Generated ${basename(restoreFilePath)}`);
    await writeTaskManifest(task, {
      status: 'success',
      masked_file_name: basename(maskedDocxPath),
      restore_file_name: basename(restoreFilePath),
      rules: summarizeRules(settings.rules, items),
      source_sha256: originalFingerprint,
      masked_sha256: maskedFingerprint,
      item_count: items.length,
    });

    logger().info(`Masked ${basename(inputPath)} -> ${maskedDocxPath}; ${items.length} items`);

    return {
      taskId: task.taskId,
      taskDir: task.taskDir,
      maskedDocxPath,
      restoreFilePath,
      manifestPath: task.manifestPath,
      taskLogPath: task.taskLogPath,
      sourceSha256: originalFingerprint,
      maskedSha256: maskedFingerprint,
      originalFingerprint,
      maskedFingerprint,
      itemCount: items.length,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : '脱敏失败';
    await writeTaskLog(task, message, 'error');
    await writeTaskManifest(task, {
      status: 'failed',
      masked_file_name: basename(maskedDocxPath),
      restore_file_name: basename(restoreFilePath),
      item_count: 0,
      error_message: message,
    });
    throw error;
  }
}

export function localManualSelectionsForParagraph(
  manualSelections: DocxManualSelection[],
  partName: string,
  blockIndex: number,
  paragraphText: string,
): DocxManualSelection[] {
  return manualSelections.flatMap((sel) =>
    expandManualSegments(sel)
      .filter((s) => s.partName === partName && s.blockIndex === blockIndex)
      .map((s) => ({
        ...sel,
        partName: s.partName,
        blockIndex: s.blockIndex,
        start: s.start,
        end: s.end,
        text: paragraphText.slice(s.start, s.end),
      })),
  );
}

function maskXmlPart(
  xml: string,
  partName: string,
  settings: Settings,
  counters: Map<string, number>,
  manualSelections: DocxManualSelection[],
): { updatedXml: string; matches: Match[] } {
  const parser = new DOMParser({
    onError: (level, message) => {
      if (level === 'fatalError') {
        throw new Error(`无法解析 ${partName}: ${message}`);
      }
    },
  });
  const document = parser.parseFromString(xml, 'application/xml');
  const serializer = new XMLSerializer();
  const paragraphs = Array.from(document.getElementsByTagName('w:p'));
  const allMatches: Match[] = [];

  for (const [blockIndex, paragraph] of paragraphs.entries()) {
    const textNodes = collectTextNodes(paragraph);
    const paragraphText = textNodes.map((node) => node.text).join('');

    if (!paragraphText) {
      continue;
    }

    const locals = localManualSelectionsForParagraph(
      manualSelections,
      partName,
      blockIndex,
      paragraphText,
    );
    const selected = selectMatches(findMatches(paragraphText, settings, locals));
    if (selected.length === 0) {
      continue;
    }

    const tokenized = selected.map((match) => {
      const count = (counters.get(match.ruleId) ?? 0) + 1;
      counters.set(match.ruleId, count);
      return {
        ...match,
        token: createToken(match.ruleId, count, settings.rules),
      };
    });

    rewriteTextNodes(document, textNodes, paragraphText, tokenized);
    allMatches.push(...tokenized);
  }

  return {
    updatedXml: serializer.serializeToString(document),
    matches: allMatches,
  };
}

function collectTextNodes(paragraph: XmlElement): TextNodeRef[] {
  const nodes = Array.from(paragraph.getElementsByTagName('w:t'));
  let offset = 0;

  return nodes.map((element) => {
    const text = element.textContent ?? '';
    const ref = {
      element,
      text,
      start: offset,
      end: offset + text.length,
    };
    offset += text.length;
    return ref;
  });
}

export function findMatches(
  text: string,
  settings: Settings,
  manualSelections: DocxManualSelection[],
): PendingMatch[] {
  const pending: PendingMatch[] = [];
  let order = 0;
  const rules = settings.rules;

  for (const selection of manualSelections) {
    if (selection.start < 0 || selection.end > text.length || selection.start >= selection.end) {
      continue;
    }
    const original = text.slice(selection.start, selection.end);
    if (original !== selection.text) {
      continue;
    }

    pending.push({
      start: selection.start,
      end: selection.end,
      original,
      ruleId: 'manual_selection',
      order: order++,
    });
  }

  for (const rule of rules) {
    if (!rule.enabled) {
      continue;
    }

    if (rule.type === 'regex') {
      if (!settings.app.enable_regex_rules) {
        continue;
      }
      const regex = new RegExp(rule.pattern, 'gu');
      for (const match of text.matchAll(regex)) {
        const value = match[0];
        if (!value || match.index === undefined) {
          continue;
        }

        pending.push({
          start: match.index,
          end: match.index + value.length,
          original: value,
          ruleId: rule.id,
          order: order++,
        });
      }
    }

    if (rule.type === 'keyword') {
      if (rule.id === 'keywords' && !settings.app.enable_system_keywords) {
        continue;
      }
      for (const keyword of rule.keywords) {
        let index = text.indexOf(keyword);
        while (index !== -1) {
          pending.push({
            start: index,
            end: index + keyword.length,
            original: keyword,
            ruleId: rule.id,
            order: order++,
          });
          index = text.indexOf(keyword, index + keyword.length);
        }
      }
    }

    if (rule.type === 'manual') {
      for (const selection of rule.selections) {
        let index = text.indexOf(selection);
        while (index !== -1) {
          pending.push({
            start: index,
            end: index + selection.length,
            original: selection,
            ruleId: rule.id,
            order: order++,
          });
          index = text.indexOf(selection, index + selection.length);
        }
      }
    }
  }

  return pending;
}

export function selectMatches(matches: PendingMatch[]): PendingMatch[] {
  const selected: PendingMatch[] = [];

  for (const match of matches.sort(
    (a, b) => a.start - b.start || b.end - b.start - (a.end - a.start) || a.order - b.order,
  )) {
    if (selected.some((item) => rangesOverlap(item, match))) {
      continue;
    }

    selected.push(match);
  }

  return selected.sort((a, b) => a.start - b.start);
}

function rangesOverlap(a: PendingMatch, b: PendingMatch): boolean {
  return a.start < b.end && b.start < a.end;
}

function createToken(ruleId: string, count: number, rules: MaskingRule[]): string {
  const rule = rules.find((item) => item.id === ruleId);
  const n = String(count).padStart(6, '0');
  const fallback = ruleId === 'manual_selection' ? '[MANUAL_{n}]' : `[${ruleId.toUpperCase()}_{n}]`;
  return (rule?.placeholder || fallback).replaceAll('{n}', n);
}

function rewriteTextNodes(
  document: XmlDocument,
  textNodes: TextNodeRef[],
  fullText: string,
  matches: Match[],
): void {
  const starts = new Map(matches.map((match) => [match.start, match]));

  for (const node of textNodes) {
    let output = '';
    let position = node.start;

    while (position < node.end) {
      const startingMatch = starts.get(position);

      if (startingMatch) {
        output += startingMatch.token;
        position = startingMatch.end;
        continue;
      }

      const containingMatch = matches.find(
        (match) => match.start < position && position < match.end,
      );
      if (containingMatch) {
        position = Math.min(containingMatch.end, node.end);
        continue;
      }

      output += fullText[position] ?? '';
      position += 1;
    }

    setElementText(document, node.element, output);
  }
}

function setElementText(document: XmlDocument, element: XmlElement, text: string): void {
  while (element.firstChild) {
    element.removeChild(element.firstChild);
  }

  if (/^\s|\s$/.test(text)) {
    element.setAttribute('xml:space', 'preserve');
  }

  element.appendChild(document.createTextNode(text));
}
