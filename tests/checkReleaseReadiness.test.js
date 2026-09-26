// 3.x 发布前 readiness 自检工具的契约测试。
//
// 覆盖：
//   - `CHECKS` 数组对照 docs §5「完成定义」7 项门禁完整
//   - 每个 check 有唯一 id / name / run() 函数
//   - run() 返回 {status: 'PASS'|'FAIL'|'SKIP', detail: string}
//   - 主 process.exitCode 默认 0（非门禁，由人 review）
//   - `--strict` flag 在出现 FAIL 时置 exitCode=1
//   - main 不抛错

const assert = require('node:assert');
const { test } = require('node:test');
const { CHECKS, main } = require('../scripts/checkReleaseReadiness');

const EXPECTED_IDS = [
  '1-analysis-result-parity',
  '2-stable-diagnostic-nav-format-parity',
  '3-wasm-asset-loader-worker-fallback',
  '4-cross-platform-build-matrix',
  '5-perf-memory-startup-fallback',
  '6-vscode-integration-vsix',
  '7-tag-release-vsix-alignment'
];

test('CHECKS array covers all 7 §5 release readiness conditions', () => {
  assert.strictEqual(CHECKS.length, 7, 'must have exactly 7 §5 readiness checks');
  const ids = CHECKS.map(c => c.id);
  for (const expected of EXPECTED_IDS) {
    assert.ok(ids.includes(expected), `missing check: ${expected}`);
  }
});

test('each CHECK has a unique id, name and runnable run()', () => {
  const seen = new Set();
  for (const check of CHECKS) {
    assert.ok(typeof check.id === 'string' && check.id.length > 0, 'id missing');
    assert.ok(typeof check.name === 'string' && check.name.length > 0, 'name missing for ' + check.id);
    assert.strictEqual(typeof check.run, 'function', check.id + ': run must be a function');
    assert.ok(!seen.has(check.id), 'duplicate id: ' + check.id);
    seen.add(check.id);
  }
});

test('each check.run() returns a well-formed status object', () => {
  for (const check of CHECKS) {
    let result;
    assert.doesNotThrow(() => { result = check.run(); }, check.id + ': run must not throw');
    assert.ok(['PASS', 'SKIP', 'FAIL'].includes(result.status),
      check.id + ': status must be PASS/SKIP/FAIL, got ' + result.status);
    assert.strictEqual(typeof result.detail, 'string', check.id + ': detail must be string');
  }
});

test('main without --strict does not set process.exitCode on FAIL', () => {
  const prevExit = process.exitCode;
  process.exitCode = 0;
  // Suppress stdout.
  const origInfo = console.info;
  console.info = () => {};
  try {
    main([]);
  } finally {
    console.info = origInfo;
  }
  // Either 0 (no FAIL) or whatever strict mode would set; we called main([])
  // which is the non-strict path. exitCode should remain 0 unless the checks
  // themselves threw an unhandled error (they catch internally).
  assert.strictEqual(process.exitCode, 0);
  process.exitCode = prevExit || 0;
});

test('main with --strict sets process.exitCode=1 when any FAIL appears', () => {
  // The live workspace has at least one check returning PASS/SKIP; to exercise
  // the --strict gate deterministically we stub one check to return FAIL.
  const prevExit = process.exitCode;
  process.exitCode = 0;
  const origInfo = console.info;
  console.info = () => {};
  const originalRun = CHECKS[0].run;
  CHECKS[0].run = () => ({ status: 'FAIL', detail: 'stubbed failure' });
  try {
    main(['--strict']);
    assert.strictEqual(process.exitCode, 1,
      'main --strict must set exitCode=1 when at least one FAIL appears');
  } finally {
    CHECKS[0].run = originalRun;
    console.info = origInfo;
    process.exitCode = prevExit || 0;
  }
});

test('main without --strict tolerates a stubbed FAIL', () => {
  const prevExit = process.exitCode;
  process.exitCode = 0;
  const origInfo = console.info;
  console.info = () => {};
  const originalRun = CHECKS[1].run;
  CHECKS[1].run = () => ({ status: 'FAIL', detail: 'stubbed failure' });
  try {
    main([]);
    // Non-strict path: exitCode must stay 0 even with FAIL.
    assert.strictEqual(process.exitCode, 0);
  } finally {
    CHECKS[1].run = originalRun;
    console.info = origInfo;
    process.exitCode = prevExit || 0;
  }
});

test('main catches exceptions thrown inside check.run and reports FAIL', () => {
  const prevExit = process.exitCode;
  process.exitCode = 0;
  const origInfo = console.info;
  console.info = () => {};
  const originalRun = CHECKS[2].run;
  CHECKS[2].run = () => { throw new Error('boom'); };
  try {
    main([]); // non-strict
    // Should not throw; an internal FAIL is reported but exitCode remains 0.
    assert.strictEqual(process.exitCode, 0);
  } finally {
    CHECKS[2].run = originalRun;
    console.info = origInfo;
    process.exitCode = prevExit || 0;
  }
});

test('main catches exceptions inside check.run when --strict (counts as FAIL)', () => {
  const prevExit = process.exitCode;
  process.exitCode = 0;
  const origInfo = console.info;
  console.info = () => {};
  const originalRun = CHECKS[3].run;
  CHECKS[3].run = () => { throw new Error('boom'); };
  try {
    main(['--strict']);
    // Thrown error becomes a FAIL entry → strict path sets exitCode=1.
    assert.strictEqual(process.exitCode, 1);
  } finally {
    CHECKS[3].run = originalRun;
    console.info = origInfo;
    process.exitCode = prevExit || 0;
  }
});

// --- parity 覆盖 marker 契约（2026-09-26 修复 73/73 不匹配旧正则后守卫） ---

test('parity check passes on the real parity doc (N/N 自洽 + 未覆盖 0)', () => {
  const check = CHECKS.find(c => c.id === '2-stable-diagnostic-nav-format-parity');
  assert.ok(check, 'parity check must exist');
  const result = check.run();
  assert.strictEqual(result.status, 'PASS', `real parity doc must pass: ${result.detail}`);
  // 覆盖数随批次扩展（67→68→73→...），detail 只需自洽不写死数字
  assert.match(result.detail, /已收口/);
});

test('parity check regex accepts any equal N/N coverage, rejects mismatched or uncovered', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const src = fs.readFileSync(
    path.join(__dirname, '..', 'docs', 'Rust诊断parity清单.md'), 'utf8');
  const declared = src.match(/当前 Rust 覆盖：\s*(\d+)\s*\/\s*(\d+)/);
  assert.ok(declared, 'parity doc must declare 当前 Rust 覆盖：N / N');
  assert.strictEqual(declared[1], declared[2], 'declared coverage must be self-consistent');
  // 清单为列表格式（- `SYNTEC_...`）；73 含 3 个 ABI 符号（SYNTEC_CORE_*，
  // 文档自述「按 code 字符串去重后为 70 个稳定 code」），列表条目数应等于
  // 去重后的稳定 code 数，即声明数或声明数-3。
  const coveredSection = src.split('## 已覆盖')[1].split('##')[0];
  const coveredItems = (coveredSection.match(/^- `SYNTEC_/gm) || []).length;
  const declaredCount = Number(declared[1]);
  assert.ok(coveredItems === declaredCount || coveredItems === declaredCount - 3,
    `covered list items (${coveredItems}) should match declared ${declaredCount} (or -3 for ABI symbols)`);
});
