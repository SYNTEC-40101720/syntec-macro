// tests/functions.test.js
// Phase R2.2: functions 数据真源迁到 src/data/functions.json 后，functions.js
// 作为 host 层 thin loader，确保 JSON 加载、缓存、索引构建契约稳定。

const assert = require('node:assert');
const { test } = require('node:test');

function loadModule() {
  delete require.cache[require.resolve('../src/functions')];
  return require('../src/functions');
}

test('functions array exposes 62 entries (snapshot)', () => {
  const { functions } = loadModule();
  assert.ok(Array.isArray(functions), 'functions must be array');
  assert.strictEqual(functions.length, 62, 'expected 62 function entries');
});

test('functions entries have name + sig + doc fields', () => {
  const { functions } = loadModule();
  for (const fn of functions) {
    assert.ok(fn.name, `entry missing name: ${JSON.stringify(fn)}`);
    assert.ok(fn.sig, `entry ${fn.name} missing sig`);
    assert.ok(fn.doc, `entry ${fn.name} missing doc`);
  }
});

test('functions names are uppercase alphanumeric', () => {
  const { functions } = loadModule();
  for (const fn of functions) {
    assert.ok(/^[A-Z][A-Z0-9]*$/.test(fn.name),
      `function name must be uppercase: ${fn.name}`);
  }
});

test('functions names are unique (no duplicates)', () => {
  const { functions } = loadModule();
  const names = functions.map(fn => fn.name);
  const seen = new Set();
  for (const name of names) {
    assert.ok(!seen.has(name), `duplicate function name: ${name}`);
    seen.add(name);
  }
});

test('getFunctions returns same array as getter', () => {
  const m = loadModule();
  assert.strictEqual(m.getFunctions(), m.functions);
});

test('buildFunctionIndex maps name -> function entry', () => {
  const { buildFunctionIndex, functions } = loadModule();
  const idx = buildFunctionIndex();
  assert.ok(idx instanceof Map);
  assert.strictEqual(idx.size, functions.length);
  assert.strictEqual(idx.get('ABS').sig, 'ABS(num)');
  assert.strictEqual(idx.get('STKTOP').sig, 'STKTOP[index]');
  assert.strictEqual(idx.get('IF'), undefined, 'IF is keyword not function');
});

test('loader caches across calls (mtime unchanged)', () => {
  const { getFunctions, getG10LDocs } = loadModule(); // ensure getG10LDocs is undefined (not in this module)
  assert.strictEqual(getG10LDocs, undefined, 'functions module should not export getG10LDocs');
  const a = getFunctions();
  const b = getFunctions();
  assert.strictEqual(a, b, 'same mtime should return cached array identity');
});

test('JSON data is single source of truth (no static literal in JS)', () => {
  const fs = require('fs');
  const src = fs.readFileSync(require.resolve('../src/functions'), 'utf8');
  assert.ok(!/exports\.functions\s*=\s*\[/.test(src),
    'JS module should not contain inline functions array literal');
});

test('module exports thin loader interface only', () => {
  const m = loadModule();
  assert.deepStrictEqual(Object.keys(m).sort(),
    ['buildFunctionIndex', 'functions', 'getFunctions']);
});
