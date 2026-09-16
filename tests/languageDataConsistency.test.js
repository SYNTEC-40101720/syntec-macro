const { test } = require('node:test');
const assert = require('node:assert');
const { checkLanguageDataConsistency } = require('../scripts/checkLanguageDataConsistency');

test('language data is internally consistent', () => {
  assert.deepStrictEqual(checkLanguageDataConsistency(), []);
});
