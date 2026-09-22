// tests/systemVariables.test.js
// Phase R2: 数据真源迁到 src/data/systemVariables.json 后，systemVariables.js
// 作为 host 层 thin loader，确保 JSON 加载、缓存、查询契约稳定。

const assert = require('node:assert');
const { test } = require('node:test');

function loadModule() {
  delete require.cache[require.resolve('../src/systemVariables')];
  return require('../src/systemVariables');
}

test('getSystemVariableDoc returns doc for known #1500 (silent mode)', () => {
  const { getSystemVariableDoc } = loadModule();
  const doc = getSystemVariableDoc('#1500');
  assert.ok(doc, '#1500 should have a doc');
  assert.ok(doc.includes('宁静模式'), `expected 宁静模式 in: ${doc}`);
});

test('getSystemVariableDoc normalizes lowercase variable tokens', () => {
  const { getSystemVariableDoc } = loadModule();
  const doc = getSystemVariableDoc('#1500');
  const docLower = getSystemVariableDoc('#1500');
  assert.strictEqual(doc, docLower);
});

test('getSystemVariableDoc returns null for unknown variable', () => {
  const { getSystemVariableDoc } = loadModule();
  assert.strictEqual(getSystemVariableDoc('#9999'), null);
  assert.strictEqual(getSystemVariableDoc(''), null);
  assert.strictEqual(getSystemVariableDoc(null), null);
  assert.strictEqual(getSystemVariableDoc(undefined), null);
});

test('getSystemVariableDocs returns the full docs object', () => {
  const { getSystemVariableDocs } = loadModule();
  const docs = getSystemVariableDocs();
  assert.ok(docs && typeof docs === 'object');
  // 已知 13 个登记项（#1500/#1502/#1504/#1510/#1820 + 6 个 G92 + 2 个 PLC）
  const knownKeys = ['#1500', '#1502', '#1504', '#1510', '#1820',
    '#1901', '#1918', '#1930', '#1931', '#1932', '#1933',
    '#6001', '#6032'];
  for (const key of knownKeys) {
    assert.ok(Object.prototype.hasOwnProperty.call(docs, key),
      `docs should include ${key}`);
  }
});

test('JSON data is the single source of truth (no static literal in JS)', () => {
  // 反向断言：JS 模块文件内不应再含 SYSTEM_VARIABLE_DOCS literal
  const fs = require('fs');
  const src = fs.readFileSync(require.resolve('../src/systemVariables'), 'utf8');
  assert.ok(!/SYSTEM_VARIABLE_DOCS\s*=\s*{/.test(src),
    'JS module should not contain inline SYSTEM_VARIABLE_DOCS literal');
});

test('loader caches across calls (mtime unchanged)', () => {
  const { getSystemVariableDocs } = loadModule();
  const a = getSystemVariableDocs();
  const b = getSystemVariableDocs();
  assert.strictEqual(a, b, 'same mtime should return cached object identity');
});

test('module exports thin loader interface only', () => {
  const m = loadModule();
  assert.deepStrictEqual(Object.keys(m).sort(),
    ['getSystemVariableDoc', 'getSystemVariableDocs']);
});
