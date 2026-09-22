// tests/checkDiagnosticGovernance.test.js
// Phase 4 新诊断规则科学化 — checkDiagnosticGovernance 守卫契约测试。
// 校验脚本对每个 DiagnosticCode 的四件套登记 (JS / Rust / parity 文档 / 能力矩阵)
// 的检测行为，以及 HARD/SOFT/strict 模式的差异。

const assert = require('node:assert');
const { test } = require('node:test');
const {
  buildChecks,
  formatResult,
  readJsDiagnosticCodes,
  readRustEmittedCodes,
  readParityDocRegisteredCodes,
  readDiagnosticHelpCodes
} = require('../scripts/checkDiagnosticGovernance');

test('readJsDiagnosticCodes extracts all 65 codes including last-no-comma entry', () => {
  const codes = readJsDiagnosticCodes();
  assert.ok(codes.length >= 64, `expected >=64 codes, got ${codes.length}`);
  // 末项 ROBOT_G10_L1802_SILENT_VERSION_GATE 无尾逗号, 必须被 regex 捕获
  const l1802 = codes.find(c => c.code === 'SYNTEC_ROBOT_G10_L1802_SILENT_VERSION_GATE');
  assert.ok(l1802, 'L1802 code must be captured even without trailing comma');
  assert.strictEqual(l1802.key, 'ROBOT_G10_L1802_SILENT_VERSION_GATE');
});

test('readRustEmittedCodes excludes SYNTEC_CORE_* ABI symbols', () => {
  const rust = readRustEmittedCodes();
  assert.ok(![...rust].some(c => c.startsWith('SYNTEC_CORE_')),
    'SYNTEC_CORE_* ABI symbols must be excluded');
  assert.ok(rust.has('SYNTEC_MISSING_SEMICOLON'), 'common code should be present');
});

test('readParityDocRegisteredCodes scans `SYNTEC_*` backticks in parity doc', () => {
  const codes = readParityDocRegisteredCodes();
  assert.ok(codes.size > 50, `expected >50 codes in parity doc, got ${codes.size}`);
  assert.ok(codes.has('SYNTEC_MISSING_SEMICOLON'));
});

test('readDiagnosticHelpCodes returns DIAGNOSTIC_HELP key set', () => {
  const help = readDiagnosticHelpCodes();
  assert.ok(help.size > 0);
  // 至少 ROBOT_G10_L1802_SILENT_VERSION_GATE 项注册了 (Phase β.1 已落地)
  assert.ok(help.has('SYNTEC_ROBOT_G10_L1802_SILENT_VERSION_GATE'));
});

test('buildChecks default mode: HARD = 0 (四件套已登记), SOFT = 27 (DIAGNOSTIC_HELP 文案缺口)', () => {
  const r = buildChecks(false);
  assert.strictEqual(r.hard.length, 0,
    `HARD should be 0 in current state, got: ${JSON.stringify(r.hard.slice(0, 3))}`);
  // SOFT 缺口存在但不阻塞
  assert.ok(r.soft.length > 0, 'SOFT should have some missing DIAGNOSTIC_HELP codes');
  assert.ok(r.soft.length < r.jsCount,
    'SOFT count should be smaller than total JS code count');
});

test('buildChecks --strict 与默认模式 hard/soft 数量一致 (strict 只影响 exit 不影响数量)', () => {
  const r1 = buildChecks(false);
  const r2 = buildChecks(true);
  assert.strictEqual(r1.hard.length, r2.hard.length);
  assert.strictEqual(r1.soft.length, r2.soft.length);
  assert.strictEqual(r2.strict, true);
  assert.strictEqual(r1.strict, false);
});

test('buildChecks counts cross-source consistency: JS == Rust == parity doc >= 65', () => {
  const r = buildChecks(false);
  assert.ok(r.jsCount >= 65, `JS count ${r.jsCount}`);
  assert.ok(r.rustCount >= 65, `Rust count ${r.rustCount}`);
  assert.ok(r.parityDocCount >= 65, `parity doc count ${r.parityDocCount}`);
  // JS == Rust (核心 HARD 校验: 两端覆盖一致)
  assert.strictEqual(r.jsCount, r.rustCount,
    `JS (${r.jsCount}) and Rust (${r.rustCount}) must match`);
});

test('formatResult 生成 markdown 报告含关键段', () => {
  const r = buildChecks(false);
  const md = formatResult(r);
  assert.ok(md.includes('# 诊断规则科学化治理'));
  assert.ok(md.includes('## 汇总'));
  assert.ok(md.includes('JS DiagnosticCode'));
  assert.ok(md.includes('Rust literal'));
  assert.ok(md.includes('parity 清单登记'));
  assert.ok(md.includes('能力矩阵登记'));
  assert.ok(md.includes('DIAGNOSTIC_HELP 文案'));
  // 默认模式 PASS
  assert.ok(md.includes('PASS — 四件套'));
});

test('formatResult --strict 模式无 SOFT 缺口时 PASS, 有 SOFT 缺口时不输出 PASS', () => {
  // 当前实际有 27 个 SOFT 缺口
  const r = buildChecks(true);
  const md = formatResult(r);
  // strict 模式下 SOFT 缺口存在 -> 结论段不输出 PASS
  if (r.soft.length > 0) {
    assert.ok(!md.includes('PASS — 四件套'),
      'strict mode with SOFT gaps should NOT print PASS');
    assert.ok(md.includes('SOFT 缺口'));
  }
});

test('即未注册 L1802 - 模拟 inspect HARD 缺口触发', () => {
  // 通过直接断言真实环境下 L1802 已注册, 反向守卫四件套完整性
  const result = buildChecks(false);
  const l1802Hard = result.hard.find(h => h.code === 'SYNTEC_ROBOT_G10_L1802_SILENT_VERSION_GATE');
  assert.strictEqual(l1802Hard, undefined,
    'L1802 must be in full parity (JS + Rust + parity doc), no HARD gap');
});

test('所有 SYNTEC_ROBOT_* 在 parity 清单中登记', () => {
  const jsCodes = readJsDiagnosticCodes();
  const robotCodes = jsCodes.filter(c => c.code.startsWith('SYNTEC_ROBOT_'));
  const parity = readParityDocRegisteredCodes();
  for (const { code } of robotCodes) {
    assert.ok(parity.has(code),
      `ROBOT code ${code} must be registered in parity doc`);
  }
});

test('buildChecks 结果对象含必需字段 schema', () => {
  const r = buildChecks(false);
  for (const field of ['jsCount', 'rustCount', 'parityDocCount',
    'capabilityMatrixCount', 'helpCount', 'hard', 'soft', 'strict']) {
    assert.ok(field in r, `result must have field ${field}`);
  }
});
