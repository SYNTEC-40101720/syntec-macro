// tests/keywords.test.js
// Phase R2.4: keywords 数据真源迁到 src/data/keywords.json 后，keywords.js
// 作为 host 层 thin loader，确保 2 张表 (keywords 分组 + keywordDocs map)
// 与运行时函数 (getAllKeywords / getMCodeDesc / getKeywordDoc) 契约稳定。

const assert = require('node:assert');
const { test } = require('node:test');

function loadModule() {
  delete require.cache[require.resolve('../src/keywords')];
  return require('../src/keywords');
}

const EXPECTED_GROUPS = [
  'conditional', 'repeat', 'while', 'for', 'case',
  'flow', 'operators', 'robot', 'gcodes', 'mcodes'
];

test('keywords exposes 10 groups (snapshot)', () => {
  const { keywords } = loadModule();
  for (const group of EXPECTED_GROUPS) {
    assert.ok(Array.isArray(keywords[group]),
      `keywords.${group} must be array`);
  }
  assert.strictEqual(Object.keys(keywords).length, EXPECTED_GROUPS.length);
});

test('keywordDocs exposes 72 entries (snapshot)', () => {
  const { keywordDocs } = loadModule();
  assert.strictEqual(Object.keys(keywordDocs).length, 72);
});

test('keywordDocs entries have sig + doc fields', () => {
  const { keywordDocs } = loadModule();
  for (const [k, v] of Object.entries(keywordDocs)) {
    assert.ok(v.sig, `${k} missing sig`);
    assert.ok(v.doc, `${k} missing doc`);
  }
});

test('getAllKeywords merges keyword groups (not gcodes/mcodes)', () => {
  const m = loadModule();
  const all = m.getAllKeywords();
  assert.ok(Array.isArray(all));
  assert.ok(all.length > 0);
  assert.ok(all.includes('IF'));
  assert.ok(all.includes('MOVJ'));
  assert.ok(!all.includes('G00'), 'gcodes group should NOT be in getAllKeywords');
  assert.ok(!all.includes('M03'), 'mcodes group should NOT be in getAllKeywords');
});

test('getAllKeywords caches (returns same array identity)', () => {
  const m = loadModule();
  const a = m.getAllKeywords();
  const b = m.getAllKeywords();
  assert.strictEqual(a, b, 'should return cached array identity');
});

test('getKeywordDoc finds control-flow keyword', () => {
  const { getKeywordDoc } = loadModule();
  const ifDoc = getKeywordDoc('IF');
  assert.ok(ifDoc);
  assert.strictEqual(ifDoc.sig, 'IF 条件 THEN');
  assert.ok(ifDoc.doc.includes('条件判断'));
});

test('getKeywordDoc returns null for unknown keyword', () => {
  const { getKeywordDoc } = loadModule();
  assert.strictEqual(getKeywordDoc('UNKNOWN_KW'), null);
});

test('getMCodeDesc returns doc string for known M code', () => {
  const { getMCodeDesc } = loadModule();
  const desc = getMCodeDesc('M98');
  assert.ok(desc, 'M98 should have desc');
  assert.ok(desc.includes('副程序') || desc.includes('呼叫'));
});

test('getMCodeDesc falls back to "M代码" for unknown M code', () => {
  const { getMCodeDesc } = loadModule();
  assert.strictEqual(getMCodeDesc('M999'), 'M代码');
});

test('keywordDocs includes AND/OR/NOT/MOD operators + assignment :=' , () => {
  const { keywordDocs } = loadModule();
  assert.ok(keywordDocs.AND);
  assert.ok(keywordDocs.OR);
  assert.ok(keywordDocs.NOT);
  assert.ok(keywordDocs.MOD);
  assert.ok(keywordDocs[':='], ':= operator must have doc');
});

test('robot keywords includes MOVJ/MOVL/MOVC + WEAVEON/STITCHON' , () => {
  const { keywords } = loadModule();
  for (const robotKw of ['MOVJ', 'MOVL', 'MOVC', 'WEAVEON', 'STITCHON', 'SWAITSIG']) {
    assert.ok(keywords.robot.includes(robotKw),
      `keywords.robot should include ${robotKw}`);
  }
});

test('loader caches across calls (same mtime)', () => {
  const { getKeywords } = loadModule();
  const a = getKeywords();
  const b = getKeywords();
  assert.strictEqual(a, b, 'same mtime should return cached object identity');
});

test('JSON data is single source of truth (no static literal in JS)', () => {
  const fs = require('fs');
  const src = fs.readFileSync(require.resolve('../src/keywords'), 'utf8');
  assert.ok(!/exports\.keywords\s*=\s*{/.test(src),
    'JS module should not contain inline keywords literal');
  assert.ok(!/exports\.keywordDocs\s*=\s*{/.test(src),
    'JS module should not contain inline keywordDocs literal');
});

test('module exports thin loader interface only', () => {
  const m = loadModule();
  assert.deepStrictEqual(Object.keys(m).sort(),
    ['getAllKeywords', 'getKeywordDoc', 'getKeywordDocs', 'getKeywords',
      'getMCodeDesc', 'keywordDocs', 'keywords']);
});
