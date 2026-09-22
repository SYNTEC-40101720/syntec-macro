// @ts-check
// 纯分析核心基准：测量后端在真实 fixture 与大档案上的延迟。
//
// R1.2 Stage B (2026-09-22): JS analyzeDocument 路径已退役 (analysisCore.js git rm).
// `analyzeDocument` 仅在 `--js` flag 触发的 JS baseline 路径下 lazy require;
// 该 lazy require 会抛 MODULE_NOT_FOUND (R1.2 后无 JS 实体), 由 caller 捕获并提示.

const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');
const {
  createAnalysisRequest,
  createDocumentSnapshot
} = require('../src/analysisProtocol');

function loadJavaScriptAnalyzer() {
  // R1.2 Stage B: src/analysisCore.js 已 git rm; lazy require 抛 MODULE_NOT_FOUND.
  // @ts-ignore — R1.2 后 analysisCore.js 已删除, 故意保留 require 作 historic reference.
  const { analyzeDocument } = require('../src/analysisCore');
  return { analyzeDocument };
}

const DEFAULT_ITERATIONS = 10;
const DEFAULT_LARGE_LINE_COUNT = 20000;
const FIXTURE_PATH = path.join(__dirname, '..', 'tests', 'fixtures', 'test-demo.nc');

/**
 * @typedef {Object} BenchmarkOptions
 * @property {number} lineCount
 * @property {number} iterations
 * @property {boolean} json
 */

/**
 * @typedef {Object} BenchmarkResult
 * @property {number} lineCount
 * @property {number} iterations
 * @property {string} backend
 * @property {number} diagnosticCount
 * @property {number} p50Ms
 * @property {number} p95Ms
 * @property {number} maxMs
 */

/**
 * @param {unknown} value
 * @param {string} name
 * @param {number} fallback
 * @returns {number}
 */
function parsePositiveInteger(value, name, fallback) {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return parsed;
}

/**
 * @param {number} [lineCount]
 * @returns {string}
 */
function createLargeMacroText(lineCount = DEFAULT_LARGE_LINE_COUNT) {
  if (!Number.isInteger(lineCount) || lineCount < 4) {
    throw new Error('lineCount must be an integer greater than or equal to 4');
  }

  const lines = ['%@MACRO'];
  for (let lineIndex = 1; lineIndex < lineCount; lineIndex++) {
    const blockOffset = lineIndex % 97;
    if (lineIndex >= 97 && blockOffset === 0) {
      lines.push('IF #1 = 1 THEN');
    } else if (lineIndex >= 97 && blockOffset === 1) {
      lines.push('#2 := SQRT(4);');
    } else if (lineIndex >= 97 && blockOffset === 2) {
      lines.push('END_IF;');
    } else if (lineIndex % 31 === 0) {
      lines.push(`G65 P${1000 + (lineIndex % 20)} A${lineIndex};`);
    } else if (lineIndex % 17 === 0) {
      lines.push('MSG("中文 // 保留字符串");');
    } else {
      lines.push(`#1 := #1 + ${lineIndex % 100};`);
    }
  }
  return lines.join('\n');
}

/**
 * @param {string} text
 * @param {string} uri
 * @returns {import('../src/analysisProtocol').AnalysisRequest}
 */
function createRequest(text, uri) {
  return createAnalysisRequest(createDocumentSnapshot({
    uri,
    version: 1,
    languageId: 'syntec-macro',
    text
  }));
}

/**
 * @param {number[]} values
 * @param {number} percentile
 * @returns {number}
 */
function calculatePercentile(values, percentile) {
  if (!Array.isArray(values) || values.length === 0) {
    throw new Error('values must contain at least one measurement');
  }
  if (percentile <= 0 || percentile > 1) {
    throw new Error('percentile must be greater than 0 and less than or equal to 1');
  }
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.ceil(percentile * sorted.length) - 1);
  return sorted[index];
}

/**
 * @param {import('../src/analysisProtocol').AnalysisRequest} request
 * @param {number} [iterations]
 * @returns {BenchmarkResult}
 */
function measureAnalysis(request, iterations = DEFAULT_ITERATIONS) {
  if (!Number.isInteger(iterations) || iterations <= 0) {
    throw new Error('iterations must be a positive integer');
  }

  // R1.2 Stage B: analyzeDocument lazy-loaded (will throw MODULE_NOT_FOUND after §2.12 git rm).
  const { analyzeDocument } = loadJavaScriptAnalyzer();
  // Warm up module caches and the V8 hot path before recording measurements.
  let lastResult = analyzeDocument(request);
  const durations = [];
  for (let index = 0; index < iterations; index++) {
    const start = performance.now();
    lastResult = analyzeDocument(request);
    durations.push(performance.now() - start);
  }

  return {
    lineCount: request.document.text.split(/\r?\n/).length,
    iterations,
    backend: lastResult.backend,
    diagnosticCount: lastResult.diagnostics.length,
    p50Ms: calculatePercentile(durations, 0.5),
    p95Ms: calculatePercentile(durations, 0.95),
    maxMs: Math.max(...durations)
  };
}

/**
 * @param {string[]} args
 * @returns {BenchmarkOptions}
 */
function parseOptions(args) {
  const linesIndex = args.indexOf('--lines');
  const iterationsIndex = args.indexOf('--iterations');
  return {
    lineCount: parsePositiveInteger(
      linesIndex >= 0 ? args[linesIndex + 1] : undefined,
      '--lines',
      DEFAULT_LARGE_LINE_COUNT
    ),
    iterations: parsePositiveInteger(
      iterationsIndex >= 0 ? args[iterationsIndex + 1] : undefined,
      '--iterations',
      DEFAULT_ITERATIONS
    ),
    json: args.includes('--json')
  };
}

/**
 * @param {BenchmarkOptions} options
 * @returns {{fixture: BenchmarkResult, large: BenchmarkResult}}
 */
function runBenchmarks(options) {
  const fixtureText = fs.readFileSync(FIXTURE_PATH, 'utf8');
  return {
    fixture: measureAnalysis(
      createRequest(fixtureText, 'file:///tests/fixtures/test-demo.nc'),
      options.iterations
    ),
    large: measureAnalysis(
      createRequest(
        createLargeMacroText(options.lineCount),
        'file:///benchmark/large-macro.nc'
      ),
      options.iterations
    )
  };
}

/**
 * @param {string[]} [args]
 * @returns {void}
 */
function main(args = process.argv.slice(2)) {
  const options = parseOptions(args);
  const results = runBenchmarks(options);
  if (options.json) {
    console.info(JSON.stringify(results));
    return;
  }

  console.info(`Analysis benchmark: ${options.iterations} measured runs`);
  for (const [name, result] of Object.entries(results)) {
    console.info(
      `${name}: ${result.lineCount} lines, ${result.diagnosticCount} diagnostics, ` +
      `p50 ${result.p50Ms.toFixed(2)} ms, p95 ${result.p95Ms.toFixed(2)} ms, ` +
      `max ${result.maxMs.toFixed(2)} ms`
    );
  }
}

if (require.main === module) main();

module.exports = {
  calculatePercentile,
  createLargeMacroText,
  createRequest,
  measureAnalysis,
  parseOptions,
  runBenchmarks
};
