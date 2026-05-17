import AdmZip from 'adm-zip';
import { DOMParser } from '@xmldom/xmldom';
import type { Element as XmlElement } from '@xmldom/xmldom';
import type {
  DocxMatchHit,
  DocxMatchPreviewPayload,
  DocxMatchPreviewResult,
  DocxMatchPreviewSample,
  DocxZeroHitRule,
} from '@app/shared';
import { classifyMatchKind, settingsSchema } from '@app/shared';
import { shouldProcessPart } from './docx-parts.js';
import {
  findMatches,
  localManualSelectionsForParagraph,
  selectMatches,
} from './docx-mask.service.js';

const MAX_SAMPLES = 40;
const SNIPPET_LEN = 48;

export async function previewDocxMatches(
  payload: DocxMatchPreviewPayload,
): Promise<DocxMatchPreviewResult> {
  const settings = settingsSchema.parse(payload.settings);
  const manualSelections = payload.manualSelections ?? [];
  const zip = new AdmZip(payload.filePath);
  const hitByRule = new Map<
    string,
    { name: string; kind: ReturnType<typeof classifyMatchKind>; count: number }
  >();
  let manualHits = 0;
  let paragraphCount = 0;
  const samples: DocxMatchPreviewSample[] = [];
  const hits: DocxMatchHit[] = [];

  const ruleById = new Map(settings.rules.map((r) => [r.id, r]));

  const pushSample = (
    ruleId: string,
    kind: ReturnType<typeof classifyMatchKind>,
    original: string,
  ) => {
    if (samples.length >= MAX_SAMPLES) {
      return;
    }
    const rule = ruleById.get(ruleId);
    const snippet =
      original.length <= SNIPPET_LEN ? original : `${original.slice(0, SNIPPET_LEN)}…`;
    samples.push({
      ruleId,
      ruleName: ruleId === 'manual_selection' ? '手动划词' : (rule?.name ?? ruleId),
      kind,
      snippet,
    });
  };

  const addRuleHit = (
    ruleId: string,
    partName: string,
    blockIndex: number,
    start: number,
    end: number,
    original: string,
  ) => {
    const kind = classifyMatchKind(ruleId);
    const rule = ruleById.get(ruleId);
    const name = ruleId === 'manual_selection' ? '手动划词' : (rule?.name ?? ruleId);
    const prev = hitByRule.get(ruleId) ?? { name, kind, count: 0 };
    hitByRule.set(ruleId, { name, kind, count: prev.count + 1 });
    hits.push({ partName, blockIndex, start, end, ruleId, kind });
    if (ruleId === 'manual_selection') {
      manualHits += 1;
    }
    pushSample(ruleId, kind, original);
  };

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

    for (const [blockIndex, paragraph] of paragraphs.entries()) {
      const paragraphText = collectParagraphPlainText(paragraph);
      if (!paragraphText) {
        continue;
      }
      paragraphCount += 1;

      const locals = localManualSelectionsForParagraph(
        manualSelections,
        entry.entryName,
        blockIndex,
        paragraphText,
      );
      const selected = selectMatches(findMatches(paragraphText, settings, locals));

      for (const match of selected) {
        addRuleHit(
          match.ruleId,
          entry.entryName,
          blockIndex,
          match.start,
          match.end,
          match.original,
        );
      }
    }
  }

  const ruleHits = [...hitByRule.entries()]
    .map(([ruleId, v]) => ({
      ruleId,
      ruleName: v.name,
      kind: v.kind,
      count: v.count,
    }))
    .sort((a, b) => b.count - a.count);

  const totalHits = ruleHits.reduce((sum, r) => sum + r.count, 0);

  const zeroHitRules: DocxZeroHitRule[] = settings.rules
    .filter((r) => r.enabled && (hitByRule.get(r.id)?.count ?? 0) === 0)
    .map((r) => ({
      ruleId: r.id,
      ruleName: r.name,
      kind: classifyMatchKind(r.id),
    }));

  return {
    filePath: payload.filePath,
    paragraphCount,
    totalHits,
    manualSelectionHits: manualHits,
    ruleHits,
    hits,
    zeroHitRules,
    samples,
  };
}

function collectParagraphPlainText(paragraph: XmlElement): string {
  return Array.from(paragraph.getElementsByTagName('w:t'))
    .map((element) => element.textContent ?? '')
    .join('');
}
