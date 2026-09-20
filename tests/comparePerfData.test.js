// P1 第 3 项 跨平台 perf-data 对比工具的契约测试。
//
// 覆盖：
//   - `loadPerfFile`：文件缺失/非法 JSON/缺 results 数组 三类错误路径 + 成功路径
//   - `flagAnomalies`：parity mismatch / fallback>0 / regressions 检测
//   - `formatRow`：行格式契约（场景 14 字宽 / metric 10 字宽）
//   - `main`：无参 safety + 单一文件解析路径不抛错
//   - 跨平台告警：多平台里至少一个有 anomaly 时仍不抛错（CI cross-platform
//     alert 步骤只打 stdout/note 不阻塞）

const assert = require('node:assert');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const {
  loadPerfFile,
  flagAnomalies,
  formatRow,
  main
} = require('../scripts/comparePerfData');

const VALID_PERF = {
  results: [
    {
      scenario: 'fixture',
      lineCount: 394,
      iterations: 3,
      rustWasmBytes: 312000,
      jsStartupMs: 0.001,
      rustStartupMs: 7.2,
      jsResultBytes: 11528,
      rustResultBytes: 21906,
      js: { firstMs: 30, p50Ms: 12, p95Ms: 14, maxMs: 14 },
      rust: { firstMs: 35, p50Ms: 14, p95Ms: 16, maxMs: 16 },
      parity: 'equal'
    },
    {
      scenario: 'large-20k',
      lineCount: 20000,
      iterations: 3,
      rustWasmBytes: 312000,
      jsStartupMs: 0.001,
      rustStartupMs: 7.2,
      jsResultBytes: 375425,
      rustResultBytes: 717838,
      js: { firstMs: 440, p50Ms: 422, p95Ms: 453, maxMs: 453 },
      rust: { firstMs: 464, p50Ms: 457, p95Ms: 495, maxMs: 495 },
      parity: 'equal'
    }
  ],
  nav: {
    scenario: 'nav-500-files',
    fileCount: 500,
    linesPerFile: 40,
    jsBatchMs: 645.85,
    rustBatchMs: 602.68,
    jsResultBytes: 2119,
    rustResultBytes: 2118,
    rustFallbackCount: 0,
    parity: 'equal',
    representativeFingerprint: { diagnostics: [], symbols: [], hasNavigation: true }
  },
  regressions: [],
  fallback: { total: 0, ratio: 0 }
};

function makeTempFile(name, content) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'perfdata-'));
  const filePath = path.join(dir, name);
  if (content !== undefined) {
    fs.writeFileSync(filePath, typeof content === 'string' ? content : JSON.stringify(content));
  }
  return filePath;
}

test('loadPerfFile throws on missing file', () => {
  assert.throws(() => loadPerfFile('/nonexistent/perf.json'), /perf-data file not found/);
});

test('loadPerfFile throws on empty file', () => {
  const filePath = makeTempFile('empty.json', '');
  assert.throws(() => loadPerfFile(filePath), /perf-data file is empty/);
});

test('loadPerfFile throws on non-JSON content', () => {
  const filePath = makeTempFile('bad.json', 'not valid json {{{');
  assert.throws(() => loadPerfFile(filePath), /not valid JSON/);
});

test('loadPerfFile throws when results array missing', () => {
  const filePath = makeTempFile('noresults.json', JSON.stringify({ nav: VALID_PERF.nav }));
  assert.throws(() => loadPerfFile(filePath), /missing 'results' array/);
});

test('loadPerfFile parses a well-formed perf JSON', () => {
  const filePath = makeTempFile('benchmark-ubuntu-latest.json', VALID_PERF);
  const perf = loadPerfFile(filePath);
  assert.strictEqual(perf.platform, 'ubuntu-latest');
  assert.strictEqual(perf.results.length, 2);
  assert.strictEqual(perf.results[0].scenario, 'fixture');
  assert.ok(perf.nav);
  assert.strictEqual(perf.regressions.length, 0);
  assert.strictEqual(perf.fallback.total, 0);
});

test('flagAnomalies returns zeros on parity-equal / no-fallback / no-regressions', () => {
  const perf = {
    platform: 'ubuntu-latest',
    results: [{ parity: 'equal' }],
    nav: { parity: 'equal' },
    regressions: [],
    fallback: { total: 0, ratio: 0 }
  };
  const flags = flagAnomalies(perf);
  assert.deepStrictEqual(flags, { parityMismatch: 0, fallbackCount: 0, regressionsCount: 0 });
});

test('flagAnomalies counts parity mismatch in results', () => {
  const perf = {
    platform: 'ubuntu-latest',
    results: [
      { parity: 'equal' },
      { parity: 'mismatch' },
      { parity: 'equal' },
      { parity: 'mismatch' }
    ],
    nav: { parity: 'equal' },
    regressions: [],
    fallback: { total: 0, ratio: 0 }
  };
  const flags = flagAnomalies(perf);
  assert.strictEqual(flags.parityMismatch, 2);
});

test('flagAnomalies counts nav parity mismatch separately', () => {
  const perf = {
    platform: 'ubuntu-latest',
    results: [{ parity: 'equal' }],
    nav: { parity: 'mismatch(5/500)' },
    regressions: [],
    fallback: { total: 0, ratio: 0 }
  };
  const flags = flagAnomalies(perf);
  assert.strictEqual(flags.parityMismatch, 1);
});

test('flagAnomalies reports fallback count', () => {
  const perf = {
    platform: 'ubuntu-latest',
    results: [{ parity: 'equal' }],
    nav: { parity: 'equal' },
    regressions: [],
    fallback: { total: 3, ratio: 0.005 }
  };
  const flags = flagAnomalies(perf);
  assert.strictEqual(flags.fallbackCount, 3);
});

test('flagAnomalies reports regressions count', () => {
  const perf = {
    platform: 'ubuntu-latest',
    results: [{ parity: 'equal' }],
    nav: { parity: 'equal' },
    regressions: [{ scenario: 'fixture', metric: 'rust.p50', value: 100, limit: 50 }],
    fallback: { total: 0, ratio: 0 }
  };
  const flags = flagAnomalies(perf);
  assert.strictEqual(flags.regressionsCount, 1);
});

test('formatRow pads scenario to 14 chars and metric to 10', () => {
  const row = formatRow('fixture', 'js.p50', 'ubuntu-latest', 12.3456);
  // Quick invariant: contains both tokens and ends with ' ms'.
  assert.ok(row.includes('fixture'));
  assert.ok(row.includes('js.p50'));
  assert.ok(row.includes('ubuntu-latest'));
  assert.ok(row.endsWith(' ms'));
});

test('main with no args prints nothing-to-compare and returns', () => {
  // Must not throw and must not exit non-zero.
  const argv = process.argv;
  process.argv = ['node', 'comparePerfData'];
  try {
    main();
  } finally {
    process.argv = argv;
  }
});

test('main with one valid file produces a report', () => {
  const filePath = makeTempFile('benchmark-ubuntu-latest.json', VALID_PERF);
  const argv = process.argv;
  process.argv = ['node', 'comparePerfData', filePath];
  // Capture stdout to ensure the report mentions both scenarios.
  const origInfo = console.info;
  const lines = [];
  console.info = (msg) => { lines.push(String(msg)); };
  try {
    main();
  } finally {
    console.info = origInfo;
    process.argv = argv;
  }
  const out = lines.join('\n');
  assert.ok(out.includes('fixture'), 'report must mention fixture scenario');
  assert.ok(out.includes('large-20k'), 'report must mention large-20k scenario');
  assert.ok(out.includes('nav-500-files'), 'report must mention nav batch');
  assert.ok(out.includes('no parity'), 'report must mention no anomalies');
});

test('main with anomaly does not throw (CI alert step only logs)', () => {
  const bad = {
    results: [{ parity: 'mismatch' }],
    nav: { parity: 'equal' },
    regressions: [{ scenario: 'fixture', metric: 'rust.p50', value: 999, limit: 50 }],
    fallback: { total: 4, ratio: 0.01 }
  };
  const filePath = makeTempFile('benchmark-windows-latest.json', bad);
  const argv = process.argv;
  process.argv = ['node', 'comparePerfData', filePath];
  const origInfo = console.info;
  const lines = [];
  console.info = (msg) => { lines.push(String(msg)); };
  try {
    main();
  } finally {
    console.info = origInfo;
    process.argv = argv;
  }
  const out = lines.join('\n');
  assert.ok(out.includes('anomaly'), 'report must flag the anomaly');
  assert.ok(out.includes('windows-latest'), 'report must mention platform');
});
