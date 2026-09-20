// P1 第 3 项 跨平台性能数据对比工具：读取 CI 上传的 perf-data
// `benchmark-<os>.json` 文件，对每个场景 + nav 批次输出 JS/Rust 指标表，
// 并对任一平台的 parity 失败 / fallback 比例 > 0 发出告警。
//
// 用法：
//   node scripts/comparePerfData.js perf-data/benchmark-ubuntu-latest.json \
//                                    perf-data/benchmark-windows-latest.json
//
// 设计：本工具不在 CI 上阻塞构建——任何告警只写到 stdout；CI 的
// cross-platform-alert 步骤负责把跨平台差异登记为 notice。本工具的
// 契约是「能够把任意数量的 perf-data JSON 文件解析成统一报告」，
// 便于人回归分析。

const fs = require('fs');

/**
 * Load a single perf-data JSON file produced by `benchmark:compare --json`.
 *
 * @param {string} filePath
 * @returns {{platform: string, results: object[], nav: object, regressions: object[], fallback: object}}
 */
function loadPerfFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`perf-data file not found: ${filePath}`);
  }
  const raw = fs.readFileSync(filePath, 'utf8').trim();
  if (raw.length === 0) {
    throw new Error(`perf-data file is empty: ${filePath}`);
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(`perf-data file is not valid JSON: ${filePath}: ${error.message}`);
  }
  if (!Array.isArray(parsed.results)) {
    throw new Error(`perf-data file missing 'results' array: ${filePath}`);
  }
  const platform = filePath.replace(/^.*benchmark-/, '').replace(/\.json$/, '');
  return {
    platform,
    results: parsed.results,
    nav: parsed.nav || null,
    regressions: parsed.regressions || [],
    fallback: parsed.fallback || { total: 0, ratio: 0 }
  };
}

/**
 * Compute parity / fallback warning state for one platform.
 *
 * @param {ReturnType<typeof loadPerfFile>} perf
 * @returns {{parityMismatch: number, fallbackCount: number, regressionsCount: number}}
 */
function flagAnomalies(perf) {
  let parityMismatch = 0;
  for (const r of perf.results) {
    if (r.parity !== 'equal') parityMismatch++;
  }
  if (perf.nav && typeof perf.nav.parity === 'string' && !perf.nav.parity.startsWith('equal')) {
    parityMismatch++;
  }
  return {
    parityMismatch,
    fallbackCount: Number(perf.fallback.total || 0),
    regressionsCount: perf.regressions.length
  };
}

/**
 * Format a row for stdout report. Returns the human row string.
 *
 * @param {string} scenario
 * @param {string} metric
 * @param {string} platform
 * @param {number} value
 * @returns {string}
 */
function formatRow(scenario, metric, platform, value) {
  const safeScenario = String(scenario || '').padEnd(14);
  const safeMetric = String(metric || '').padEnd(10);
  const safePlatform = String(platform || '').padEnd(16);
  return `  ${safeScenario} ${safeMetric} ${safePlatform} ${value.toFixed(2).padStart(10)} ms`;
}

/**
 * @param {string[]} [args]
 * @returns {void}
 */
function main(args = process.argv.slice(2)) {
  if (args.length === 0) {
    console.info('comparePerfData: no perf-data files provided; nothing to compare.');
    return;
  }
  const perfs = args.map(loadPerfFile);
  console.info(`P1 perf-data comparison: ${perfs.length} platform(s)`);
  const scenarios = [...new Set(perfs.flatMap(p => p.results.map(r => r.scenario)))];
  for (const scenario of scenarios) {
    for (const metric of ['js.p50', 'rust.p50', 'js.p95', 'rust.p95', 'rust.startup']) {
      const rows = [];
      for (const perf of perfs) {
        const r = perf.results.find(x => x.scenario === scenario);
        if (!r) continue;
        const js = r.js || {};
        const rust = r.rust || {};
        let value;
        if (metric === 'js.p50') value = js.p50Ms;
        else if (metric === 'js.p95') value = js.p95Ms;
        else if (metric === 'rust.p50') value = rust.p50Ms;
        else if (metric === 'rust.p95') value = rust.p95Ms;
        else if (metric === 'rust.startup') value = r.rustStartupMs;
        else value = 0;
        rows.push(formatRow(scenario, metric, perf.platform, Number(value) || 0));
      }
      if (rows.length > 0) console.info(rows.join('\n'));
    }
  }
  // nav batch row
  for (const perf of perfs) {
    if (!perf.nav) continue;
    console.info(`  nav-500-files  js.batch   ${perf.platform.padEnd(16)} ${Number(perf.nav.jsBatchMs || 0).toFixed(2).padStart(10)} ms`);
    console.info(`  nav-500-files  rust.batch ${perf.platform.padEnd(16)} ${Number(perf.nav.rustBatchMs || 0).toFixed(2).padStart(10)} ms`);
  }

  // Anomaly flags.
  let anomalies = 0;
  for (const perf of perfs) {
    const flags = flagAnomalies(perf);
    if (flags.parityMismatch > 0 || flags.fallbackCount > 0 || flags.regressionsCount > 0) {
      anomalies++;
      console.info(`  [anomaly] ${perf.platform}: parity mismatch=${flags.parityMismatch}, fallback=${flags.fallbackCount}, regressions=${flags.regressionsCount}`);
    }
  }
  if (anomalies === 0) {
    console.info('  no parity / fallback / regression anomalies detected.');
  } else {
    console.info(`  ${anomalies} platform(s) with anomalies — review before flipping default backend.`);
  }
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
  }
}

module.exports = { loadPerfFile, flagAnomalies, formatRow, main };
