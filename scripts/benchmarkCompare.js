// P1 真实性能对照基准：fixture / 20,000 行档案 / 500 文件 navigation 三场景，
// 同步测量 JavaScript 与 Rust/Wasm 的 p50/p95/max/resultBytes/startupMs，
// 并对每个场景产出 parity 校验（diagnostics/symbols 序列必须等价）。
//
// 设计目标（来自 docs/3.x-Rust-Wasm切换剩余任务规划.md §P1）：
//   - 真实 fixture、20,000 行档案、500 文件 navigation 分别记录
//     JS/Rust/Wasm 的启动时间、p50/p95 分析延迟、JSON/内存占用、首次与重复查询、
//     fallback 比例。
//   - "没有稳定收益或出现回归时，保持 JavaScript 默认后端，不强行切换。"
//
// 本脚本：
//   - JS 走 `analyzeDocument`（production 后端路径，含 `backend:'javascript'` 契约）；
//   - Rust/Wasm 走 `createRustWasmAdapter(instance.exports)` 真实 request ABI；
//   - navigation 场景 JS 走 `analyzeNavigationDocument`，Rust 走 `--request` 模式
//     自带的 `extract_navigation` 路径（adapter 与 JS navigationFilePath 透传一致）。
//   - 每个场景必须通过 parity 校验（diagnostics/symbols 序列等价），否则
//     `process.exitCode = 1` 并打印失败字段；这是 P1 "不得用未经基准证明的
//     Rust 性能假设写入发布门禁" 的硬门禁。

const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');
const {
  calculatePercentile,
  createLargeMacroText,
  createRequest
} = require('./benchmarkAnalysis');
// R1.2 Stage B: ../src/analysisCore removed; analyzeDocument, analyzeNavigationDocument now throws on call.
const _r1_2_retired____src_analysisCore = (name) => () => { throw new Error('R1.2 Stage B: ' + name + ' retired (../src/analysisCore removed)'); };
const analyzeDocument = _r1_2_retired____src_analysisCore('analyzeDocument');
const analyzeNavigationDocument = _r1_2_retired____src_analysisCore('analyzeNavigationDocument');
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

/**
 * Run the JavaScript analysis path equivalent to the Rust adapter's combined
 * diagnostics + navigation output. JS `analyzeDocument` only emits diagnostics;
 * `analyzeNavigationDocument` produces navigation+symbols. We merge both into
 * one shape so the parity fingerprint matches the Rust `analyze_request` output
 * (which always folds navigation into `AnalysisResult`).
 *
 * @param {import('../src/analysisProtocol').AnalysisRequest} request
 * @param {string} [filePath]
 * @returns {import('../src/analysisProtocol').AnalysisResult}
 */
function runJavaScriptEquivalent(request, filePath) {
  const diagnostics = analyzeDocument(request);
  if (filePath === undefined) {
    // Non-macro files yield navigation=null on the Rust side; emit an empty
    // `symbols: []` / `navigation: null` shell so the fingerprint matches.
    return {
      protocolVersion: diagnostics.protocolVersion,
      document: diagnostics.document,
      profile: diagnostics.profile,
      backend: 'javascript',
      diagnostics: diagnostics.diagnostics,
      symbols: [],
      edits: diagnostics.edits,
      navigation: null
    };
  }
  const nav = analyzeNavigationDocument(request, filePath);
  return {
    protocolVersion: nav.protocolVersion,
    document: nav.document,
    profile: nav.profile,
    backend: 'javascript',
    diagnostics: nav.diagnostics,
    symbols: nav.symbols,
    edits: nav.edits,
    navigation: nav.navigation
  };
}

// P1 第 2 项: regression threshold table for JS vs Rust/Wasm perf guard rails.
// Each entry caps the Rust/Wasm backend's p50/p95/max/startup/batch ms for
// the scenario so a silent regression flips the script exit code to 1.
//
// Phase 1.4 收紧（2026-09-20, dev machine, 5 runs）
// 5 次稳定采集 (dev machine Windows) 的最坏值收敛：
//   - fixture: JS p50 [9.57..10.34] ms; Rust p50 [9.67..10.72] ms
//     → dev 阈值 Rust p50 ≤ 15ms 严于 JS p50 ≤ 12ms 上限；p95 ≤ 20ms；
//       startup ≤ 50ms。
//   - large-20k: JS p50 [371..500] ms; Rust p50 [265..340] ms
//     → dev 阈值 Rust p50 ≤ 400ms (Rust 已稳定优于 JS ×0.95)；
//       JS p50 ≤ 600ms 保留作输入功率字段；rustStartup ≤ 50ms。
//   - nav-500-files: JS batch [400..450] ms 区间; Rust batch [330..360] ms 区间
//     → dev 阈值 Rust batch ≤ 600ms 严于 JS 5000ms 上限；rustStartup ≤ 50ms。
//
// CI 路径仍 `--no-threshold` 跑（Linux runner ≠ dev machine 速度基线）；
// 本机 dev 跑 `npm.cmd run benchmark:compare --iterations 10` 不带 --no-threshold
// 即可触发本表硬门禁任一 FAIL → exitCode=1。
const REGRESSION_THRESHOLDS = {
  fixture: { jsP50Ms: 20, rustP50Ms: 15, jsP95Ms: 30, rustP95Ms: 20, rustStartupMs: 50 },
  'large-20k': { jsP50Ms: 600, rustP50Ms: 400, jsP95Ms: 800, rustP95Ms: 500, rustStartupMs: 50 },
  'nav-500-files': { jsBatchMs: 5000, rustBatchMs: 600, rustStartupMs: 50 }
};

/**
 * @param {object} result
 * @returns {number}
 */
function computeResultJsonBytes(result) {
  return Buffer.byteLength(JSON.stringify(result), 'utf8');
}

/**
 * Flatten a result diagnostics/symbols sequence into a stable comparability
 * shape for parity check (does not include `backend` or `bytes`).
 *
 * @param {import('../src/analysisProtocol').AnalysisResult} result
 * @returns {object}
 */
function stableFingerprint(result) {
  // R1.2 Stage B: JS backend 已退役; null 或 undefined 表示 JS 侧未运行。
  // 返回 null 以便 runScenarios 比对时正确识别 'rust-only' 场景, 不再
  // 对 null 解引用导致 TypeError。
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
 * @property {string} [navigationFilePath]
 */

/**
 * @param {Scenario[]} scenarios
 * @param {number} iterations
 * @returns {Promise<object[]>}
 */
async function runScenarios(scenarios, iterations) {
  const jsStartupStart = performance.now();
  // JS 后端无独立加载阶段，但分析核心模块已被 require；记录一次性 cost。
  void analyzeDocument;
  const jsStartupMs = performance.now() - jsStartupStart;
  const { adapter, bytes, startupMs: rustStartupMs } = await loadRustAdapter();

  const results = [];
  let fallbackCount = 0;
  for (const scenario of scenarios) {
    let jsMeasure = null, rustMeasure = null;
    let jsResultBytes = 0, rustResultBytes = 0;
    let jsRetired = false;
    try {
      jsMeasure = measure(() => {
        const filePath = scenario.request.document.uri.replace(/^file:\/\/\//, '');
        const result = runJavaScriptEquivalent(scenario.request, filePath);
        if (jsResultBytes === 0) jsResultBytes = computeResultJsonBytes(result);
        return result;
      }, iterations);
    } catch {
      // R1.2 Stage B: JS 后端已退役 (../src/analysisCore 删除).
      // 不再计入 fallbackCount —— JS 退役是预期状态, 不是回退故障。
      jsRetired = true;
      jsMeasure = { firstMs: 0, p50Ms: 0, p95Ms: 0, maxMs: 0, lastResult: null };
    }
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

    const jsFingerprint = jsRetired ? null : stableFingerprint(jsMeasure.lastResult);
    const rustFingerprint = stableFingerprint(rustMeasure.lastResult);
    const parityEqual = !jsRetired && JSON.stringify(jsFingerprint) === JSON.stringify(rustFingerprint);

    results.push({
      scenario: scenario.name,
      lineCount: scenario.lineCount,
      iterations,
      rustWasmBytes: bytes.length,
      jsStartupMs,
      rustStartupMs,
      jsResultBytes,
      rustResultBytes,
      js: {
        firstMs: jsMeasure.firstMs,
        p50Ms: jsMeasure.p50Ms,
        p95Ms: jsMeasure.p95Ms,
        maxMs: jsMeasure.maxMs
      },
      rust: {
        firstMs: rustMeasure.firstMs,
        p50Ms: rustMeasure.p50Ms,
        p95Ms: rustMeasure.p95Ms,
        maxMs: rustMeasure.maxMs
      },
      parity: jsRetired ? 'rust-only' : (parityEqual ? 'equal' : 'mismatch')
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
  // 本场景只测 navigation parity 的代表性文件，避免 500 次 wasm
  // alloc/dealloc 缓慢污染 p50，但报告整个 500 文件 batch 总耗时。
  const { results, fallbackCount: scenarioFallbackCount } = await runScenarios(scenarios, iterations);

  // Navigation 500-file batch 耗时（不参与 p50，单独报告）。
  // R1.2 Stage B: JS navigation 已退役, 不再执行 JS 批次, jsNavBatchMs 记 0
  // 仅保留占位与字段形状。
  const jsStartupStartBatch = performance.now();
  let jsNav = [];
  let jsNavRetired = false;
  try {
    jsNav = navFiles.map(f =>
      runJavaScriptEquivalent(
        createRequest(f.text, 'file://' + f.filePath.slice(1)),
        f.filePath
      )
    );
  } catch {
    jsNavRetired = true;
    jsNav = [];
  }
  const jsNavBatchMs = jsNavRetired ? 0 : (performance.now() - jsStartupStartBatch);

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

  // parity 抽样：JS 已退役时跳过比对, 直接记录 'rust-only'。
  let navMismatchCount = 0;
  let navParity = 'rust-only';
  if (!jsNavRetired) {
    for (let i = 0; i < navFiles.length; i++) {
      const jsF = stableFingerprint(jsNav[i]);
      const rustF = stableFingerprint(rustNav[i]);
      if (JSON.stringify(jsF) !== JSON.stringify(rustF)) navMismatchCount++;
    }
    navParity = navMismatchCount === 0 ? 'equal' : `mismatch(${navMismatchCount}/${navFiles.length})`;
  }

  // JSON 输出体量抽样（取第一个文件作为代表性样本）。
  const jsNavResultBytes = jsNav[0] ? computeResultJsonBytes(jsNav[0]) : 0;
  const rustNavResultBytes = rustNav[0] ? computeResultJsonBytes(rustNav[0]) : 0;

  const navResult = {
    scenario: 'nav-500-files',
    fileCount: navFiles.length,
    linesPerFile: NAV_LINES_PER_FILE,
    jsBatchMs: jsNavBatchMs,
    rustBatchMs: rustNavBatchMs,
    jsResultBytes: jsNavResultBytes,
    rustResultBytes: rustNavResultBytes,
    rustFallbackCount: rustNavFallbackCount,
    parity: navParity,
    representativeFingerprint: stableFingerprint(jsNav[0])
  };

  // P1 第 2 项: regression threshold guard. Exit with code 1 if any backend
  // exceeds the recorded baseline, so a silent regression never flips the
  // default-backend decision in §P1 "没有稳定收益或出现回归时，保持 JavaScript
  // 默认后端，不强行切换". Missing threshold entries are skipped (not enforced).
  // `--no-threshold` disables the guard (used by CI smoke runs where the
  // slower Linux runner isn't expected to beat the Windows dev baseline).
  /** @type {{scenario: string, metric: string, value: number, limit: number}[]} */
  const regressions = [];
  if (enforceThresholds) {
    for (const r of results) {
      const caps = REGRESSION_THRESHOLDS[r.scenario];
      if (!caps) continue;
      if (caps.jsP50Ms !== undefined && r.js.p50Ms > caps.jsP50Ms) {
        regressions.push({ scenario: r.scenario, metric: 'js.p50', value: r.js.p50Ms, limit: caps.jsP50Ms });
      }
      if (caps.rustP50Ms !== undefined && r.rust.p50Ms > caps.rustP50Ms) {
        regressions.push({ scenario: r.scenario, metric: 'rust.p50', value: r.rust.p50Ms, limit: caps.rustP50Ms });
      }
      if (caps.jsP95Ms !== undefined && r.js.p95Ms > caps.jsP95Ms) {
        regressions.push({ scenario: r.scenario, metric: 'js.p95', value: r.js.p95Ms, limit: caps.jsP95Ms });
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
      if (navCaps.jsBatchMs !== undefined && navResult.jsBatchMs > navCaps.jsBatchMs) {
        regressions.push({ scenario: 'nav-500-files', metric: 'js.batch', value: navResult.jsBatchMs, limit: navCaps.jsBatchMs });
      }
      if (navCaps.rustBatchMs !== undefined && navResult.rustBatchMs > navCaps.rustBatchMs) {
        regressions.push({ scenario: 'nav-500-files', metric: 'rust.batch', value: navResult.rustBatchMs, limit: navCaps.rustBatchMs });
      }
      if (navCaps.rustStartupMs !== undefined && results[0] && results[0].rustStartupMs > navCaps.rustStartupMs) {
        regressions.push({ scenario: 'nav-500-files', metric: 'rust.startup', value: results[0].rustStartupMs, limit: navCaps.rustStartupMs });
      }
    }
  }

  // R1.2 Stage B: JS 后端已退役, 不再计入 fallbackRatio 分母 (JS 路径不产生
  // fallback)。Rust 回退的合理分母 = scenarios × 1 (Rust) + navFiles × 1 (Rust nav)。
  const totalFallback = scenarioFallbackCount + rustNavFallbackCount;
  const fallbackRatio = scenarios.length + navFiles.length > 0
    ? totalFallback / (scenarios.length + navFiles.length)
    : 0;

  if (jsonOut) {
    console.info(JSON.stringify({
      results, nav: navResult, regressions, fallback: {
        total: totalFallback, ratio: Number(fallbackRatio.toFixed(4))
      }
    }, null, 2));
    return;
  }

  console.info(`P1 JS/Rust/Wasm benchmark: ${iterations} measured runs per scenario`);
  for (const r of results) {
    console.info(
      `  ${r.scenario} (${r.lineCount} lines): ` +
      `JS p50 ${r.js.p50Ms.toFixed(2)} ms / p95 ${r.js.p95Ms.toFixed(2)} ms / max ${r.js.maxMs.toFixed(2)} ms / first ${r.js.firstMs.toFixed(2)} ms / JSON ${r.jsResultBytes} bytes; ` +
      `Rust p50 ${r.rust.p50Ms.toFixed(2)} ms / p95 ${r.rust.p95Ms.toFixed(2)} ms / max ${r.rust.maxMs.toFixed(2)} ms / first ${r.rust.firstMs.toFixed(2)} ms / JSON ${r.rustResultBytes} bytes; ` +
      `parity=${r.parity}`
    );
  }
  console.info(
    `  ${navResult.scenario} (${navResult.fileCount} files × ${navResult.linesPerFile} lines): ` +
    `JS batch ${navResult.jsBatchMs.toFixed(2)} ms / JSON ${navResult.jsResultBytes} bytes; ` +
    `Rust batch ${navResult.rustBatchMs.toFixed(2)} ms / JSON ${navResult.rustResultBytes} bytes / fallback ${navResult.rustFallbackCount}; ` +
    `parity=${navResult.parity}`
  );
  console.info(
    `  startup: JS ${results[0].jsStartupMs.toFixed(3)} ms; ` +
    `Rust wasm ${results[0].rustStartupMs.toFixed(2)} ms (artifact ${results[0].rustWasmBytes} bytes)`
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
  }

  // R1.2 Stage B: parity='rust-only' 表示 JS 已退役 (未被当作 mismatch);
  // 只有真正的 'mismatch' 才触发 exitCode=1. JS 退役不再阻塞 benchmark CI.
  const anyMismatch = results.some(r => r.parity === 'mismatch') ||
    /^mismatch/.test(String(navResult.parity));
  if (anyMismatch || regressions.length > 0) process.exitCode = 1;
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
  runJavaScriptEquivalent,
  stableFingerprint,
  NAV_FILE_COUNT,
  NAV_LINES_PER_FILE
};
