import type { ManualKeyword } from '../types/tasks.js';

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
