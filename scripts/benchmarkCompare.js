// P1 性能基准（R1.2 Stage B 后纯 Rust/Wasm）：fixture / 20,000 行档案 /
// 500 文件 navigation 三场景，测量 Rust/Wasm 的 p50/p95/max/resultBytes/
// startupMs/batchMs 与 fallback 比例。
//
// 设计目标（来自 docs/Rust-Wasm切换验收门禁.md §P1）：
//   - 真实 fixture、20,000 行档案、500 文件 navigation 分别记录启动时间、
//     p50/p95 分析延迟、JSON 占用、首次与重复查询、fallback 比例。
//   - 历史 JS 对照路径已随 R1.2 Stage B (2026-09-22) JS 后端退役移除；
//     JS↔Rust 语义 parity 由 `npm.cmd run compare:rust` 走
//     `tests/fixtures/rust-parity-baseline.json` golden file 守卫。
//
// 本脚本：
//   - Rust/Wasm 走 `createRustWasmAdapter(instance.exports)` 真实 request ABI
//     （生产 asset 加载器 + 生产 adapter 路径）；
//   - navigation 场景走 adapter 的 `extract_navigation` 路径（batch 测量 +
//     代表性 fingerprint 采样）。

const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');
const {
  calculatePercentile,
  createLargeMacroText,
  createRequest
} = require('./benchmarkAnalysis');
const { createRustWasmAdapter } = require('./rustWasmAdapter');
const { loadRustWasmAsset } = require('../src/rustWasmAsset');

const DEFAULT_MANIFEST_PATH = path.join(
  __dirname,
  '..',
  'assets',
  'rust-wasm',
  'manifest.json'
);

const FIXTURE_PATH = path.join(__dirname, '..', 'tests', 'fixtures', 'test-demo.nc');
const NAV_FILE_COUNT = 500;
const NAV_LINES_PER_FILE = 40;

/**
 * Build a 500-file navigation fixture parallel to scripts/benchmarkNavigation.js.
 *
 * @returns {{filePath: string, text: string}[]}
 */
function buildNavigationFixture() {
  const files = [];
  for (let fileIndex = 0; fileIndex < NAV_FILE_COUNT; fileIndex++) {
    const lines = ['%@MACRO'];
    for (let lineIndex = 1; lineIndex < NAV_LINES_PER_FILE; lineIndex++) {
      if (lineIndex % 10 === 0) {
        lines.push(`N${fileIndex * 100 + lineIndex};`);
      } else if (lineIndex % 3 === 0) {
        lines.push(`G65 P${1000 + (fileIndex % 20)} A${lineIndex};`);
      } else {
        lines.push(`#1 := #1 + ${lineIndex};`);
      }
    }
    files.push({
      filePath: `/workspace/G${String(fileIndex).padStart(4, '0')}.nc`,
      text: lines.join('\n')
    });
  }
  return files;
}

/**
 * Measure durations of `fn()` over `iterations` runs after a single warm-up.
 * Records first / repeat phases separately and reports p50/p95/max.
 *
 * @param {() => unknown} fn
 * @param {number} iterations
 * @returns {{
 *   p50Ms: number, p95Ms: number, maxMs: number,
 *   firstMs: number, lastResult: unknown
 * }}
 */
function measure(fn, iterations) {
  const firstStart = performance.now();
  const lastResult = fn();
  const firstMs = performance.now() - firstStart;
  const durations = [];
  for (let index = 0; index < iterations; index++) {
    const start = performance.now();
    fn();
    durations.push(performance.now() - start);
  }
  return {
    p50Ms: calculatePercentile(durations, 0.5),
    p95Ms: calculatePercentile(durations, 0.95),
    maxMs: Math.max(...durations),
    firstMs,
    lastResult
  };
}

// P1 第 2 项: regression threshold table for perf guard rails.
// Each entry caps the Rust/Wasm backend's p50/p95/max/startup/batch ms for
// the scenario so a silent regression flips the script exit code to 1.
//
// 阈值来源（2026-09-20, dev machine, 5 runs 收敛）+ R1.2 后沿用：
//   - fixture: Rust p50 ≤ 15ms；p95 ≤ 20ms；startup ≤ 50ms。
//   - large-20k: Rust p50 ≤ 400ms (Rust 稳定优于旧 JS ×0.95)；
//     p95 ≤ 500ms；startup ≤ 50ms。
//   - nav-500-files: Rust batch ≤ 600ms；startup ≤ 50ms。
//
// CI 路径仍 `--no-threshold` 跑（Linux runner ≠ dev machine 速度基线）；
// 本机 dev 跑 `npm.cmd run benchmark:compare --iterations 10` 不带
// --no-threshold 即可触发本表硬门禁任一 FAIL → exitCode=1。
const REGRESSION_THRESHOLDS = {
  fixture: { rustP50Ms: 15, rustP95Ms: 20, rustStartupMs: 50 },
  'large-20k': { rustP50Ms: 400, rustP95Ms: 500, rustStartupMs: 50 },
  'nav-500-files': { rustBatchMs: 600, rustStartupMs: 50 }
};

/**
 * @param {object} result
 * @returns {number}
 */
function computeResultJsonBytes(result) {
  return Buffer.byteLength(JSON.stringify(result), 'utf8');
}

/**
 * Flatten a result diagnostics/symbols sequence into a stable shape for the
 * nav representative-fingerprint sample (does not include `backend`/`bytes`).
 *
 * @param {import('../src/analysisProtocol').AnalysisResult} result
 * @returns {object}
 */
function stableFingerprint(result) {
  if (result === null || result === undefined || !result.diagnostics) return null;
  return {
    diagnostics: result.diagnostics.map(d => ({
      line: d.range.start.line + 1,
      col: d.range.start.character,
      endCol: d.range.end.character,
      severity: d.severity,
      code: d.code
    })),
    symbols: result.symbols.map(s => ({
      name: s.name,
      kind: s.kind,
      line: s.line
    })),
    hasNavigation: result.navigation !== null
  };
}

/**
 * Load the Rust/Wasm adapter via the production loader.
 *
 * @param {string} [manifestPath]
 * @returns {Promise<{
 *   adapter: (request: import('../src/analysisProtocol').AnalysisRequest) => import('../src/analysisProtocol').AnalysisResult,
 *   instance: WebAssembly.Instance, bytes: Buffer, startupMs: number
 * }>}
 */
async function loadRustAdapter(manifestPath = DEFAULT_MANIFEST_PATH, adapterOptions) {
  const start = performance.now();
  const { instance, bytes } = await loadRustWasmAsset(manifestPath);
  const adapter = createRustWasmAdapter(instance.exports, adapterOptions);
  const startupMs = performance.now() - start;
  return { adapter, instance, bytes, startupMs };
}

/**
 * @typedef {Object} Scenario
 * @property {string} name
 * @property {import('../src/analysisProtocol').AnalysisRequest} request
 * @property {number} lineCount
 */

/**
 * @param {Scenario[]} scenarios
 * @param {number} iterations
 * @returns {Promise<object[]>}
 */
async function runScenarios(scenarios, iterations) {
  const { adapter, bytes, startupMs: rustStartupMs } = await loadRustAdapter();

  const results = [];
  let fallbackCount = 0;
  for (const scenario of scenarios) {
    let rustMeasure = null;
    let rustResultBytes = 0;
    try {
      rustMeasure = measure(() => {
        const result = adapter(scenario.request);
        if (rustResultBytes === 0) rustResultBytes = computeResultJsonBytes(result);
        return result;
      }, iterations);
    } catch {
      fallbackCount++;
      rustMeasure = { firstMs: 0, p50Ms: 0, p95Ms: 0, maxMs: 0, lastResult: null };
    }

    results.push({
      scenario: scenario.name,
      lineCount: scenario.lineCount,
      iterations,
      rustWasmBytes: bytes.length,
      rustStartupMs,
      rustResultBytes,
      rust: {
        firstMs: rustMeasure.firstMs,
        p50Ms: rustMeasure.p50Ms,
        p95Ms: rustMeasure.p95Ms,
        maxMs: rustMeasure.maxMs
      }
    });
  }
  return { results, fallbackCount };
}

/**
 * @param {string[]} [args]
 * @returns {Promise<void>}
 */
async function main(args = process.argv.slice(2)) {
  const iterationsIndex = args.indexOf('--iterations');
  const iterations = Number(iterationsIndex >= 0 ? args[iterationsIndex + 1] : 10);
  if (!Number.isInteger(iterations) || iterations <= 0) {
    throw new Error('--iterations must be a positive integer');
  }
  const jsonOut = args.includes('--json');
  const enforceThresholds = !args.includes('--no-threshold');

  const fixtureText = fs.readFileSync(FIXTURE_PATH, 'utf8');
  const largeText = createLargeMacroText(20000);
  const scenarios = [
    {
      name: 'fixture',
      request: createRequest(fixtureText, 'file:///tests/fixtures/test-demo.nc'),
      lineCount: fixtureText.split(/\r?\n/).length
    },
    {
      name: 'large-20k',
      request: createRequest(largeText, 'file:///benchmark/large-macro.nc'),
      lineCount: largeText.split(/\r?\n/).length
    }
  ];

  // 500-file navigation 场景：累加所有文件的 request 分析与 navigation 构建，
  // 与 scripts/benchmarkNavigation.js 同一 fixture。
  const navFiles = buildNavigationFixture();
  const { results, fallbackCount: scenarioFallbackCount } = await runScenarios(scenarios, iterations);

  // Navigation 500-file batch 耗时（不参与 p50，单独报告）。
  const { adapter } = await loadRustAdapter(DEFAULT_MANIFEST_PATH, { navigationFilePath: 'nav-batch' });
  let rustNavFallbackCount = 0;
  const rustNavStart = performance.now();
  const rustNav = navFiles.map(f => {
    try {
      return adapter(createRequest(f.text, 'file://' + f.filePath.slice(1)));
    } catch {
      rustNavFallbackCount++;
      return null;
    }
  });
  const rustNavBatchMs = performance.now() - rustNavStart;

  // JSON 输出体量抽样（取第一个文件作为代表性样本）。
  const rustNavResultBytes = rustNav[0] ? computeResultJsonBytes(rustNav[0]) : 0;

  const navResult = {
    scenario: 'nav-500-files',
    fileCount: navFiles.length,
    linesPerFile: NAV_LINES_PER_FILE,
    rustBatchMs: rustNavBatchMs,
    rustResultBytes: rustNavResultBytes,
    rustFallbackCount: rustNavFallbackCount,
    representativeFingerprint: stableFingerprint(rustNav[0])
  };

  // P1 第 2 项: regression threshold guard. Exit with code 1 if any metric
  // exceeds the recorded baseline. Missing threshold entries are skipped.
  // `--no-threshold` disables the guard (used by CI smoke runs where the
  // slower Linux runner isn't expected to beat the Windows dev baseline).
  /** @type {{scenario: string, metric: string, value: number, limit: number}[]} */
  const regressions = [];
  if (enforceThresholds) {
    for (const r of results) {
      const caps = REGRESSION_THRESHOLDS[r.scenario];
      if (!caps) continue;
      if (caps.rustP50Ms !== undefined && r.rust.p50Ms > caps.rustP50Ms) {
        regressions.push({ scenario: r.scenario, metric: 'rust.p50', value: r.rust.p50Ms, limit: caps.rustP50Ms });
      }
      if (caps.rustP95Ms !== undefined && r.rust.p95Ms > caps.rustP95Ms) {
        regressions.push({ scenario: r.scenario, metric: 'rust.p95', value: r.rust.p95Ms, limit: caps.rustP95Ms });
      }
      if (caps.rustStartupMs !== undefined && r.rustStartupMs > caps.rustStartupMs) {
        regressions.push({ scenario: r.scenario, metric: 'rust.startup', value: r.rustStartupMs, limit: caps.rustStartupMs });
      }
    }
    const navCaps = REGRESSION_THRESHOLDS['nav-500-files'];
    if (navCaps) {
      if (navCaps.rustBatchMs !== undefined && navResult.rustBatchMs > navCaps.rustBatchMs) {
        regressions.push({ scenario: 'nav-500-files', metric: 'rust.batch', value: navResult.rustBatchMs, limit: navCaps.rustBatchMs });
      }
      if (navCaps.rustStartupMs !== undefined && results[0] && results[0].rustStartupMs > navCaps.rustStartupMs) {
        regressions.push({ scenario: 'nav-500-files', metric: 'rust.startup', value: results[0].rustStartupMs, limit: navCaps.rustStartupMs });
      }
    }
  }

  // fallback 分母 = scenarios × 1 (Rust) + navFiles × 1 (Rust nav)。
  const totalFallback = scenarioFallbackCount + rustNavFallbackCount;
  const fallbackRatio = scenarios.length + navFiles.length > 0
    ? totalFallback / (scenarios.length + navFiles.length)
    : 0;

  if (jsonOut) {
    console.info(JSON.stringify({
      // P1 第 4 项: 元数据随 JSON 自描述, 供 compare:perf --baseline 门禁与
      // perf-baseline 归档直接消费, 不再依赖文件名推断 platform。
      collectedAt: new Date().toISOString(),
      platform: `${process.platform}-${process.arch}`,
      nodeVersion: process.version,
      results, nav: navResult, regressions, fallback: {
        total: totalFallback, ratio: Number(fallbackRatio.toFixed(4))
      }
    }, null, 2));
    return;
  }

  console.info(`P1 Rust/Wasm benchmark: ${iterations} measured runs per scenario`);
  for (const r of results) {
    console.info(
      `  ${r.scenario} (${r.lineCount} lines): ` +
      `Rust p50 ${r.rust.p50Ms.toFixed(2)} ms / p95 ${r.rust.p95Ms.toFixed(2)} ms / max ${r.rust.maxMs.toFixed(2)} ms / first ${r.rust.firstMs.toFixed(2)} ms / JSON ${r.rustResultBytes} bytes`
    );
  }
  console.info(
    `  ${navResult.scenario} (${navResult.fileCount} files × ${navResult.linesPerFile} lines): ` +
    `Rust batch ${navResult.rustBatchMs.toFixed(2)} ms / JSON ${navResult.rustResultBytes} bytes / fallback ${navResult.rustFallbackCount}`
  );
  console.info(
    `  startup: Rust wasm ${results[0].rustStartupMs.toFixed(2)} ms (artifact ${results[0].rustWasmBytes} bytes)`
  );
  console.info(
    `  fallback: ${totalFallback} / ${scenarios.length + navFiles.length} runs ` +
    `(ratio ${(fallbackRatio * 100).toFixed(2)}%)`
  );

  if (regressions.length > 0) {
    console.info('  regressions:');
    for (const { scenario, metric, value, limit } of regressions) {
      console.info(`    ${scenario}.${metric} = ${value.toFixed(2)} ms > limit ${limit} ms`);
    }
    process.exitCode = 1;
  }
  return undefined;
}

if (require.main === module) {
  main().catch(err => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
  });
}

module.exports = {
  REGRESSION_THRESHOLDS,
  buildNavigationFixture,
  computeResultJsonBytes,
  loadRustAdapter,
  measure,
  runScenarios,
  stableFingerprint,
  NAV_FILE_COUNT,
  NAV_LINES_PER_FILE
};
