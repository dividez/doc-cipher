import AdmZip from 'adm-zip';
import {DOMParser, XMLSerializer} from '@xmldom/xmldom';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {basename, dirname, extname, join} from 'node:path';
import type {MappingItem, MaskDocxPayload, MaskDocxResult, MaskingRule, RestoreMapping, Settings} from '@app/shared';
import {settingsSchema} from '@app/shared';
import {encryptMapping, sha256} from './crypto.service.js';
import {shouldProcessPart} from './docx-parts.js';
import {logger} from './log.service.js';

type TextNodeRef = {
  element: Element;
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
  const outputDir = payload.outputDir || join(dirname(inputPath), 'output');
  const baseName = basename(inputPath, extname(inputPath));
  const maskedDocxPath = join(outputDir, `${baseName}.masked.docx`);
  const restoreFilePath = join(outputDir, `${baseName}.restore.enc`);
  const originalBuffer = await readFile(inputPath);
  const originalFingerprint = sha256(originalBuffer);
  const zip = new AdmZip(inputPath);
  const counters = new Map<string, number>();
  const items: MappingItem[] = [];

  for (const entry of zip.getEntries()) {
    if (!shouldProcessPart(entry.entryName)) {
      continue;
    }

    const xml = entry.getData().toString('utf8');
    const {updatedXml, matches} = maskXmlPart(xml, entry.entryName, settings, counters);

    if (matches.length > 0) {
      zip.updateFile(entry.entryName, Buffer.from(updatedXml, 'utf8'));
      items.push(...matches.map((match, index) => ({
        token: match.token,
        original: match.original,
        rule_id: match.ruleId,
        location: {
          part: entry.entryName,
          index: index + 1,
        },
      })));
    }
  }

  await mkdir(outputDir, {recursive: true});
  const maskedBuffer = zip.toBuffer();
  const maskedFingerprint = sha256(maskedBuffer);
  await writeFile(maskedDocxPath, maskedBuffer);

  const mapping: RestoreMapping = {
    version: '1.0.0',
    doc_fingerprint: originalFingerprint,
    masked_doc_fingerprint: maskedFingerprint,
    created_at: new Date().toISOString(),
    rules_version: settings.version,
    items,
  };

  const encrypted = await encryptMapping(mapping, payload.password);
  await writeFile(restoreFilePath, JSON.stringify(encrypted, null, 2), 'utf8');

  logger().info(`Masked ${inputPath} -> ${maskedDocxPath}; ${items.length} items`);

  return {
    maskedDocxPath,
    restoreFilePath,
    originalFingerprint,
    maskedFingerprint,
    itemCount: items.length,
  };
}

function maskXmlPart(
  xml: string,
  partName: string,
  settings: Settings,
  counters: Map<string, number>,
): {updatedXml: string; matches: Match[]} {
  const parser = new DOMParser({
    errorHandler: {
      warning: () => undefined,
      error: () => undefined,
      fatalError: (message) => {
        throw new Error(`无法解析 ${partName}: ${message}`);
      },
    },
  });
  const document = parser.parseFromString(xml, 'application/xml');
  const serializer = new XMLSerializer();
  const paragraphs = Array.from(document.getElementsByTagName('w:p'));
  const allMatches: Match[] = [];

  for (const paragraph of paragraphs) {
    const textNodes = collectTextNodes(paragraph);
    const paragraphText = textNodes.map((node) => node.text).join('');

    if (!paragraphText) {
      continue;
    }

    const selected = selectMatches(findMatches(paragraphText, settings.rules, counters));
    if (selected.length === 0) {
      continue;
    }

    rewriteTextNodes(document, textNodes, paragraphText, selected);
    allMatches.push(...selected);
  }

  return {
    updatedXml: serializer.serializeToString(document),
    matches: allMatches,
  };
}

function collectTextNodes(paragraph: Element): TextNodeRef[] {
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

function findMatches(text: string, rules: MaskingRule[], counters: Map<string, number>): Match[] {
  const pending: PendingMatch[] = [];
  let order = 0;

  for (const rule of rules) {
    if (!rule.enabled) {
      continue;
    }

    if (rule.type === 'regex') {
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

  return pending.map((match) => {
    const count = (counters.get(match.ruleId) ?? 0) + 1;
    counters.set(match.ruleId, count);
    return {
      ...match,
      token: createToken(match.ruleId, count, rules),
    };
  });
}

function selectMatches(matches: Match[]): Match[] {
  const selected: Match[] = [];

  for (const match of matches.sort((a, b) => a.start - b.start || b.end - b.start - (a.end - a.start) || a.order - b.order)) {
    if (selected.some((item) => rangesOverlap(item, match))) {
      continue;
    }

    selected.push(match);
  }

  return selected.sort((a, b) => a.start - b.start);
}

function rangesOverlap(a: Match, b: Match): boolean {
  return a.start < b.end && b.start < a.end;
}

function createToken(ruleId: string, count: number, rules: MaskingRule[]): string {
  const rule = rules.find((item) => item.id === ruleId);
  const n = String(count).padStart(6, '0');
  return (rule?.placeholder || `[${ruleId.toUpperCase()}_{n}]`).replaceAll('{n}', n);
}

function rewriteTextNodes(document: Document, textNodes: TextNodeRef[], fullText: string, matches: Match[]): void {
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

      const containingMatch = matches.find((match) => match.start < position && position < match.end);
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

function setElementText(document: Document, element: Element, text: string): void {
  while (element.firstChild) {
    element.removeChild(element.firstChild);
  }

  if (/^\s|\s$/.test(text)) {
    element.setAttribute('xml:space', 'preserve');
  }

  element.appendChild(document.createTextNode(text));
}
