import type { DocxMatchHit, ManualKeyword } from '../types/tasks.js';

export function manualKeywordTexts(keywords: ManualKeyword[]): string[] {
  return keywords.map((item) => item.text.trim()).filter(Boolean);
}

export function hasDuplicateManualKeyword(keywords: ManualKeyword[], text: string): boolean {
  const normalized = text.trim();
  if (!normalized) {
    return false;
  }
  return keywords.some((item) => item.text.trim() === normalized);
}

/** 从识别快照中提取 AI 命中原文（去重） */
export function extractAiKeywordTextsFromHits(hits: DocxMatchHit[]): string[] {
  const seen = new Set<string>();
  const texts: string[] = [];
  for (const hit of hits) {
    if (hit.kind !== 'ai') {
      continue;
    }
    const text = hit.text?.trim();
    if (!text || seen.has(text)) {
      continue;
    }
    seen.add(text);
    texts.push(text);
  }
  return texts;
}

export function mergeAiKeywordsIntoCandidates(
  current: ManualKeyword[],
  aiTexts: string[],
): ManualKeyword[] {
  if (aiTexts.length === 0) {
    return current;
  }
  let next = [...current];
  for (const text of aiTexts) {
    if (hasDuplicateManualKeyword(next, text)) {
      continue;
    }
    next = [
      ...next,
      {
        id: `ai-${Date.now()}-${next.length}`,
        text,
        source: 'ai',
      },
    ];
  }
  return next;
}

/** 脱敏时仅保留仍留在备选列表中的划词 / AI 命中 */
export function filterRecognizedHitsByCandidates(
  hits: DocxMatchHit[],
  candidates: ManualKeyword[],
): DocxMatchHit[] {
  const candidateTexts = new Set(manualKeywordTexts(candidates));
  return hits.filter((hit) => {
    if (hit.kind === 'ai' || hit.kind === 'manual') {
      const text = hit.text?.trim();
      return Boolean(text && candidateTexts.has(text));
    }
    return true;
  });
}
