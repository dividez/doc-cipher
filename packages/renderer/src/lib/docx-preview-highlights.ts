export type PreviewHighlightKind = 'manual' | 'profile' | 'system';

export type PreviewHighlightTerm = {
  kind: PreviewHighlightKind;
  text: string;
};

export type HighlightRange = {
  start: number;
  end: number;
  kind: PreviewHighlightKind;
};

export type DomTextSegment = {
  node: Text;
  start: number;
  end: number;
};

export type DomTextIndex = {
  plainText: string;
  segments: DomTextSegment[];
};

export type DomTextPoint = {
  node: Text;
  offset: number;
};

export type TextNodeSlice = {
  node: Text;
  localStart: number;
  localEnd: number;
  globalStart: number;
};

export type NodeHighlightSlice = TextNodeSlice & {
  kind: PreviewHighlightKind;
};

export type ApplyHighlightResult = {
  applied: number;
  failed: number;
};

const KIND_PRIORITY: Record<PreviewHighlightKind, number> = {
  manual: 3,
  profile: 2,
  system: 1,
};

const HIT_ATTR = 'data-doccipher-hit';

export function highlightKindClassName(kind: PreviewHighlightKind): string {
  switch (kind) {
    case 'manual':
      return 'docx-highlight';
    case 'profile':
      return 'docx-rule-hit docx-rule-hit-profile';
    case 'system':
      return 'docx-rule-hit docx-rule-hit-system';
  }
}

export function buildPreviewHighlightTerms(options: {
  manual: string[];
  profile: string[];
  system: string[];
  systemEnabled: boolean;
}): PreviewHighlightTerm[] {
  const terms: PreviewHighlightTerm[] = [];
  const seen = new Set<string>();

  const addKind = (kind: PreviewHighlightKind, list: string[]) => {
    const sorted = [...list]
      .map((item) => item.trim())
      .filter(Boolean)
      .sort((a, b) => b.length - a.length);

    for (const text of sorted) {
      const key = `${kind}\0${text}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      terms.push({ kind, text });
    }
  };

  addKind('manual', options.manual);
  addKind('profile', options.profile);
  if (options.systemEnabled) {
    addKind('system', options.system);
  }

  return terms;
}

export function mergeHighlightRanges(ranges: HighlightRange[]): HighlightRange[] {
  if (ranges.length === 0) {
    return [];
  }

  const sorted = [...ranges].sort((a, b) => {
    if (a.start !== b.start) {
      return a.start - b.start;
    }
    const priorityDiff = KIND_PRIORITY[b.kind] - KIND_PRIORITY[a.kind];
    if (priorityDiff !== 0) {
      return priorityDiff;
    }
    return b.end - b.start - (a.end - a.start);
  });

  const output: HighlightRange[] = [];

  for (const range of sorted) {
    const dominated = output.some(
      (existing) =>
        range.start < existing.end &&
        range.end > existing.start &&
        KIND_PRIORITY[range.kind] <= KIND_PRIORITY[existing.kind],
    );
    if (dominated) {
      continue;
    }

    for (let index = output.length - 1; index >= 0; index -= 1) {
      const existing = output[index]!;
      if (
        range.start < existing.end &&
        range.end > existing.start &&
        KIND_PRIORITY[range.kind] > KIND_PRIORITY[existing.kind]
      ) {
        output.splice(index, 1);
      }
    }

    output.push(range);
  }

  return output.sort((a, b) => a.start - b.start);
}

export function findGlobalHighlightRanges(
  plainText: string,
  terms: PreviewHighlightTerm[],
): HighlightRange[] {
  const candidates: HighlightRange[] = [];

  for (const term of terms) {
    if (!term.text) {
      continue;
    }
    let index = plainText.indexOf(term.text);
    while (index !== -1) {
      candidates.push({
        start: index,
        end: index + term.text.length,
        kind: term.kind,
      });
      index = plainText.indexOf(term.text, index + term.text.length);
    }
  }

  return mergeHighlightRanges(candidates);
}

/** @deprecated Use findGlobalHighlightRanges */
export const findHighlightRangesInText = findGlobalHighlightRanges;

function isWalkerTextNodeAccepted(node: Text): boolean {
  const parent = node.parentElement;
  if (!parent) {
    return false;
  }
  const tag = parent.tagName;
  if (tag === 'SCRIPT' || tag === 'STYLE') {
    return false;
  }
  const value = node.nodeValue ?? '';
  return value.length > 0;
}

export function buildDomTextIndex(root: HTMLElement): DomTextIndex {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      return isWalkerTextNodeAccepted(node as Text)
        ? NodeFilter.FILTER_ACCEPT
        : NodeFilter.FILTER_REJECT;
    },
  });

  let plainText = '';
  const segments: DomTextSegment[] = [];

  let current = walker.nextNode();
  while (current) {
    const node = current as Text;
    const text = node.nodeValue ?? '';
    if (text) {
      const start = plainText.length;
      plainText += text;
      segments.push({ node, start, end: plainText.length });
    }
    current = walker.nextNode();
  }

  return { plainText, segments };
}

export function resolveGlobalOffset(
  segments: DomTextSegment[],
  offset: number,
): DomTextPoint | null {
  if (segments.length === 0) {
    return null;
  }

  const plainLength = segments[segments.length - 1]!.end;
  if (offset < 0 || offset > plainLength) {
    return null;
  }

  if (offset === plainLength) {
    const last = segments[segments.length - 1]!;
    return {
      node: last.node,
      offset: last.end - last.start,
    };
  }

  for (const segment of segments) {
    if (offset >= segment.start && offset < segment.end) {
      return {
        node: segment.node,
        offset: offset - segment.start,
      };
    }
  }

  return null;
}

export function sliceGlobalRangeSpans(
  segments: DomTextSegment[],
  start: number,
  end: number,
): TextNodeSlice[] {
  if (start >= end) {
    return [];
  }

  const slices: TextNodeSlice[] = [];

  for (const segment of segments) {
    if (segment.end <= start || segment.start >= end) {
      continue;
    }

    const localStart = Math.max(0, start - segment.start);
    const localEnd = Math.min(segment.end - segment.start, end - segment.start);
    if (localStart >= localEnd) {
      continue;
    }

    slices.push({
      node: segment.node,
      localStart,
      localEnd,
      globalStart: segment.start + localStart,
    });
  }

  return slices;
}

export function sliceGlobalRange(
  segments: DomTextSegment[],
  start: number,
  end: number,
  kind: PreviewHighlightKind,
): NodeHighlightSlice[] {
  return sliceGlobalRangeSpans(segments, start, end).map((slice) => ({
    ...slice,
    kind,
  }));
}

export function clearPreviewHighlights(container: HTMLElement): void {
  const marks = container.querySelectorAll(`mark[${HIT_ATTR}]`);
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

function wrapTextNodeRange(
  textNode: Text,
  start: number,
  end: number,
  kind: PreviewHighlightKind,
): boolean {
  if (start >= end) {
    return false;
  }

  const textLength = textNode.length;
  if (start < 0 || end > textLength) {
    return false;
  }

  try {
    const range = document.createRange();
    range.setStart(textNode, start);
    range.setEnd(textNode, end);
    const mark = document.createElement('mark');
    mark.setAttribute(HIT_ATTR, 'true');
    mark.setAttribute('data-kind', kind);
    mark.className = highlightKindClassName(kind);
    range.surroundContents(mark);
    return true;
  } catch {
    return false;
  }
}

function compareSlicesForApplication(a: NodeHighlightSlice, b: NodeHighlightSlice): number {
  if (a.globalStart !== b.globalStart) {
    return b.globalStart - a.globalStart;
  }
  if (a.localStart !== b.localStart) {
    return b.localStart - a.localStart;
  }
  return b.localEnd - a.localEnd;
}

export function applyPreviewHighlights(
  container: HTMLElement,
  terms: PreviewHighlightTerm[],
): ApplyHighlightResult {
  clearPreviewHighlights(container);

  const result: ApplyHighlightResult = { applied: 0, failed: 0 };

  if (terms.length === 0) {
    return result;
  }

  const { plainText, segments } = buildDomTextIndex(container);
  if (!plainText || segments.length === 0) {
    return result;
  }

  const globalRanges = findGlobalHighlightRanges(plainText, terms);
  const slices = globalRanges.flatMap((range) =>
    sliceGlobalRange(segments, range.start, range.end, range.kind),
  );

  slices.sort(compareSlicesForApplication);

  for (const slice of slices) {
    const ok = wrapTextNodeRange(slice.node, slice.localStart, slice.localEnd, slice.kind);
    if (ok) {
      result.applied += 1;
    } else {
      result.failed += 1;
    }
  }

  return result;
}
