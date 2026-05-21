export type OverlapMatchSpan = {
  start: number;
  end: number;
  order: number;
};

/**
 * 重叠消解：先收集全部候选（findMatches），再贪心选取互不重叠区间，最后统一 replace。
 * 策略：最长优先；同长取更左（start 更小）；同起点按发现顺序（order）。
 * 每段字符最多一个 token，不允许嵌套/重叠替换。
 */
export function selectNonOverlappingMatches<T extends OverlapMatchSpan>(matches: T[]): T[] {
  const selected: T[] = [];

  for (const match of [...matches].sort(compareMatchesForOverlapResolve)) {
    if (selected.some((item) => rangesOverlap(item, match))) {
      continue;
    }

    selected.push(match);
  }

  return selected.sort((a, b) => a.start - b.start);
}

function compareMatchesForOverlapResolve<T extends OverlapMatchSpan>(a: T, b: T): number {
  const lengthDiff = b.end - b.start - (a.end - a.start);
  if (lengthDiff !== 0) {
    return lengthDiff;
  }
  if (a.start !== b.start) {
    return a.start - b.start;
  }
  return a.order - b.order;
}

/** 半开区间 [start, end) 是否相交 */
function rangesOverlap<T extends OverlapMatchSpan>(a: T, b: T): boolean {
  return a.start < b.end && b.start < a.end;
}
