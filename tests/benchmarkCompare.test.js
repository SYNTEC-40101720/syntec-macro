// P1 性能基准（R1.2 Stage B 后纯 Rust/Wasm）的契约测试。
//
// 覆盖：
//   - `stableFingerprint`：诊断/符号/navigation 形状的稳定采样器
//   - `buildNavigationFixture`：500 文件 fixture 形状与可重复性
//   - `measure`：warming up + percentile 维度的基本契约
//   - `runScenarios`：Rust adapter 正常路径 fallbackCount=0、结果形状
//   - P1 第 2 项：`REGRESSION_THRESHOLDS` 形状、`computeResultJsonBytes`、
//     `--no-threshold` 参数语义、定阈值均不低阈值的单元门禁
//
// 这些都是 P1 §「真实 fixture / 20,000 行档案 / 500 文件 navigation 必须记录
// 启动时间、p50/p95 延迟、JSON 占用与 fallback 比例」的硬门禁实现单元，
// 确保脚本被未来重构时门禁不被静默绕过。

const assert = require('node:assert');
const { test } = require('node:test');
const {
  REGRESSION_THRESHOLDS,
  buildNavigationFixture,
  computeResultJsonBytes,
  measure,
  stableFingerprint,
  NAV_FILE_COUNT,
  NAV_LINES_PER_FILE
} = require('../scripts/benchmarkCompare');
const { createRequest, createLargeMacroText } = require('../scripts/benchmarkAnalysis');

const MACRO_TEXT = '%@MACRO\nN1;\nG65 P1000 A1;\n';

test('stableFingerprint strips backend/bytes and rounds diagnostic fields', () => {
  const fp = stableFingerprint({
    diagnostics: [{
      range: { start: { line: 0, character: 0 }, end: { line: 0, character: 3 } },
      message: 'oops',
      severity: 'error',
      source: 'syntec',
      code: 'SYNTEC_X'
    }],
    symbols: [{ name: 'N1', kind: 'label', line: 1, startCharacter: 0, endCharacter: 3 }],
    navigation: { programEntryName: 'G1', macroProgramName: null, symbols: [], calls: [] }
  });
  assert.deepStrictEqual(fp, {
    diagnostics: [{ line: 1, col: 0, endCol: 3, severity: 'error', code: 'SYNTEC_X' }],
    symbols: [{ name: 'N1', kind: 'label', line: 1 }],
    hasNavigation: true
  });
});

test('stableFingerprint distinguishes two different result shapes', () => {
  const a = stableFingerprint({
    diagnostics: [], symbols: [], navigation: null
  });
  const b = stableFingerprint({
    diagnostics: [{ range: { start: { line: 0, character: 0 }, end: { line: 0, character: 1 } },
      message: 'm', severity: 'warning', source: 'x' }],
    symbols: [], navigation: null
  });
  assert.notStrictEqual(JSON.stringify(a), JSON.stringify(b));
});

test('buildNavigationFixture produces NAV_FILE_COUNT files with 40 lines each', () => {
  const files = buildNavigationFixture();
  assert.strictEqual(files.length, NAV_FILE_COUNT);
  assert.strictEqual(files[0].text.split('\n').length, NAV_LINES_PER_FILE);
  // Deterministic content for reproducible benchmark runs.
  const rebuilt = buildNavigationFixture();
  assert.strictEqual(files[0].text, rebuilt[0].text);
  // Files start with a macro header so Rust detects them as macro files.
  assert.ok(files[0].text.startsWith('%@MACRO'));
});

test('measure runs warm-up once and then records iterations samples', () => {
  let counter = 0;
  const result = measure(() => { counter++; return counter; }, 3);
  // 1 warm-up + 3 measurement runs.
  assert.strictEqual(counter, 4);
  assert.strictEqual(typeof result.p50Ms, 'number');
  assert.strictEqual(typeof result.p95Ms, 'number');
  assert.strictEqual(typeof result.maxMs, 'number');
  assert.strictEqual(typeof result.firstMs, 'number');
  assert.ok(result.maxMs >= result.p95Ms);
  assert.ok(result.p95Ms >= result.p50Ms);
});

test('measure captures the first-run latency separately from repeat p50', () => {
  let callCount = 0;
  const result = measure(() => { callCount++; return callCount; }, 5);
  // firstMs is wall-clock of the warm-up call; p50 aggregates the next 5.
  assert.ok(result.firstMs >= 0);
  assert.strictEqual(callCount, 6);
});

test('createLargeMacroText yields 20000 lines with IF block markers', () => {
  const text = createLargeMacroText(20000);
  assert.strictEqual(text.split(/\r?\n/).length, 20000);
  assert.ok(text.includes('IF #1 = 1 THEN'));
  assert.ok(text.includes('END_IF;'));
});

test('runScenarios returns rust-only result shape without throwing', async () => {
  // R1.2 Stage B: 纯 Rust 基准。runScenarios 不再有 JS 对照路径，
  // 正常状态下 fallbackCount=0，结果只含 rust.* 指标（无 js 字段）。
  const previousExit = process.exitCode;
  process.exitCode = 0;
  const { runScenarios } = require('../scripts/benchmarkCompare');
  const request = createRequest(MACRO_TEXT, 'file:///workspace/G1000.nc');
  const scenarios = [
    { name: 'snippet', request, lineCount: 3 }
  ];
  const { results, fallbackCount } = await runScenarios(scenarios, 1);
  assert.strictEqual(fallbackCount, 0, 'fallbackCount must be 0 when Rust adapter succeeds');
  for (const r of results) {
    assert.strictEqual(typeof r.rust.p50Ms, 'number');
    assert.strictEqual(r.js, undefined, 'js.* fields removed with JS backend retirement');
    assert.strictEqual(r.parity, undefined, 'parity field removed (golden-file compare:rust owns it)');
  }
  process.exitCode = previousExit || 0;
});

test('REGRESSION_THRESHOLDS covers all P1 scenarios with finite numbers', () => {
  // P1 第 2 项 阈值表契约：必须覆盖场景 fixture / large-20k / nav-500-files
  // 并提供 p50/p95/batch/startup 中的关键指标上限。宽松阈值仅用于防回归，
  // 不是利润。
  const scenarios = ['fixture', 'large-20k', 'nav-500-files'];
  for (const scenario of scenarios) {
    const caps = REGRESSION_THRESHOLDS[scenario];
    assert.ok(caps, `missing threshold caps for scenario ${scenario}`);
    assert.ok(Number.isFinite(caps.rustStartupMs), `${scenario}.rustStartupMs must be finite`);
  }
  assert.ok(Number.isFinite(REGRESSION_THRESHOLDS.fixture.rustP50Ms));
  assert.ok(Number.isFinite(REGRESSION_THRESHOLDS['large-20k'].rustP95Ms));
  assert.ok(Number.isFinite(REGRESSION_THRESHOLDS['nav-500-files'].rustBatchMs));
});

test('computeResultJsonBytes counts UTF-8 bytes of the JSON serialization', () => {
  // P1 第 2 项 JSON 内存占用指标：必须与 Buffer.byteLength 一致，
  // 而不是与 string.length 一致（中文/emoji 多字节差是原 bug 场景）。
  const result = { diagnostics: [{ message: '中文错误' }], symbols: [] };
  const expected = Buffer.byteLength(JSON.stringify(result), 'utf8');
  assert.strictEqual(computeResultJsonBytes(result), expected);
  assert.ok(expected > 30); // UTF-8 中文多字节确保不是 string.length.
});

test('stableFingerprint on empty result shape equals no nav fingerprint', () => {
  // Adapter failure path returns lastResult: null → bridge treats it as an
  // empty normalized shape so the sample is deterministic and never crashes
  // the run. Test that the empty shape is well-defined.
  const fp = stableFingerprint({ diagnostics: [], symbols: [], navigation: null });
  assert.deepStrictEqual(fp, {
    diagnostics: [],
    symbols: [],
    hasNavigation: false
  });
});
