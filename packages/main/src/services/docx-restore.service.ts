import AdmZip from 'adm-zip';
import {DOMParser, XMLSerializer} from '@xmldom/xmldom';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {basename, dirname, extname, join} from 'node:path';
import type {MappingItem, RestoreDocxPayload, RestoreDocxResult} from '@app/shared';
import {decryptMapping, sha256} from './crypto.service.js';
import {shouldProcessPart} from './docx-parts.js';
import {logger} from './log.service.js';

type Replacement = {
  token: string;
  original: string;
};

type TextNodeRef = {
  element: Element;
  text: string;
  start: number;
  end: number;
};

type RestoreMatch = {
  start: number;
  end: number;
  original: string;
};

export async function restoreDocx(payload: RestoreDocxPayload): Promise<RestoreDocxResult> {
  const maskedBuffer = await readFile(payload.maskedDocxPath);
  const encrypted = JSON.parse(await readFile(payload.restoreFilePath, 'utf8'));
  const mapping = await decryptMapping(encrypted, payload.password);
  const maskedFingerprint = sha256(maskedBuffer);

  if (mapping.masked_doc_fingerprint !== maskedFingerprint) {
    throw new Error('还原文件与当前脱敏 docx 指纹不匹配');
  }

  const outputDir = payload.outputDir || join(dirname(payload.maskedDocxPath), 'output');
  const baseName = basename(payload.maskedDocxPath, extname(payload.maskedDocxPath)).replace(/\.masked$/, '');
  const restoredDocxPath = join(outputDir, `${baseName}.restored.docx`);
  const zip = new AdmZip(maskedBuffer);
  const itemsByPart = groupItemsByPart(mapping.items);

  for (const entry of zip.getEntries()) {
    const replacements = itemsByPart.get(entry.entryName);

    if (!replacements || !shouldProcessPart(entry.entryName)) {
      continue;
    }

    const xml = entry.getData().toString('utf8');
    const updatedXml = restoreXmlPart(xml, replacements);
    zip.updateFile(entry.entryName, Buffer.from(updatedXml, 'utf8'));
  }

  await mkdir(outputDir, {recursive: true});
  const restoredBuffer = zip.toBuffer();
  await writeFile(restoredDocxPath, restoredBuffer);
  logger().info(`Restored ${payload.maskedDocxPath} -> ${restoredDocxPath}; ${mapping.items.length} items`);

  return {
    restoredDocxPath,
    restoredFingerprint: sha256(restoredBuffer),
    itemCount: mapping.items.length,
  };
}

function groupItemsByPart(items: MappingItem[]): Map<string, Replacement[]> {
  const grouped = new Map<string, Replacement[]>();

  for (const item of items) {
    const replacements = grouped.get(item.location.part) ?? [];
    replacements.push({
      token: item.token,
      original: item.original,
    });
    grouped.set(item.location.part, replacements);
  }

  return grouped;
}

function restoreXmlPart(xml: string, replacements: Replacement[]): string {
  const parser = new DOMParser();
  const document = parser.parseFromString(xml, 'application/xml');
  const serializer = new XMLSerializer();
  const paragraphs = Array.from(document.getElementsByTagName('w:p'));

  for (const paragraph of paragraphs) {
    const nodes = Array.from(paragraph.getElementsByTagName('w:t')).map((element) => ({
      element,
      text: element.textContent ?? '',
    }));
    const paragraphText = nodes.map((node) => node.text).join('');

    if (!paragraphText) {
      continue;
    }

    const matches = findTokenMatches(paragraphText, replacements);

    if (matches.length === 0) {
      continue;
    }

    rewriteTextNodes(
      document,
      nodes.map((node, index) => {
        const start = nodes.slice(0, index).reduce((sum, item) => sum + item.text.length, 0);
        return {
          ...node,
          start,
          end: start + node.text.length,
        };
      }),
      paragraphText,
      matches,
    );
  }

  return serializer.serializeToString(document);
}

function findTokenMatches(text: string, replacements: Replacement[]): RestoreMatch[] {
  const matches: RestoreMatch[] = [];

  for (const replacement of replacements) {
    let index = text.indexOf(replacement.token);

    while (index !== -1) {
      matches.push({
        start: index,
        end: index + replacement.token.length,
        original: replacement.original,
      });
      index = text.indexOf(replacement.token, index + replacement.token.length);
    }
  }

  return matches.sort((a, b) => a.start - b.start);
}

function rewriteTextNodes(document: Document, textNodes: TextNodeRef[], fullText: string, matches: RestoreMatch[]): void {
  const starts = new Map(matches.map((match) => [match.start, match]));

  for (const node of textNodes) {
    let output = '';
    let position = node.start;

    while (position < node.end) {
      const startingMatch = starts.get(position);

      if (startingMatch) {
        output += startingMatch.original;
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
