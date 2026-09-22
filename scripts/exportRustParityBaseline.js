/**
 * Export Rust/JS parity baseline fixture as JSON.
 *
 * This generates `tests/fixtures/rust-parity-baseline.json` containing the JS
 * analyzer's expected output for all CASES (130 diagnostics) + NAVIGATION_CASES
 * (10 navigation) + FORMAT_CASES (17 formatter) defined in
 * `scripts/compareRustCore.js`. The fixture is the R1.2 lineage's stable
 * baseline: once JS analyzer modules are removed (R1.2 Stage B),
 * `compareRustCore.js --baseline <path>` compares Rust CLI output against
 * this fixture instead of running the (deleted) JS analyzer at runtime.
 *
 * Generated 2026-09-21 against v3.1.0 JS analyzer. Schema version 1.
 *
 * Usage:
 *   node scripts/exportRustParityBaseline.js [outputPath]
 *
 * Defaults to `tests/fixtures/rust-parity-baseline.json`.
 */

const fs = require('fs');
const path = require('path');

// R1.2 Stage B: JS analyzer 已退役, 不再 require compareRustCore 的 getJavaScript*
// (它们调用时会抛). buildBaseline() 改为读取 commit 的 fixture 文件.

const SCHEMA_VERSION = 1;
const DEFAULT_OUTPUT_PATH = path.join(
  __dirname,
  '..',
  'tests',
  'fixtures',
  'rust-parity-baseline.json'
);

/**
 * Build the baseline fixture. R1.2 Stage B (2026-09-22): JS analyzer 已退役,
 * `getJavaScript*` 现在会抛错 (analysisCore.js 已 git rm). 本函数改为读取已 commit
 * 的 fixture 文件 (`tests/fixtures/rust-parity-baseline.json`, 由 v3.1.0 JS
 * analyzer 生成于 2026-09-21) 返回相同 shape, 供契约测试守卫 schema/字段稳定.
 *
 * 注意: R1.2 后如需重新生成 baseline, 应改为通过 Rust CLI 生成 (TODO: 后续 PR).
 */
function buildBaseline() {
  const fixtureRaw = fs.readFileSync(DEFAULT_OUTPUT_PATH, 'utf8');
  const parsed = JSON.parse(fixtureRaw);
  return {
    schemaVersion: parsed.schemaVersion,
    generatedAt: parsed.generatedAt,
    generator: parsed.generator,
    note: parsed.note,
    cases: parsed.cases,
    navigationCases: parsed.navigationCases,
    formatCases: parsed.formatCases
  };
}

// R1.2 Stage B: buildBaselineFromLiveJs (运行实时 JS 生成 baseline) 已退役 —
// JS analyzer (src/analysisCore.js) 已 git rm. 旧 buildBaseline() 已改为从
// commit 的 fixture 文件读取. 后续如需重新生成 baseline 应改为通过 Rust CLI 生成.

function main(argv = process.argv.slice(2)) {
  const outputPath = argv[0] ? path.resolve(argv[0]) : DEFAULT_OUTPUT_PATH;
  const baseline = buildBaseline();
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(baseline, null, 2) + '\n', 'utf8');
  const summary = {
    cases: baseline.cases.length,
    navigationCases: baseline.navigationCases.length,
    formatCases: baseline.formatCases.length,
    schemaVersion: baseline.schemaVersion,
    generatedAt: baseline.generatedAt
  };
  console.info(`Rust/JS parity baseline written: ${outputPath}`);
  console.info(JSON.stringify(summary, null, 2));
}

if (require.main === module) main();

module.exports = {
  buildBaseline,
  DEFAULT_OUTPUT_PATH,
  SCHEMA_VERSION
};