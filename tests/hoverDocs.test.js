// tests/hoverDocs.test.js
// Phase R2.3: codeDocs 数据真源迁到 src/data/hoverDocs.json 后，codeDocs.js
// 作为 host 层 thin loader，确保 3 张表 (gCodeDocs / g10LCodeDocs / mCodeDocs)
// 与 3 个查询函数契约稳定。

const assert = require('node:assert');
const { test } = require('node:test');

function loadModule() {
  delete require.cache[require.resolve('../src/codeDocs')];
  return require('../src/codeDocs');
}

test('gCodeDocs exposes 47 entries (snapshot)', () => {
  const { gCodeDocs } = loadModule();
  assert.strictEqual(Object.keys(gCodeDocs).length, 47);
});

test('mCodeDocs exposes 17 entries (snapshot)', () => {
  const { mCodeDocs } = loadModule();
  assert.strictEqual(Object.keys(mCodeDocs).length, 17);
});

test('g10LCodeDocs exposes 13 entries (snapshot)', () => {
  const { g10LCodeDocs } = loadModule();
  assert.strictEqual(Object.keys(g10LCodeDocs).length, 13);
});

test('each code doc entry has sig + doc fields (g + m)', () => {
  const { gCodeDocs, mCodeDocs } = loadModule();
  for (const [code, entry] of Object.entries({ ...gCodeDocs, ...mCodeDocs })) {
    assert.ok(entry.sig, `${code} missing sig`);
    assert.ok(entry.doc, `${code} missing doc`);
  }
});

test('getCodeDoc finds G codes case-insensitively', () => {
  const { getCodeDoc } = loadModule();
  assert.ok(getCodeDoc('G00'));
  assert.ok(getCodeDoc('g00'), 'lowercase should work');
  assert.strictEqual(getCodeDoc('G00').sig, 'G00 X_ Y_ Z_;');
});

test('getCodeDoc finds M codes', () => {
  const { getCodeDoc } = loadModule();
  assert.strictEqual(getCodeDoc('M98').sig, 'M98 P_ H_ L_;');
});

test('getCodeDoc returns null for unknown code', () => {
  const { getCodeDoc } = loadModule();
  assert.strictEqual(getCodeDoc('G9999'), null);
  assert.strictEqual(getCodeDoc('M999'), null);
});

test('getG10LCodeDoc finds L codes and returns multi-line doc as string', () => {
  const { getG10LCodeDoc } = loadModule();
  const l1802 = getG10LCodeDoc('L1802');
  assert.ok(l1802, 'L1802 should exist');
  assert.strictEqual(l1802.sig, 'G10 L1802 P_;');
  assert.ok(typeof l1802.doc === 'string', 'doc should be string (joined)');
  assert.ok(l1802.doc.includes('COR-345'), 'should contain COR-345 reference');
});

test('getG10LCodeDoc normalizes uppercase', () => {
  const { getG10LCodeDoc } = loadModule();
  assert.strictEqual(getG10LCodeDoc('l1802').sig, getG10LCodeDoc('L1802').sig);
});

test('getG10LCodeDoc returns null for unknown L code', () => {
  const { getG10LCodeDoc } = loadModule();
  assert.strictEqual(getG10LCodeDoc('L9999'), null);
});

test('getCodeShortDescription returns doc string or null', () => {
  const { getCodeShortDescription } = loadModule();
  assert.ok(getCodeShortDescription('G00'));
  assert.strictEqual(getCodeShortDescription('G9999'), null);
});

test('getGCodeDocs / getG10LCodeDocs / getMCodeDocs functions work', () => {
  const m = loadModule();
  assert.strictEqual(Object.keys(m.getGCodeDocs()).length, 47);
  assert.strictEqual(Object.keys(m.getG10LCodeDocs()).length, 13);
  assert.strictEqual(Object.keys(m.getMCodeDocs()).length, 17);
});

test('loader caches across calls (same mtime)', () => {
  const { getGCodeDocs } = loadModule();
  const a = getGCodeDocs();
  const b = getGCodeDocs();
  assert.strictEqual(a, b, 'same mtime should return cached object identity');
});

test('JSON data is single source of truth (no static literal in JS)', () => {
  const fs = require('fs');
  const src = fs.readFileSync(require.resolve('../src/codeDocs'), 'utf8');
  assert.ok(!/const\s+gCodeDocs\s*=\s*{/.test(src),
    'JS module should not contain inline gCodeDocs literal');
});

test('module exports thin loader interface only', () => {
  const m = loadModule();
  assert.deepStrictEqual(Object.keys(m).sort(),
    ['g10LCodeDocs', 'gCodeDocs', 'getCodeDoc', 'getCodeShortDescription',
      'getG10LCodeDoc', 'getG10LCodeDocs', 'getGCodeDocs', 'getMCodeDocs',
      'mCodeDocs']);
});
