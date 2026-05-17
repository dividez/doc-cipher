import AdmZip from 'adm-zip';
import { DOMParser } from '@xmldom/xmldom';
import type { Element as XmlElement } from '@xmldom/xmldom';
import type {
  DocxPreviewPayload,
  DocxPreviewResult,
  DocxStructureHint,
  DocxTextBlock,
} from '@app/shared';
import { shouldProcessPart } from './docx-parts.js';

export async function previewDocx(payload: DocxPreviewPayload): Promise<DocxPreviewResult> {
  const zip = new AdmZip(payload.filePath);
  const blocks: DocxTextBlock[] = [];

  for (const entry of zip.getEntries()) {
    if (!shouldProcessPart(entry.entryName)) {
      continue;
    }

    const xml = entry.getData().toString('utf8');
    blocks.push(...extractTextBlocks(xml, entry.entryName));
  }

  return {
    filePath: payload.filePath,
    blocks,
    blockCount: blocks.length,
    charCount: blocks.reduce((sum, block) => sum + block.text.length, 0),
  };
}

function regionFromPart(partName: string): DocxStructureHint['region'] {
  if (partName === 'word/document.xml') {
    return 'body';
  }
  if (/^word\/header\d*\.xml$/i.test(partName)) {
    return 'header';
  }
  if (/^word\/footer\d*\.xml$/i.test(partName)) {
    return 'footer';
  }
  if (partName === 'word/footnotes.xml') {
    return 'footnote';
  }
  if (partName === 'word/endnotes.xml') {
    return 'endnote';
  }
  if (partName === 'word/comments.xml') {
    return 'comment';
  }
  return 'body';
}

function isUnderTable(element: XmlElement): boolean {
  let current: XmlElement | null = element;
  while (current) {
    const tag = current.tagName ?? '';
    if (tag === 'w:tbl' || tag.endsWith(':tbl')) {
      return true;
    }
    current = current.parentNode as XmlElement | null;
  }
  return false;
}

function extractTextBlocks(xml: string, partName: string): DocxTextBlock[] {
  const parser = new DOMParser({
    onError: (level, message) => {
      if (level === 'fatalError') {
        throw new Error(`无法解析 ${partName}: ${message}`);
      }
    },
  });
  const document = parser.parseFromString(xml, 'application/xml');
  const paragraphs = Array.from(document.getElementsByTagName('w:p'));
  const region = regionFromPart(partName);

  return paragraphs.flatMap((paragraph, blockIndex) => {
    const text = collectParagraphText(paragraph);
    if (!text.trim()) {
      return [];
    }

    return [
      {
        id: `${partName}:${blockIndex}`,
        partName,
        blockIndex,
        text,
        structure: {
          region,
          inTable: isUnderTable(paragraph),
        },
      },
    ];
  });
}

function collectParagraphText(paragraph: XmlElement): string {
  return Array.from(paragraph.getElementsByTagName('w:t'))
    .map((element) => element.textContent ?? '')
    .join('');
}
