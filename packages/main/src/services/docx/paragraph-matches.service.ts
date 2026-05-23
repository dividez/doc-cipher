import type { Settings } from '@app/shared';
import { findMatches, selectMatches } from './docx-mask.service.js';
import { aiDetectToPendingMatches, type AiDetectOptions } from '../ai/ai-detect.service.js';
import { isAiMaskCancelled } from '../ai/ai-mask-task.service.js';
import { getActiveModelGgufPath } from '../ai/model-manager.service.js';

type PendingMatch = {
  start: number;
  end: number;
  original: string;
  ruleId: string;
  order: number;
};

export type CollectParagraphMatchesOptions = {
  aiAssist?: boolean;
  /** 仅规则与备选词，不调用 AI */
  rulesOnly?: boolean;
  /** 仅 AI 滑窗（补充识别） */
  aiOnly?: boolean;
  maxAiParagraphs?: number;
  paragraphIndex?: number;
  aiDetect?: AiDetectOptions;
};

let aiParagraphBudget = 0;

export function resetAiParagraphBudget(max?: number): void {
  aiParagraphBudget = max ?? Number.POSITIVE_INFINITY;
}

export async function collectParagraphMatches(
  paragraphText: string,
  settings: Settings,
  manualKeywords: string[],
  options: CollectParagraphMatchesOptions = {},
): Promise<PendingMatch[]> {
  const useAi =
    options.aiAssist === true &&
    !options.rulesOnly &&
    !isAiMaskCancelled() &&
    (await getActiveModelGgufPath()) !== null;

  if (options.aiOnly) {
    if (!useAi || aiParagraphBudget <= 0) {
      return [];
    }
    aiParagraphBudget -= 1;
    const aiPending = await aiDetectToPendingMatches(paragraphText, settings, options.aiDetect);
    return selectMatches(aiPending);
  }

  const rulePending = findMatches(paragraphText, settings, manualKeywords);

  if (!useAi || aiParagraphBudget <= 0) {
    return selectMatches(rulePending);
  }

  aiParagraphBudget -= 1;
  const aiPending = await aiDetectToPendingMatches(paragraphText, settings, options.aiDetect);
  return selectMatches([...rulePending, ...aiPending]);
}
