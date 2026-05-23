import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  extractAiKeywordTextsFromHits,
  filterRecognizedHitsByCandidates,
  mergeAiKeywordsIntoCandidates,
} from './manual-keyword.js';
import type { DocxMatchHit, ManualKeyword } from '../types/tasks.js';

describe('extractAiKeywordTextsFromHits', () => {
  it('dedupes ai hit texts', () => {
    const hits: DocxMatchHit[] = [
      {
        partName: 'a',
        blockIndex: 0,
        start: 0,
        end: 2,
        ruleId: 'ai_sensitive',
        kind: 'ai',
        text: '甲',
      },
      {
        partName: 'a',
        blockIndex: 0,
        start: 3,
        end: 4,
        ruleId: 'ai_sensitive',
        kind: 'ai',
        text: '甲',
      },
      { partName: 'a', blockIndex: 1, start: 0, end: 1, ruleId: 'phone', kind: 'regex' },
    ];
    assert.deepEqual(extractAiKeywordTextsFromHits(hits), ['甲']);
  });
});

describe('mergeAiKeywordsIntoCandidates', () => {
  it('adds ai source keywords without duplicating', () => {
    const current: ManualKeyword[] = [{ id: '1', text: '已有', source: 'manual' }];
    const next = mergeAiKeywordsIntoCandidates(current, ['已有', '新词']);
    assert.equal(next.length, 2);
    assert.equal(next[1]?.source, 'ai');
    assert.equal(next[1]?.text, '新词');
  });
});

describe('filterRecognizedHitsByCandidates', () => {
  it('drops ai/manual hits removed from candidate list', () => {
    const hits: DocxMatchHit[] = [
      {
        partName: 'a',
        blockIndex: 0,
        start: 0,
        end: 2,
        ruleId: 'ai_sensitive',
        kind: 'ai',
        text: '甲',
      },
      { partName: 'a', blockIndex: 0, start: 0, end: 2, ruleId: 'phone', kind: 'regex' },
    ];
    const filtered = filterRecognizedHitsByCandidates(hits, []);
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0]?.kind, 'regex');
  });
});
