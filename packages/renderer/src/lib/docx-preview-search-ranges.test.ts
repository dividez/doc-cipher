import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { findSearchRanges } from './docx-preview-search-ranges.ts';

describe('findSearchRanges', () => {
  it('returns empty for blank query', () => {
    assert.deepEqual(findSearchRanges('hello', ''), []);
    assert.deepEqual(findSearchRanges('hello', '   '), []);
  });

  it('returns empty when no match', () => {
    assert.deepEqual(findSearchRanges('hello world', 'xyz'), []);
  });

  it('finds multiple non-overlapping matches', () => {
    const ranges = findSearchRanges('foo bar foo', 'foo');
    assert.equal(ranges.length, 2);
    assert.deepEqual(ranges[0], { start: 0, end: 3 });
    assert.deepEqual(ranges[1], { start: 8, end: 11 });
  });

  it('is case insensitive by default', () => {
    const ranges = findSearchRanges('Foo BAR', 'foo');
    assert.equal(ranges.length, 1);
    assert.deepEqual(ranges[0], { start: 0, end: 3 });
  });

  it('supports case sensitive search', () => {
    assert.deepEqual(findSearchRanges('Foo', 'foo', { caseSensitive: true }), []);
    assert.deepEqual(findSearchRanges('foo', 'foo', { caseSensitive: true }), [
      { start: 0, end: 3 },
    ]);
  });
});
