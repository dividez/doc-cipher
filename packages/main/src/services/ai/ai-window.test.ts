import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { countWindows, iterTextWindows } from './ai-window.util.ts';

describe('countWindows', () => {
  it('returns 0 for empty text', () => {
    assert.equal(countWindows(0), 0);
  });

  it('returns 1 for short text', () => {
    assert.equal(countWindows(500), 1);
    assert.equal(countWindows(1800), 1);
  });

  it('counts sliding windows for long text', () => {
    assert.equal(countWindows(5000), 4);
  });
});

describe('iterTextWindows', () => {
  it('yields one window for short text', () => {
    const windows = [...iterTextWindows('hello')];
    assert.equal(windows.length, 1);
    assert.equal(windows[0]?.slice, 'hello');
  });

  it('covers long text with overlapping windows', () => {
    const text = 'a'.repeat(5000);
    const windows = [...iterTextWindows(text)];
    assert.equal(windows.length, 4);
    assert.equal(windows[0]?.start, 0);
    assert.ok((windows.at(-1)?.slice.length ?? 0) > 0);
    assert.ok((windows.at(-1)?.start ?? 0) + (windows.at(-1)?.slice.length ?? 0) >= 5000);
  });
});
