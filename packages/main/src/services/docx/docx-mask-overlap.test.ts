import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { selectNonOverlappingMatches } from './match-overlap.ts';

type TestMatch = {
  start: number;
  end: number;
  original: string;
  ruleId: string;
  order: number;
};

function makeMatch(start: number, end: number, original: string, order: number): TestMatch {
  return {
    start,
    end,
    original,
    ruleId: 'manual_selection',
    order,
  };
}

describe('selectNonOverlappingMatches', () => {
  it('keeps left match when same length overlaps (租赁 vs 赁期)', () => {
    const selected = selectNonOverlappingMatches([
      makeMatch(0, 2, '租赁', 0),
      makeMatch(1, 3, '赁期', 1),
    ]);
    assert.equal(selected.length, 1);
    assert.equal(selected[0]?.original, '租赁');
    assert.equal(selected[0]?.start, 0);
    assert.equal(selected[0]?.end, 2);
  });

  it('prefers longer match when overlaps (length DESC)', () => {
    const selected = selectNonOverlappingMatches([
      makeMatch(0, 2, 'ab', 0),
      makeMatch(1, 9, 'bcdefgh', 1),
    ]);
    assert.equal(selected.length, 1);
    assert.equal(selected[0]?.start, 1);
    assert.equal(selected[0]?.end, 9);
    assert.equal(selected[0]?.original, 'bcdefgh');
  });

  it('keeps all non-overlapping matches', () => {
    const selected = selectNonOverlappingMatches([
      makeMatch(0, 2, '租赁', 0),
      makeMatch(3, 5, '期间', 1),
    ]);
    assert.equal(selected.length, 2);
    assert.deepEqual(
      selected.map((item) => item.original),
      ['租赁', '期间'],
    );
  });
});
