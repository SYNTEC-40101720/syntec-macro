// 契约测试：scripts/exportRustParityBaseline.js 与
// scripts/compareRustCore.js --baseline dual mode 的协议形状守卫。
//
// 两个不变约束：
//   1. baseline fixture schema/字段稳定（schemaVersion=1，包含 cases/
//      navigationCases/formatCases 三个数组 + expected 字段）。
//   2. compareRustCore.js 在 --baseline 与默认 mode 下 main 行为兼容，且导出
//      函数（getJavaScript* 等）和 require 入口稳定，便于 R1.2 实施时切换。
//
// 这些测试不依赖 Rust CLI（不跑 compare:rust 实际差分，仅校验数据结构与
// 模块导出契约）。

const fs = require('fs');
const path = require('path');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  CASES,
  NAVIGATION_CASES,
  FORMAT_CASES,
  getJavaScriptDiagnostics,
  getJavaScriptNavigation,
  getJavaScriptEdit
} = require('../scripts/compareRustCore');
const {
  buildBaseline,
  DEFAULT_OUTPUT_PATH,
  SCHEMA_VERSION
} = require('../scripts/exportRustParityBaseline');

const FIXTURE_PATH = path.join(__dirname, 'fixtures', 'rust-parity-baseline.json');

test('SCHEMA_VERSION is 1 (stable baseline contract)', () => {
  assert.strictEqual(SCHEMA_VERSION, 1);
});

test('baseline fixture file exists at tests/fixtures/rust-parity-baseline.json', () => {
  assert.ok(fs.existsSync(FIXTURE_PATH), `expected fixture at ${FIXTURE_PATH}`);
});

test('baseline fixture shape conforms to schemaVersion 1', () => {
  const parsed = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8'));
  assert.strictEqual(parsed.schemaVersion, 1, 'schemaVersion must be 1');
  assert.ok(typeof parsed.generatedAt === 'string' && parsed.generatedAt.length > 0);
  assert.ok(Array.isArray(parsed.cases) && parsed.cases.length > 0);
  assert.ok(Array.isArray(parsed.navigationCases) && parsed.navigationCases.length > 0);
  assert.ok(Array.isArray(parsed.formatCases) && parsed.formatCases.length > 0);
});

test('baseline fixture cases match registered CASES names+texts', () => {
  const parsed = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8'));
  assert.strictEqual(parsed.cases.length, CASES.length);
  for (let i = 0; i < CASES.length; i++) {
    assert.strictEqual(parsed.cases[i].name, CASES[i].name);
    assert.strictEqual(parsed.cases[i].text, CASES[i].text);
    assert.ok(Array.isArray(parsed.cases[i].expected));
  }
});

test('baseline fixture navigationCases match registered NAVIGATION_CASES', () => {
  const parsed = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8'));
  assert.strictEqual(parsed.navigationCases.length, NAVIGATION_CASES.length);
  for (let i = 0; i < NAVIGATION_CASES.length; i++) {
    assert.strictEqual(parsed.navigationCases[i].name, NAVIGATION_CASES[i].name);
    assert.strictEqual(parsed.navigationCases[i].uri, NAVIGATION_CASES[i].uri);
    assert.strictEqual(parsed.navigationCases[i].text, NAVIGATION_CASES[i].text);
  }
});

test('baseline fixture formatCases match registered FORMAT_CASES', () => {
  const parsed = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8'));
  assert.strictEqual(parsed.formatCases.length, FORMAT_CASES.length);
  for (let i = 0; i < FORMAT_CASES.length; i++) {
    assert.strictEqual(parsed.formatCases[i].name, FORMAT_CASES[i].name);
    assert.strictEqual(parsed.formatCases[i].text, FORMAT_CASES[i].text);
    assert.ok(
      typeof parsed.formatCases[i].expected === 'object' &&
      parsed.formatCases[i].expected !== null
    );
    assert.ok(Number.isInteger(parsed.formatCases[i].expected.editsLength));
  }
});

test('buildBaseline() produces same shape + counts as fixture file', () => {
  const parsed = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8'));
  const fresh = buildBaseline();
  assert.strictEqual(fresh.schemaVersion, parsed.schemaVersion);
  assert.strictEqual(fresh.cases.length, parsed.cases.length);
  assert.strictEqual(fresh.navigationCases.length, parsed.navigationCases.length);
  assert.strictEqual(fresh.formatCases.length, parsed.formatCases.length);
  // Names must line up so --baseline mode can resolve each case at runtime.
  for (let i = 0; i < fresh.cases.length; i++) {
    assert.strictEqual(fresh.cases[i].name, parsed.cases[i].name);
  }
});

test('compareRustCore.js still exports runtime JS helpers for v3.1.x default mode', () => {
  assert.strictEqual(typeof getJavaScriptDiagnostics, 'function');
  assert.strictEqual(typeof getJavaScriptNavigation, 'function');
  assert.strictEqual(typeof getJavaScriptEdit, 'function');
  // Sanity: runtime helpers produce non-throwing output for a trivial case.
  const diagnostics = getJavaScriptDiagnostics('IF #1 = 1 THEN\nEND_IF;');
  assert.ok(Array.isArray(diagnostics));
  const nav = getJavaScriptNavigation('file:///G42.nc', '%@MACRO\nN1;\n');
  assert.ok(nav === null || typeof nav === 'object');
  const edit = getJavaScriptEdit('');
  assert.ok(typeof edit === 'object' && edit !== null);
  assert.ok(Number.isInteger(edit.editsLength));
});

test('DEFAULT_OUTPUT_PATH points to tests/fixtures/rust-parity-baseline.json', () => {
  assert.strictEqual(
    DEFAULT_OUTPUT_PATH.replace(/\\/g, '/').endsWith('tests/fixtures/rust-parity-baseline.json'),
    true
  );
});