import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPreviewHighlightTerms,
  findGlobalHighlightRanges,
  mergeHighlightRanges,
  sliceGlobalRange,
  type DomTextSegment,
} from './docx-preview-highlights.ts';

describe('buildPreviewHighlightTerms', () => {
  it('dedupes and respects systemEnabled', () => {
    const terms = buildPreviewHighlightTerms({
      manual: ['甲', '甲'],
      profile: ['乙'],
      system: ['丙'],
      systemEnabled: false,
    });
    assert.equal(terms.length, 2);
    assert.ok(terms.some((t) => t.kind === 'manual' && t.text === '甲'));
    assert.ok(terms.some((t) => t.kind === 'profile' && t.text === '乙'));
    assert.ok(!terms.some((t) => t.kind === 'system'));
  });

  it('includes recognized texts when provided', () => {
    const terms = buildPreviewHighlightTerms({
      manual: [],
      profile: [],
      system: [],
      systemEnabled: true,
      recognized: ['识别词'],
    });
    assert.ok(terms.some((t) => t.kind === 'recognized' && t.text === '识别词'));
  });
});

describe('mergeHighlightRanges', () => {
  it('prefers manual over profile on overlap', () => {
    const merged = mergeHighlightRanges([
      { start: 0, end: 4, kind: 'profile' },
      { start: 0, end: 2, kind: 'manual' },
    ]);
    assert.equal(merged.length, 1);
    assert.equal(merged[0]?.kind, 'manual');
  });
});

describe('findGlobalHighlightRanges', () => {
  it('finds multiple non-overlapping matches', () => {
    const ranges = findGlobalHighlightRanges('foo bar foo', [{ kind: 'system', text: 'foo' }]);
    assert.equal(ranges.length, 2);
    assert.deepEqual(ranges[0], { start: 0, end: 3, kind: 'system' });
    assert.deepEqual(ranges[1], { start: 8, end: 11, kind: 'system' });
  });
});

describe('sliceGlobalRange', () => {
  it('splits a cross-segment match into per-node slices', () => {
    const nodeA = { length: 1 } as Text;
    const nodeB = { length: 1 } as Text;
    const segments: DomTextSegment[] = [
      { node: nodeA, start: 0, end: 1 },
      { node: nodeB, start: 1, end: 2 },
    ];

    const slices = sliceGlobalRange(segments, 0, 2, 'manual');
    assert.equal(slices.length, 2);
    assert.deepEqual(slices[0], {
      node: nodeA,
      localStart: 0,
      localEnd: 1,
      kind: 'manual',
      globalStart: 0,
    });
    assert.deepEqual(slices[1], {
      node: nodeB,
      localStart: 0,
      localEnd: 1,
      kind: 'manual',
      globalStart: 1,
    });
  });
});
