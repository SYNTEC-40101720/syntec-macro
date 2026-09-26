// P1 第 3 项 跨平台性能数据对比工具：读取 CI 上传的 perf-data
// `benchmark-<os>.json` 文件，对每个场景 + nav 批次输出 Rust 指标表，
// 并对任一平台的 fallback 比例 > 0 / 阈值回归发出告警。
//
// R1.2 Stage B (2026-09-22): JS 对照路径已退役；perf-data 中不再有
// `js.*` 字段，parity 概念也随之移除（语义 parity 由 compare:rust
// golden file 守卫）。
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
  const platform = typeof parsed.platform === 'string' && parsed.platform.length > 0
    ? parsed.platform
    : filePath.replace(/^.*benchmark-/, '').replace(/\.json$/, '');
  return {
    platform,
    results: parsed.results,
    nav: parsed.nav || null,
    regressions: parsed.regressions || [],
    fallback: parsed.fallback || { total: 0, ratio: 0 },
    tag: typeof parsed.tag === 'string' ? parsed.tag : undefined
  };
}

/**
 * Compute fallback / regression warning state for one platform.
 *
 * @param {ReturnType<typeof loadPerfFile>} perf
 * @returns {{fallbackCount: number, regressionsCount: number}}
 */
function flagAnomalies(perf) {
  return {
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
 * 把当前采集与 baseline 按场景比对，输出 Rust p50/batch 回归 + fallback 警告。
 * 已发布版本节点的 baseline 不可改写；任一场景 Rust 指标回归 > 10% 写
 * ::warning:: 但不设 process.exitCode（reviewer 看 CI log）。
 *
 * @param {ReturnType<typeof loadPerfFile>} baseline
 * @param {ReturnType<typeof loadPerfFile>} current
 * @returns {{regressions: object[], fallback: number}}
 */
function compareWithBaseline(baseline, current) {
  const REGRESSION_THRESHOLD_PCT = 0.10;
  const regressions = [];
  let fallback = 0;

  for (const baselineResult of baseline.results || []) {
    const scenario = baselineResult.scenario;
    const currentResult = (current.results || []).find(r => r.scenario === scenario);
    if (!currentResult) continue;
    const baseRust = baselineResult.rust || {};
    const curRust = currentResult.rust || {};
    if (typeof baseRust.p50Ms === 'number' && typeof curRust.p50Ms === 'number') {
      const deltaPct = (curRust.p50Ms - baseRust.p50Ms) / Math.max(baseRust.p50Ms, 1);
      if (deltaPct > REGRESSION_THRESHOLD_PCT) {
        regressions.push({
          scenario,
          metric: 'rust.p50',
          baselineMs: baseRust.p50Ms,
          currentMs: curRust.p50Ms,
          deltaPct
        });
      }
    }
  }
  // nav batch comparison
  if (baseline.nav && current.nav) {
    const baseBatch = baseline.nav.rustBatchMs;
    const curBatch = current.nav.rustBatchMs;
    if (typeof baseBatch === 'number' && typeof curBatch === 'number') {
      const deltaPct = (curBatch - baseBatch) / Math.max(baseBatch, 1);
      if (deltaPct > REGRESSION_THRESHOLD_PCT) {
        regressions.push({
          scenario: 'nav-500-files',
          metric: 'rust.batch',
          baselineMs: baseBatch,
          currentMs: curBatch,
          deltaPct
        });
      }
    }
  }
  fallback = Number(current.fallback && current.fallback.total) || 0;
  return { regressions, fallback };
}

/**
 * @param {string[]} [args]
 * @returns {void}
 */
function main(args = process.argv.slice(2)) {
  // Phase 1.1 / Phase 2.4: --baseline <path> <current-perf.json> 比对模式
  const baselineIdx = args.indexOf('--baseline');
  if (baselineIdx >= 0) {
    const baselinePath = args[baselineIdx + 1];
    if (!baselinePath) {
      console.info('comparePerfData: --baseline requires a path argument');
      return;
    }
    const currentArgs = args.filter((_, i) => i !== baselineIdx && i !== baselineIdx + 1);
    if (currentArgs.length === 0) {
      console.info('comparePerfData: --baseline mode requires a current perf-data file');
      return;
    }
    const baseline = loadPerfFile(baselinePath);
    const current = loadPerfFile(currentArgs[0]);
    const platform = current.platform || 'unknown';
    const baselineTag = baseline.tag || baselinePath;
    console.info(`baseline comparison: ${baselineTag} → current (${platform})`);
    const result = compareWithBaseline(baseline, current);
    if (result.regressions.length === 0 && result.fallback === 0) {
      console.info('  no regressions / fallback detected.');
    } else {
      if (result.regressions.length > 0) {
        console.info(`  [regression] ${result.regressions.length} metric(s) regressed > 10%:`);
        for (const r of result.regressions) {
          const pctStr = (r.deltaPct * 100).toFixed(1);
          const baseStr = r.baselineMs.toFixed(2);
          const curStr = r.currentMs.toFixed(2);
          console.info(`    ::warning::${r.scenario} ${r.metric} ${baseStr}ms → ${curStr}ms (+${pctStr}%)`);
        }
      }
      if (result.fallback > 0) {
        console.info(`  [anomaly] current run had ${result.fallback} fallback events`);
      }
    }
    return;
  }

  if (args.length === 0) {
    console.info('comparePerfData: no perf-data files provided; nothing to compare.');
    return;
  }
  const perfs = args.map(loadPerfFile);
  console.info(`P1 perf-data comparison: ${perfs.length} platform(s)`);
  const scenarios = [...new Set(perfs.flatMap(p => p.results.map(r => r.scenario)))];
  for (const scenario of scenarios) {
    for (const metric of ['rust.p50', 'rust.p95', 'rust.startup']) {
      const rows = [];
      for (const perf of perfs) {
        const r = perf.results.find(x => x.scenario === scenario);
        if (!r) continue;
        const rust = r.rust || {};
        let value;
        if (metric === 'rust.p50') value = rust.p50Ms;
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
    console.info(`  nav-500-files  rust.batch ${perf.platform.padEnd(16)} ${Number(perf.nav.rustBatchMs || 0).toFixed(2).padStart(10)} ms`);
  }

  // Anomaly flags.
  let anomalies = 0;
  for (const perf of perfs) {
    const flags = flagAnomalies(perf);
    if (flags.fallbackCount > 0 || flags.regressionsCount > 0) {
      anomalies++;
      console.info(`  [anomaly] ${perf.platform}: fallback=${flags.fallbackCount}, regressions=${flags.regressionsCount}`);
    }
  }
  if (anomalies === 0) {
    console.info('  no fallback / regression anomalies detected.');
  } else {
    console.info(`  ${anomalies} platform(s) with anomalies — review perf guard rails.`);
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

module.exports = { loadPerfFile, flagAnomalies, formatRow, compareWithBaseline, main };
