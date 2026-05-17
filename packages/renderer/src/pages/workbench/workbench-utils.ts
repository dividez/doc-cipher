import {
  expandManualSegments,
  PROFILE_KEYWORD_RULE_ID,
  SYSTEM_KEYWORD_RULE_ID,
  type Settings as AppSettings,
  type AppSettingsConfig,
  type DocxManualSegment,
  type DocxManualSelection,
  type DocxPreviewResult,
  type DocxStructureHint,
  type DocxTextBlock,
  type KeywordRule,
  type ManualRule,
  type MaskingRule,
} from '@app/shared';
import type { ManualSelectionDraft } from './types.js';

export const LEGACY_PROFILE_MANUAL_RULE_ID = 'manual_profile';

export function fileName(path: string): string {
  return path.split(/[/\\]/).pop() ?? path;
}

export function formatError(error: unknown): string {
  return error instanceof Error ? error.message : '操作失败';
}

export function buildDraftFromPreviewSelection(
  preview: DocxPreviewResult,
  start: { blockId: string; offset: number },
  end: { blockId: string; offset: number },
): ManualSelectionDraft | null {
  let i0 = preview.blocks.findIndex((b) => b.id === start.blockId);
  let i1 = preview.blocks.findIndex((b) => b.id === end.blockId);
  if (i0 < 0 || i1 < 0) {
    return null;
  }
  let off0 = start.offset;
  let off1 = end.offset;
  if (i0 > i1 || (i0 === i1 && off0 > off1)) {
    const ti = i0;
    i0 = i1;
    i1 = ti;
    const toff = off0;
    off0 = off1;
    off1 = toff;
  }

  const segments: DocxManualSegment[] = [];
  const textParts: string[] = [];

  for (let i = i0; i <= i1; i += 1) {
    const block = preview.blocks[i]!;
    const segStart = i === i0 ? off0 : 0;
    const segEnd = i === i1 ? off1 : block.text.length;
    if (segStart >= segEnd) {
      continue;
    }
    const slice = block.text.slice(segStart, segEnd);
    const lead = slice.match(/^\s*/)?.[0].length ?? 0;
    const trail = slice.match(/\s*$/)?.[0].length ?? 0;
    const ns = segStart + lead;
    const ne = segEnd - trail;
    if (ns >= ne) {
      continue;
    }
    segments.push({
      partName: block.partName,
      blockIndex: block.blockIndex,
      start: ns,
      end: ne,
    });
    textParts.push(block.text.slice(ns, ne));
  }

  if (segments.length === 0) {
    return null;
  }

  const text = textParts.join('\n');
  const first = segments[0]!;
  return {
    partName: first.partName,
    blockIndex: first.blockIndex,
    start: first.start,
    end: first.end,
    text,
    segments,
  };
}

export function manualDraftsMatch(a: ManualSelectionDraft, b: ManualSelectionDraft): boolean {
  const sa = expandManualSegments({ ...a, id: '_a' } as DocxManualSelection);
  const sb = expandManualSegments({ ...b, id: '_b' } as DocxManualSelection);
  if (sa.length !== sb.length) {
    return false;
  }
  return sa.every((s, i) => {
    const t = sb[i]!;
    return (
      s.partName === t.partName &&
      s.blockIndex === t.blockIndex &&
      s.start === t.start &&
      s.end === t.end
    );
  });
}

export function blockLocalRanges(
  block: DocxTextBlock,
  selections: DocxManualSelection[],
): Array<{ selection: DocxManualSelection; start: number; end: number }> {
  return selections.flatMap((selection) =>
    expandManualSegments(selection)
      .filter((s) => s.partName === block.partName && s.blockIndex === block.blockIndex)
      .map((s) => ({ selection, start: s.start, end: s.end })),
  );
}

export function structureRegionLabel(region: DocxStructureHint['region']): string {
  const labels: Record<DocxStructureHint['region'], string> = {
    body: '正文',
    header: '页眉',
    footer: '页脚',
    footnote: '脚注',
    endnote: '尾注',
    comment: '批注',
  };
  return labels[region] ?? region;
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

export function resolveSelectionPoint(
  node: Node,
  offset: number,
): { blockId: string; offset: number } | null {
  const element = node.nodeType === Node.TEXT_NODE ? node.parentElement : (node as Element);
  const segment = element?.closest<HTMLElement>('[data-segment-start]');
  const block = element?.closest<HTMLElement>('[data-block-id]');
  const blockId = block?.dataset.blockId;
  const segmentStart = Number(segment?.dataset.segmentStart ?? 0);

  if (!blockId || Number.isNaN(segmentStart)) {
    return null;
  }

  return {
    blockId,
    offset: segmentStart + offset,
  };
}

export function buildSettingsWithProfileKeywords(
  settings: AppSettings,
  selections: DocxManualSelection[],
  keywordInput: string,
): AppSettings {
  const keywords = Array.from(
    new Set(
      [
        ...extractProfileKeywords(settings),
        ...parseKeywordLines(keywordInput),
        ...selections.flatMap((selection) =>
          selection.text
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

export function getDroppedPath(file: File): string | null {
  const electronFile = file as File & { path?: string };
  return electronFile.path ?? null;
}
