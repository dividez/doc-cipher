export type PreviewHighlightKind = 'manual' | 'rule' | 'search';

export type PreviewHighlightRange = {
  start: number;
  end: number;
  kind: PreviewHighlightKind;
  ruleKind?: 'system_keyword' | 'profile_keyword' | 'regex' | 'manual';
  selectionId?: string;
  searchIndex?: number;
};

const KIND_PRIORITY: Record<PreviewHighlightKind, number> = {
  manual: 3,
  rule: 2,
  search: 1,
};

export function mergePreviewHighlightRanges(
  textLength: number,
  ranges: PreviewHighlightRange[],
): PreviewHighlightRange[] {
  if (ranges.length === 0 || textLength === 0) {
    return [];
  }

  const points = new Set<number>([0, textLength]);
  for (const range of ranges) {
    const start = Math.max(0, Math.min(range.start, textLength));
    const end = Math.max(start, Math.min(range.end, textLength));
    if (start < end) {
      points.add(start);
      points.add(end);
    }
  }

  const sortedPoints = [...points].sort((a, b) => a - b);
  const merged: PreviewHighlightRange[] = [];

  for (let i = 0; i < sortedPoints.length - 1; i += 1) {
    const start = sortedPoints[i]!;
    const end = sortedPoints[i + 1]!;
    if (start >= end) {
      continue;
    }

    const covering = ranges.filter((r) => r.start < end && r.end > start);
    if (covering.length === 0) {
      continue;
    }

    covering.sort((a, b) => KIND_PRIORITY[b.kind] - KIND_PRIORITY[a.kind]);
    const winner = covering[0]!;
    const last = merged[merged.length - 1];
    if (
      last &&
      last.kind === winner.kind &&
      last.ruleKind === winner.ruleKind &&
      last.selectionId === winner.selectionId &&
      last.searchIndex === winner.searchIndex &&
      last.end === start
    ) {
      last.end = end;
    } else {
      merged.push({ ...winner, start, end });
    }
  }

  return merged;
}

export function findSearchRanges(
  text: string,
  query: string,
): Array<{ start: number; end: number }> {
  const q = query.trim();
  if (!q) {
    return [];
  }
  const lower = text.toLowerCase();
  const needle = q.toLowerCase();
  const ranges: Array<{ start: number; end: number }> = [];
  let from = 0;
  while (from < lower.length) {
    const index = lower.indexOf(needle, from);
    if (index < 0) {
      break;
    }
    ranges.push({ start: index, end: index + needle.length });
    from = index + 1;
  }
  return ranges;
}
