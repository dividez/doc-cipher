import type { MaskingRule } from '../schema/settings.schema.js';

export const SYSTEM_KEYWORD_RULE_ID = 'keywords';
export const PROFILE_KEYWORD_RULE_ID = 'profile_keywords';

export const AI_SENSITIVE_RULE_ID = 'ai_sensitive';

export type DocxMatchHitKind = 'regex' | 'system_keyword' | 'profile_keyword' | 'manual' | 'ai';

export function classifyMatchKind(ruleId: string): DocxMatchHitKind {
  if (ruleId === 'manual_selection') {
    return 'manual';
  }
  if (ruleId === AI_SENSITIVE_RULE_ID) {
    return 'ai';
  }
  if (ruleId === SYSTEM_KEYWORD_RULE_ID) {
    return 'system_keyword';
  }
  if (ruleId === PROFILE_KEYWORD_RULE_ID) {
    return 'profile_keyword';
  }
  return 'regex';
}

export function matchKindLabel(kind: DocxMatchHitKind): string {
  switch (kind) {
    case 'regex':
      return '正则规则';
    case 'system_keyword':
      return '系统关键词';
    case 'profile_keyword':
      return '方案关键词';
    case 'manual':
      return '手动划词';
    case 'ai':
      return 'AI 识别';
  }
}

export function extractSystemKeywords(settings: { rules: MaskingRule[] }): string[] {
  const rule = settings.rules.find(
    (item): item is Extract<MaskingRule, { type: 'keyword' }> =>
      item.type === 'keyword' && item.id === SYSTEM_KEYWORD_RULE_ID,
  );
  return rule?.keywords ?? [];
}

export function extractProfileKeywordsFromSettings(settings: { rules: MaskingRule[] }): string[] {
  const rule = settings.rules.find(
    (item): item is Extract<MaskingRule, { type: 'keyword' }> =>
      item.type === 'keyword' && item.id === PROFILE_KEYWORD_RULE_ID,
  );
  return rule?.keywords ?? [];
}
