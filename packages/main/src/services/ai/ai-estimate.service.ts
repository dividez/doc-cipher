import AdmZip from 'adm-zip';
import { DOMParser } from '@xmldom/xmldom';
import type { Element as XmlElement } from '@xmldom/xmldom';
import type { AiInferenceEstimate } from '@app/shared';
import { shouldProcessPart } from '../docx/docx-parts.js';
import { countWindows, estimateInferenceSeconds } from './ai-window.util.js';

export async function estimateDocxInference(filePath: string): Promise<AiInferenceEstimate> {
  const zip = new AdmZip(filePath);
  let paragraphCount = 0;
  let totalWindows = 0;

  for (const entry of zip.getEntries()) {
    if (!shouldProcessPart(entry.entryName)) {
      continue;
    }

    const xml = entry.getData().toString('utf8');
    const parser = new DOMParser({
      onError: (level, message) => {
        if (level === 'fatalError') {
          throw new Error(`无法解析 ${entry.entryName}: ${message}`);
        }
      },
    });
    const document = parser.parseFromString(xml, 'application/xml');
    const paragraphs = Array.from(document.getElementsByTagName('w:p'));

    for (const paragraph of paragraphs) {
      const paragraphText = collectParagraphPlainText(paragraph);
      if (!paragraphText) {
        continue;
      }
      paragraphCount += 1;
      totalWindows += countWindows(paragraphText.length);
    }
  }

  const { estimatedSecondsMin, estimatedSecondsMax } = estimateInferenceSeconds(totalWindows);

  return {
    filePath,
    paragraphCount,
    totalWindows,
    estimatedSecondsMin,
    estimatedSecondsMax,
  };
}

function collectParagraphPlainText(paragraph: XmlElement): string {
  return Array.from(paragraph.getElementsByTagName('w:t'))
    .map((element) => element.textContent ?? '')
    .join('');
}
