import type { Settings } from '@app/shared';
import { findMatches, selectMatches } from './docx-mask.service.js';
import { aiDetectToPendingMatches, isAiAssistEnabled } from '../ai/ai-detect.service.js';
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
  maxAiParagraphs?: number;
  paragraphIndex?: number;
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
  const rulePending = findMatches(paragraphText, settings, manualKeywords);
  const useAi =
    (options.aiAssist ?? isAiAssistEnabled(settings)) && (await getActiveModelGgufPath()) !== null;

  let aiPending: PendingMatch[] = [];
  if (useAi && aiParagraphBudget > 0) {
    aiParagraphBudget -= 1;
    aiPending = await aiDetectToPendingMatches(paragraphText, settings);
  }

  return selectMatches([...rulePending, ...aiPending]);
}
