import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createProfileId, isValidProfileId } from './profile-id.ts';

describe('createProfileId', () => {
  it('returns distinct random ids', () => {
    const a = createProfileId();
    const b = createProfileId();
    assert.notEqual(a, b);
  });

  it('returns ascii-safe ids', () => {
    const id = createProfileId();
    assert.match(id, /^[a-zA-Z0-9_-]+$/);
    assert.ok(isValidProfileId(id));
  });
});
