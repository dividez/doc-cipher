import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { restoreXmlPart } from './docx-restore-xml.ts';

describe('restoreXmlPart partial restore', () => {
  it('restores complete known tokens and reports unknown tokens only', () => {
    const xml = [
      '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">',
      '<w:body>',
      '<w:p>',
      '<w:r><w:t>[PHONE_</w:t></w:r>',
      '<w:r><w:t>000001]</w:t></w:r>',
      '<w:r><w:t> [PHONE_000001] [PHONE_999999] [PHONE_00001]</w:t></w:r>',
      '</w:p>',
      '</w:body>',
      '</w:document>',
    ].join('');

    const result = restoreXmlPart(xml, [
      {
        token: '[PHONE_000001]',
        original: '13800138000',
      },
    ]);

    assert.equal(result.restoredCounts.get('[PHONE_000001]'), 2);
    assert.equal(result.unknownCounts.get('[PHONE_999999]'), 1);
    assert.equal(result.unknownCounts.has('[PHONE_00001]'), false);
    assert.match(result.updatedXml, /13800138000/);
    assert.doesNotMatch(result.updatedXml, /\[PHONE_000001\]/);
    assert.match(result.updatedXml, /\[PHONE_999999\]/);
    assert.match(result.updatedXml, /\[PHONE_00001\]/);
  });
});
