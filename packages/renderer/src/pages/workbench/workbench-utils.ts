import {
  PROFILE_KEYWORD_RULE_ID,
  SYSTEM_KEYWORD_RULE_ID,
  type Settings as AppSettings,
  type AppSettingsConfig,
  type KeywordRule,
  type ManualKeyword,
  type ManualRule,
  type MaskingRule,
} from '@app/shared';

export const LEGACY_PROFILE_MANUAL_RULE_ID = 'manual_profile';

export function fileName(path: string): string {
  return path.split(/[/\\]/).pop() ?? path;
}

export function formatError(error: unknown): string {
  return error instanceof Error ? error.message : '操作失败';
}

export function dedupeKeywordDraftLines(value: string): string {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const line of value.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || seen.has(t)) {
      continue;
    }
    seen.add(t);
    out.push(t);
  }
  return out.join('\n');
}

export function buildSettingsWithProfileKeywords(
  settings: AppSettings,
  manualKeywords: ManualKeyword[],
  keywordInput: string,
): AppSettings {
  const keywords = Array.from(
    new Set(
      [
        ...extractProfileKeywords(settings),
        ...parseKeywordLines(keywordInput),
        ...manualKeywords.flatMap((keyword) =>
          keyword.text
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter(Boolean),
        ),
      ].filter(Boolean),
    ),
  ).filter(Boolean);

  const otherRules = settings.rules.filter(
    (rule) => rule.id !== PROFILE_KEYWORD_RULE_ID && rule.id !== LEGACY_PROFILE_MANUAL_RULE_ID,
  );

  if (keywords.length === 0) {
    return {
      ...settings,
      rules: otherRules,
    };
  }

  const nextKeywordRule: KeywordRule = {
    id: PROFILE_KEYWORD_RULE_ID,
    name: '方案关键词',
    type: 'keyword',
    enabled: true,
    keywords,
    placeholder: '[KEYWORD_{n}]',
  };

  return {
    ...settings,
    rules: [...otherRules, nextKeywordRule],
  };
}

export function extractProfileKeywords(settings?: AppSettings): string[] {
  if (!settings) {
    return [];
  }

  const keywordRule = settings.rules.find(
    (rule): rule is KeywordRule => rule.type === 'keyword' && rule.id === PROFILE_KEYWORD_RULE_ID,
  );
  const legacyManualRule = settings.rules.find(
    (rule): rule is ManualRule =>
      rule.type === 'manual' && rule.id === LEGACY_PROFILE_MANUAL_RULE_ID,
  );

  return Array.from(
    new Set([...(keywordRule?.keywords ?? []), ...(legacyManualRule?.selections ?? [])]),
  ).filter(Boolean);
}

export function parseKeywordLines(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function compactText(text: string, maxLength: number): string {
  const normalized = text.replace(/\s+/g, ' ').trim();
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength)}...` : normalized;
}

export function formatRecentTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

export function withGlobalAppConfig(settings: AppSettings, app: AppSettingsConfig): AppSettings {
  return {
    ...settings,
    app,
  };
}

export function filterExecutableRules(
  settings: AppSettings,
  app: AppSettingsConfig,
): MaskingRule[] {
  return settings.rules.filter((rule) => {
    if (!rule.enabled) {
      return false;
    }
    if (rule.type === 'regex' && !app.enable_regex_rules) {
      return false;
    }
    if (
      rule.type === 'keyword' &&
      rule.id === SYSTEM_KEYWORD_RULE_ID &&
      !app.enable_system_keywords
    ) {
      return false;
    }
    return true;
  });
}

export function ruleTypeLabel(rule: MaskingRule): string {
  if (rule.type === 'regex') {
    return '正则匹配';
  }
  if (rule.type === 'keyword') {
    return '关键词匹配';
  }
  return '手动项';
}

export function taskKeywordSourceLabel(source?: ManualKeyword['source']): string {
  return source === 'ai' ? 'AI' : '划词';
}

export function getDroppedPath(file: File, getPathForFile: (file: File) => string): string | null {
  const path = getPathForFile(file).trim();
  return path.length > 0 ? path : null;
}
