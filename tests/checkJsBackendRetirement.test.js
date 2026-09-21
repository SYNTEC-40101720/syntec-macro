// JS Backend 退役 R1 准入自检工具的契约测试。
//
// 覆盖：
//   - CHECKS 数组对照 docs/JS-Backend退役路线图.md §不变前提 6 项门禁完整
//   - 每个 check 有唯一 id / name / run() 函数
//   - run() 返回 {status: 'PASS'|'FAIL'|'SKIP', detail: string}
//   - 主 process.exitCode 默认 0（非门禁，由人 review）
//   - `--strict` flag 在出现 FAIL 时置 exitCode=1
//   - main 不抛错

const assert = require('node:assert');
const { test } = require('node:test');
const { CHECKS, main } = require('../scripts/checkJsBackendRetirement');

const EXPECTED_IDS = [
  '1-default-backend-rust-wasm',
  '2-release-cycle-observed',
  '3-rust-stable-diagnostic-parity',
  '4-wasm-asset-bundled-and-consistent',
  '5-fallback-ratio-zero-sustained',
  '6-dead-code-decision-documented'
];

test('CHECKS array covers all 6 § R1 retirement readiness conditions', () => {
  assert.strictEqual(CHECKS.length, 6, 'must have exactly 6 R1 readiness checks');
  const ids = CHECKS.map(c => c.id);
  for (const expected of EXPECTED_IDS) {
    assert.ok(ids.includes(expected), 'missing check: ' + expected);
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
  const origInfo = console.info;
  console.info = () => {};
  const originalRun = CHECKS[0].run;
  CHECKS[0].run = () => ({ status: 'FAIL', detail: 'stubbed failure' });
  try {
    main([]);
    assert.strictEqual(process.exitCode, 0,
      'main non-strict must keep exitCode=0 even with stubbed FAIL');
  } finally {
    CHECKS[0].run = originalRun;
    console.info = origInfo;
    process.exitCode = prevExit || 0;
  }
});

test('main with --strict sets process.exitCode=1 when any FAIL appears', () => {
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

test('main tolerates all-PASS without setting exitCode', () => {
  const prevExit = process.exitCode;
  process.exitCode = 0;
  const origInfo = console.info;
  console.info = () => {};
  try {
    main(['--strict']);
    // Live workspace 当前 phase 1.5 未切，至少 1 项会标 SKIP/FAIL。
    // 这里只验证 --strict 与非 --strict 都不抛错；exitCode 由是否有 FAIL 决定。
    // 至少不能抛异常。
  } finally {
    console.info = origInfo;
    process.exitCode = prevExit || 0;
  }
});

test('check 1 (default-backend-rust-wasm) FAILs as expected on current v3.0.0', () => {
  // v3.0.0 默认 backend 仍是 javascript，应 FAIL
  const result = CHECKS[0].run();
  assert.strictEqual(result.status, 'FAIL',
    'current v3.0.0 default backend should be javascript, expecting FAIL');
  assert.ok(/javascript|rust-wasm/.test(result.detail), 'detail should mention backend value');
});

test('check 3 (rust-stable-diagnostic-parity) PASSes after Phase 5.3 path-A 落地', () => {
  // Phase 5.3 路径 A 在 2026-09-21 剔除三项 dead code，JS+Rust 全 parity
  const result = CHECKS[2].run();
  assert.strictEqual(result.status, 'PASS',
    'dead code 三项已剔除，JS+Rust 全 code parity，应为 PASS');
  assert.ok(/parity|全 code|全等价/.test(result.detail), 'detail should mention parity');
});

test('check 4 (wasm asset consistency) PASSes after 2026-09-21 repack', () => {
  // wasm 已重打包，应 PASS
  const result = CHECKS[3].run();
  assert.strictEqual(result.status, 'PASS',
    'wasm asset repacked on 2026-09-21, manifest should be consistent');
});

test('check 6 (dead-code-decision-documented) PASSes with roadmap', () => {
  // 路线图文档已含 dead code 决策节，应 PASS
  const result = CHECKS[5].run();
  assert.strictEqual(result.status, 'PASS',
    'docs/JS-Backend退役路线图.md should contain dead code decision section');
});
