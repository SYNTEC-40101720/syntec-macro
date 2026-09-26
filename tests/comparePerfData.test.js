// P1 第 3 项 跨平台 perf-data 对比工具的契约测试。
//
// 覆盖：
//   - `loadPerfFile`：文件缺失/非法 JSON/缺 results 数组 三类错误路径 + 成功路径
//   - `flagAnomalies`：fallback>0 / regressions 检测
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
  compareWithBaseline,
  main
} = require('../scripts/comparePerfData');

const VALID_PERF = {
  results: [
    {
      scenario: 'fixture',
      lineCount: 394,
      iterations: 3,
      rustWasmBytes: 312000,
      rustStartupMs: 7.2,
      rustResultBytes: 21906,
      rust: { firstMs: 35, p50Ms: 14, p95Ms: 16, maxMs: 16 }
    },
    {
      scenario: 'large-20k',
      lineCount: 20000,
      iterations: 3,
      rustWasmBytes: 312000,
      rustStartupMs: 7.2,
      rustResultBytes: 717838,
      rust: { firstMs: 464, p50Ms: 457, p95Ms: 495, maxMs: 495 }
    }
  ],
  nav: {
    scenario: 'nav-500-files',
    fileCount: 500,
    linesPerFile: 40,
    rustBatchMs: 602.68,
    rustResultBytes: 2118,
    rustFallbackCount: 0,
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

test('flagAnomalies returns zeros on no-fallback / no-regressions', () => {
  const perf = {
    platform: 'ubuntu-latest',
    results: [],
    nav: null,
    regressions: [],
    fallback: { total: 0, ratio: 0 }
  };
  const flags = flagAnomalies(perf);
  assert.deepStrictEqual(flags, { fallbackCount: 0, regressionsCount: 0 });
});

test('flagAnomalies reports fallback count', () => {
  const perf = {
    platform: 'ubuntu-latest',
    results: [],
    nav: null,
    regressions: [],
    fallback: { total: 3, ratio: 0.005 }
  };
  const flags = flagAnomalies(perf);
  assert.strictEqual(flags.fallbackCount, 3);
});

test('flagAnomalies reports regressions count', () => {
  const perf = {
    platform: 'ubuntu-latest',
    results: [],
    nav: null,
    regressions: [{ scenario: 'fixture', metric: 'rust.p50', value: 100, limit: 50 }],
    fallback: { total: 0, ratio: 0 }
  };
  const flags = flagAnomalies(perf);
  assert.strictEqual(flags.regressionsCount, 1);
});

test('formatRow pads scenario to 14 chars and metric to 10', () => {
  const row = formatRow('fixture', 'rust.p50', 'ubuntu-latest', 12.3456);
  // Quick invariant: contains both tokens and ends with ' ms'.
  assert.ok(row.includes('fixture'));
  assert.ok(row.includes('rust.p50'));
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
  assert.ok(out.includes('no fallback'), 'report must mention no anomalies');
});

test('main with anomaly does not throw (CI alert step only logs)', () => {
  const bad = {
    results: [],
    nav: null,
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

test('loadPerfFile prefers parsed.platform over fileName when present', () => {
  const data = {
    platform: 'windows-dev-machine',
    results: [{ scenario: 'fixture', parity: 'equal' }],
    nav: null,
    regressions: [],
    fallback: { total: 0, ratio: 0 }
  };
  const filePath = makeTempFile('benchmark-foo-bar.json', data);
  const perf = loadPerfFile(filePath);
  assert.strictEqual(perf.platform, 'windows-dev-machine');
});

test('loadPerfFile returns tag field when present in JSON', () => {
  const data = {
    platform: 'windows-dev',
    tag: 'v3.0.0',
    results: [{ scenario: 'fixture', parity: 'equal' }],
    nav: null,
    regressions: [],
    fallback: { total: 0, ratio: 0 }
  };
  const filePath = makeTempFile('v3.0.0.json', data);
  const perf = loadPerfFile(filePath);
  assert.strictEqual(perf.tag, 'v3.0.0');
});

test('compareWithBaseline returns no regressions when current matches baseline', () => {
  const baseline = {
    platform: 'baseline',
    results: [
      { scenario: 'fixture', rust: { p50Ms: 10 }, parity: 'equal' },
      { scenario: 'large-20k', rust: { p50Ms: 280 }, parity: 'equal' }
    ],
    nav: { rustBatchMs: 380, parity: 'equal' },
    fallback: { total: 0, ratio: 0 }
  };
  const current = {
    platform: 'current',
    results: [
      { scenario: 'fixture', rust: { p50Ms: 11 }, parity: 'equal' },
      { scenario: 'large-20k', rust: { p50Ms: 290 }, parity: 'equal' }
    ],
    nav: { rustBatchMs: 390, parity: 'equal' },
    fallback: { total: 0, ratio: 0 }
  };
  const result = compareWithBaseline(baseline, current);
  assert.deepStrictEqual(result.regressions, []);
  assert.strictEqual(result.fallback, 0);
});

test('compareWithBaseline flags Rust p50 regression > 10%', () => {
  const baseline = {
    results: [
      { scenario: 'large-20k', rust: { p50Ms: 200 }, parity: 'equal' }
    ],
    nav: null,
    fallback: { total: 0, ratio: 0 }
  };
  const current = {
    results: [
      { scenario: 'large-20k', rust: { p50Ms: 260 }, parity: 'equal' } // +30%
    ],
    nav: null,
    fallback: { total: 0, ratio: 0 }
  };
  const result = compareWithBaseline(baseline, current);
  assert.strictEqual(result.regressions.length, 1);
  assert.strictEqual(result.regressions[0].scenario, 'large-20k');
  assert.ok(result.regressions[0].deltaPct > 0.1);
});

test('compareWithBaseline flags nav batch regression > 10%', () => {
  const baseline = {
    results: [
      { scenario: 'fixture', rust: { p50Ms: 10 }, parity: 'equal' }
    ],
    nav: { rustBatchMs: 380, parity: 'equal' },
    fallback: { total: 0, ratio: 0 }
  };
  const current = {
    results: [
      { scenario: 'fixture', rust: { p50Ms: 11 }, parity: 'equal' }
    ],
    nav: { rustBatchMs: 460, parity: 'equal' }, // +21%
    fallback: { total: 0, ratio: 0 }
  };
  const result = compareWithBaseline(baseline, current);
  assert.strictEqual(result.regressions.length, 1);
  assert.strictEqual(result.regressions[0].scenario, 'nav-500-files');
  assert.strictEqual(result.regressions[0].metric, 'rust.batch');
});

test('compareWithBaseline counts fallback events and ignores legacy parity fields', () => {
  // R1.2 Stage B: parity 字段已从契约移除（语义 parity 由 compare:rust
  // golden file 守卫）；即使历史 JSON 里残留 parity 字段也不构成告警。
  const baseline = {
    results: [
      { scenario: 'fixture', rust: { p50Ms: 10 }, parity: 'equal' }
    ],
    nav: { rustBatchMs: 380, parity: 'equal' },
    fallback: { total: 0, ratio: 0 }
  };
  const current = {
    results: [
      { scenario: 'fixture', rust: { p50Ms: 10 }, parity: 'rust-only' }
    ],
    nav: { rustBatchMs: 380, parity: 'rust-only' },
    fallback: { total: 2, ratio: 0.01 }
  };
  const result = compareWithBaseline(baseline, current);
  assert.strictEqual(result.regressions.length, 0, 'legacy parity strings are not regressions');
  assert.strictEqual(result.parityMismatches, undefined, 'parityMismatches removed from contract');
  assert.strictEqual(result.fallback, 2);
});

test('main --baseline mode prints no-regressions message when current matches baseline', () => {
  const baselineData = {
    platform: 'baseline',
    tag: 'v3.0.0',
    results: [
      { scenario: 'fixture', rust: { p50Ms: 10 }, parity: 'equal' }
    ],
    nav: { rustBatchMs: 380, parity: 'equal' },
    regressions: [],
    fallback: { total: 0, ratio: 0 }
  };
  const currentData = {
    platform: 'windows-dev',
    results: [
      { scenario: 'fixture', rust: { p50Ms: 11 }, parity: 'equal' }
    ],
    nav: { rustBatchMs: 390, parity: 'equal' },
    regressions: [],
    fallback: { total: 0, ratio: 0 }
  };
  const baselinePath = makeTempFile('v3.0.0.json', baselineData);
  const currentPath = makeTempFile('current-perf.json', currentData);
  const argv = process.argv;
  process.argv = ['node', 'comparePerfData', '--baseline', baselinePath, currentPath];
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
  assert.ok(out.includes('baseline comparison'), `must show baseline header, got: ${out}`);
  assert.ok(out.includes('v3.0.0'), `must mention baseline tag, got: ${out}`);
  assert.ok(out.includes('no regressions'), `must mention no regressions, got: ${out}`);
});

test('main --baseline mode prints ::warning:: when regression detected', () => {
  const baselineData = {
    platform: 'baseline',
    tag: 'v3.0.0',
    results: [
      { scenario: 'large-20k', rust: { p50Ms: 200 }, parity: 'equal' }
    ],
    nav: null,
    regressions: [],
    fallback: { total: 0, ratio: 0 }
  };
  const currentData = {
    platform: 'windows-dev',
    results: [
      { scenario: 'large-20k', rust: { p50Ms: 300 }, parity: 'equal' } // +50%
    ],
    nav: null,
    regressions: [],
    fallback: { total: 0, ratio: 0 }
  };
  const baselinePath = makeTempFile('v3.0.0.json', baselineData);
  const currentPath = makeTempFile('current-perf.json', currentData);
  const argv = process.argv;
  process.argv = ['node', 'comparePerfData', '--baseline', baselinePath, currentPath];
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
  assert.ok(out.includes('[regression]'), `must show regression, got: ${out}`);
  assert.ok(out.includes('::warning::'), `must emit GitHub ::warning:: annotation for CI log, got: ${out}`);
  assert.ok(out.includes('large-20k'));
});

// --- --strict 硬门禁模式 (CI 性能回归门禁) ---

function runBaselineMain(baselinePath, currentPath, strict) {
  const argv = process.argv;
  const args = ['--baseline', baselinePath, currentPath];
  if (strict) args.push('--strict');
  process.argv = ['node', 'comparePerfData', ...args];
  const origInfo = console.info;
  const lines = [];
  console.info = (msg) => { lines.push(String(msg)); };
  const prevExitCode = process.exitCode;
  process.exitCode = 0;
  try {
    main();
  } finally {
    console.info = origInfo;
    process.argv = argv;
    const exitCode = process.exitCode;
    process.exitCode = prevExitCode || 0;
    return { out: lines.join('\n'), exitCode };
  }
}

test('main --baseline --strict exits 0 when current matches baseline', () => {
  const baselineData = {
    platform: 'baseline', tag: 'v4.0.0',
    results: [{ scenario: 'fixture', rust: { p50Ms: 10 } }],
    nav: { rustBatchMs: 380 },
    regressions: [], fallback: { total: 0, ratio: 0 }
  };
  const currentData = {
    platform: 'ci-ubuntu',
    results: [{ scenario: 'fixture', rust: { p50Ms: 11 } }],
    nav: { rustBatchMs: 390 },
    regressions: [], fallback: { total: 0, ratio: 0 }
  };
  const { out, exitCode } = runBaselineMain(
    makeTempFile('v4.0.0.json', baselineData),
    makeTempFile('current.json', currentData),
    true
  );
  assert.strictEqual(exitCode, 0, `strict gate should pass, got: ${out}`);
  assert.ok(out.includes('strict gate: PASS'));
});

test('main --baseline --strict exits 1 when Rust p50 regresses > 10%', () => {
  const baselineData = {
    platform: 'baseline', tag: 'v4.0.0',
    results: [{ scenario: 'large-20k', rust: { p50Ms: 200 } }],
    nav: null,
    regressions: [], fallback: { total: 0, ratio: 0 }
  };
  const currentData = {
    platform: 'ci-ubuntu',
    results: [{ scenario: 'large-20k', rust: { p50Ms: 300 } }], // +50%
    nav: null,
    regressions: [], fallback: { total: 0, ratio: 0 }
  };
  const { out, exitCode } = runBaselineMain(
    makeTempFile('v4.0.0.json', baselineData),
    makeTempFile('current.json', currentData),
    true
  );
  assert.strictEqual(exitCode, 1, `strict gate should fail on regression, got: ${out}`);
  assert.ok(out.includes('strict gate: FAIL'));
  assert.ok(out.includes('::warning::'));
});

test('main --baseline --strict exits 1 when fallback events present', () => {
  const baselineData = {
    platform: 'baseline', tag: 'v4.0.0',
    results: [{ scenario: 'fixture', rust: { p50Ms: 10 } }],
    nav: null,
    regressions: [], fallback: { total: 0, ratio: 0 }
  };
  const currentData = {
    platform: 'ci-ubuntu',
    results: [{ scenario: 'fixture', rust: { p50Ms: 10 } }],
    nav: null,
    regressions: [], fallback: { total: 3, ratio: 0.01 }
  };
  const { out, exitCode } = runBaselineMain(
    makeTempFile('v4.0.0.json', baselineData),
    makeTempFile('current.json', currentData),
    true
  );
  assert.strictEqual(exitCode, 1, `strict gate should fail on fallback, got: ${out}`);
  assert.ok(out.includes('strict gate: FAIL'));
});

test('main --baseline without --strict stays advisory (exitCode unchanged)', () => {
  const baselineData = {
    platform: 'baseline', tag: 'v4.0.0',
    results: [{ scenario: 'fixture', rust: { p50Ms: 10 } }],
    nav: null,
    regressions: [], fallback: { total: 0, ratio: 0 }
  };
  const currentData = {
    platform: 'ci-ubuntu',
    results: [{ scenario: 'fixture', rust: { p50Ms: 30 } }], // +200%
    nav: null,
    regressions: [], fallback: { total: 0, ratio: 0 }
  };
  const { out, exitCode } = runBaselineMain(
    makeTempFile('v4.0.0.json', baselineData),
    makeTempFile('current.json', currentData),
    false
  );
  assert.strictEqual(exitCode, 0, `advisory mode must not fail, got: ${out}`);
  assert.ok(out.includes('[regression]'));
  assert.ok(!out.includes('strict gate'), 'advisory mode must not print strict gate lines');
});
