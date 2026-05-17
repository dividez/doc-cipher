import type { DocxManualSelection, DocxManualSegment } from '../types/tasks.js';

export function expandManualSegments(selection: DocxManualSelection): DocxManualSegment[] {
  if (selection.segments && selection.segments.length > 0) {
    return selection.segments;
  }
  return [
    {
      partName: selection.partName,
      blockIndex: selection.blockIndex,
      start: selection.start,
      end: selection.end,
    },
  ];
}

export function manualSelectionsOverlap(a: DocxManualSelection, b: DocxManualSelection): boolean {
  const segsA = expandManualSegments(a);
  const segsB = expandManualSegments(b);
  for (const x of segsA) {
    for (const y of segsB) {
      if (
        x.partName === y.partName &&
        x.blockIndex === y.blockIndex &&
        x.start < y.end &&
        y.start < x.end
      ) {
        return true;
      }
    }
  }
  return false;
}
