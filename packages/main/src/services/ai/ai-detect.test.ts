import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { entitiesToPendingMatches } from './ai-entities.util.ts';

describe('entitiesToPendingMatches', () => {
  it('maps entities above threshold to paragraph spans', () => {
    const text = '联系人张三在某某公司办公';
    const pending = entitiesToPendingMatches(
      text,
      [
        { text: '张三', type: 'person_name', confidence: 0.9 },
        { text: '某某公司', type: 'company_name', confidence: 0.6 },
      ],
      0.75,
    );
    assert.equal(pending.length, 1);
    assert.equal(pending[0]?.original, '张三');
    assert.equal(pending[0]?.ruleId, 'ai_sensitive');
  });
});
