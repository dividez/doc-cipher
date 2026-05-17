import { buildDomTextIndex, sliceGlobalRangeSpans } from './docx-preview-highlights.js';
import { findSearchRanges, type SearchRange } from './docx-preview-search-ranges.js';

export type { SearchRange };
export { findSearchRanges };

export type ApplyPreviewSearchResult = {
  total: number;
  currentIndex: number;
  currentElement: HTMLElement | null;
};

const SEARCH_ATTR = 'data-doccipher-search';

export function clearPreviewSearchMarks(container: HTMLElement): void {
  const marks = container.querySelectorAll(`mark[${SEARCH_ATTR}]`);
  for (const mark of marks) {
    const parent = mark.parentNode;
    if (!parent) {
      continue;
    }
    while (mark.firstChild) {
      parent.insertBefore(mark.firstChild, mark);
    }
    parent.removeChild(mark);
  }
  container.normalize();
}

type SearchSlice = {
  node: Text;
  localStart: number;
  localEnd: number;
  globalStart: number;
  matchIndex: number;
};

function wrapSearchSlice(slice: SearchSlice, isCurrent: boolean): HTMLElement | null {
  if (slice.localStart >= slice.localEnd) {
    return null;
  }

  const textLength = slice.node.length;
  if (slice.localStart < 0 || slice.localEnd > textLength) {
    return null;
  }

  try {
    const range = document.createRange();
    range.setStart(slice.node, slice.localStart);
    range.setEnd(slice.node, slice.localEnd);
    const mark = document.createElement('mark');
    mark.setAttribute(SEARCH_ATTR, 'true');
    mark.className = isCurrent ? 'docx-search-hit docx-search-current' : 'docx-search-hit';
    range.surroundContents(mark);
    return mark;
  } catch {
    return null;
  }
}

function compareSearchSlicesForApplication(a: SearchSlice, b: SearchSlice): number {
  if (a.globalStart !== b.globalStart) {
    return b.globalStart - a.globalStart;
  }
  if (a.localStart !== b.localStart) {
    return b.localStart - a.localStart;
  }
  return b.localEnd - a.localEnd;
}

function normalizeSearchIndex(currentIndex: number, total: number): number {
  if (total === 0) {
    return 0;
  }
  const mod = currentIndex % total;
  return mod < 0 ? mod + total : mod;
}

export function applyPreviewSearch(
  container: HTMLElement,
  query: string,
  currentIndex: number,
  options?: { caseSensitive?: boolean },
): ApplyPreviewSearchResult {
  clearPreviewSearchMarks(container);

  const trimmed = query.trim();
  if (!trimmed) {
    return { total: 0, currentIndex: 0, currentElement: null };
  }

  const { plainText, segments } = buildDomTextIndex(container);
  if (!plainText || segments.length === 0) {
    return { total: 0, currentIndex: 0, currentElement: null };
  }

  const matchRanges = findSearchRanges(plainText, trimmed, options);
  const total = matchRanges.length;
  if (total === 0) {
    return { total: 0, currentIndex: 0, currentElement: null };
  }

  const activeIndex = normalizeSearchIndex(currentIndex, total);
  const matchMarks: HTMLElement[][] = matchRanges.map(() => []);

  const slices: SearchSlice[] = matchRanges.flatMap((range, matchIndex) =>
    sliceGlobalRangeSpans(segments, range.start, range.end).map((slice) => ({
      ...slice,
      matchIndex,
    })),
  );

  slices.sort(compareSearchSlicesForApplication);

  for (const slice of slices) {
    const mark = wrapSearchSlice(slice, slice.matchIndex === activeIndex);
    if (mark) {
      matchMarks[slice.matchIndex]!.push(mark);
    }
  }

  for (let matchIndex = 0; matchIndex < matchMarks.length; matchIndex += 1) {
    if (matchIndex === activeIndex) {
      continue;
    }
    for (const mark of matchMarks[matchIndex]!) {
      mark.className = 'docx-search-hit';
    }
  }

  const currentElement = matchMarks[activeIndex]?.[0] ?? null;

  return {
    total,
    currentIndex: activeIndex,
    currentElement,
  };
}

export function scrollSearchMatchIntoView(element: HTMLElement | null): void {
  element?.scrollIntoView({ block: 'center', behavior: 'smooth' });
}
