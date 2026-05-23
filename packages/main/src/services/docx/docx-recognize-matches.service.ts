import AdmZip from 'adm-zip';
import { DOMParser } from '@xmldom/xmldom';
import type { Element as XmlElement } from '@xmldom/xmldom';
import type {
  DocxMatchHit,
  DocxMatchPreviewResult,
  DocxMatchPreviewSample,
  DocxRecognizeMatchesPayload,
  DocxZeroHitRule,
} from '@app/shared';
import {
  RECOGNITION_CANCELLED_MESSAGE,
  classifyMatchKind,
  extractAiKeywordTextsFromHits,
  isLocalAiBundled,
  settingsSchema,
} from '@app/shared';
import type { AiDetectOptions } from '../ai/ai-detect.service.js';
import { estimateDocxInference } from '../ai/ai-estimate.service.js';
import {
  beginMaskTask,
  emitAiMaskProgress,
  emitAiRecognizeLog,
  endMaskTask,
  getMaskTaskSignal,
  isAiMaskCancelled,
} from '../ai/ai-mask-task.service.js';
import { getActiveModelGgufPath } from '../ai/model-manager.service.js';
import { shouldProcessPart } from './docx-parts.js';
import { collectParagraphMatches, resetAiParagraphBudget } from './paragraph-matches.service.js';

const MAX_SAMPLES = 40;
const SNIPPET_LEN = 48;

export async function recognizeDocxMatches(
  payload: DocxRecognizeMatchesPayload,
): Promise<DocxMatchPreviewResult> {
  const settings = settingsSchema.parse(payload.settings);
  const manualKeywords = payload.manualKeywords ?? [];
  const aiSupplementOnly = payload.aiSupplementOnly === true;
  const hasActiveModel = (await getActiveModelGgufPath()) !== null;
  const useLocalAi =
    isLocalAiBundled() && hasActiveModel && (aiSupplementOnly || payload.useLocalAi === true);

  resetAiParagraphBudget(Number.POSITIVE_INFINITY);

  let doneWindows = 0;
  let totalWindows = 0;
  let aiDetect: AiDetectOptions | undefined;

  if (useLocalAi) {
    emitAiRecognizeLog({ type: 'status', message: '开始 AI 辅助识别…' });
    const estimate = await estimateDocxInference(payload.filePath);
    totalWindows = estimate.totalWindows;
    const signal = beginMaskTask();
    emitAiMaskProgress({ doneWindows: 0, totalWindows, phase: 'recognize' });
    let globalWindow = 0;
    aiDetect = {
      signal,
      onWindowOutput: ({ rawContent, entityCount }) => {
        globalWindow += 1;
        emitAiRecognizeLog({
          type: 'window_raw',
          windowIndex: globalWindow,
          totalWindows,
          message: rawContent,
        });
        emitAiRecognizeLog({
          type: 'status',
          message: `窗口 ${globalWindow}/${totalWindows} 完成，解析到 ${entityCount} 个实体`,
          windowIndex: globalWindow,
          totalWindows,
        });
      },
      onWindowComplete: () => {
        doneWindows += 1;
        emitAiMaskProgress({ doneWindows, totalWindows, phase: 'recognize' });
      },
    };
  }

  try {
    const result = await scanDocxMatches(payload.filePath, settings, manualKeywords, {
      aiAssist: useLocalAi,
      aiDetect,
      rulesOnly: !useLocalAi,
      aiOnly: aiSupplementOnly,
    });
    if (useLocalAi) {
      const aiKeywordCount = extractAiKeywordTextsFromHits(result.hits).length;
      emitAiRecognizeLog({
        type: 'done',
        message: `识别完成：AI 备选词 ${aiKeywordCount} 个，总命中 ${result.totalHits} 处。请关闭此窗口后继续操作。`,
      });
    }
    return result;
  } catch (error) {
    if (getMaskTaskSignal()?.aborted || isAiMaskCancelled()) {
      emitAiRecognizeLog({ type: 'error', message: RECOGNITION_CANCELLED_MESSAGE });
      throw new Error(RECOGNITION_CANCELLED_MESSAGE);
    }
    if (useLocalAi) {
      const message = error instanceof Error ? error.message : String(error);
      emitAiRecognizeLog({ type: 'error', message });
    }
    throw error;
  } finally {
    if (useLocalAi) {
      endMaskTask();
    }
  }
}

async function scanDocxMatches(
  filePath: string,
  settings: ReturnType<typeof settingsSchema.parse>,
  manualKeywords: string[],
  options: {
    aiAssist: boolean;
    aiDetect?: AiDetectOptions;
    rulesOnly?: boolean;
    aiOnly?: boolean;
  },
): Promise<DocxMatchPreviewResult> {
  const zip = new AdmZip(filePath);
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
    hits.push({ partName, blockIndex, start, end, ruleId, kind, text: original });
    if (ruleId === 'manual_selection') {
      manualHits += 1;
    }
    pushSample(ruleId, kind, original);
  };

  for (const entry of zip.getEntries()) {
    if (!shouldProcessPart(entry.entryName)) {
      continue;
    }

    getMaskTaskSignal()?.throwIfAborted();

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
      getMaskTaskSignal()?.throwIfAborted();

      const paragraphText = collectParagraphPlainText(paragraph);
      if (!paragraphText) {
        continue;
      }
      paragraphCount += 1;

      const selected = await collectParagraphMatches(paragraphText, settings, manualKeywords, {
        aiAssist: options.aiAssist,
        aiDetect: options.aiDetect,
        rulesOnly: options.rulesOnly,
        aiOnly: options.aiOnly,
      });

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
    filePath,
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
