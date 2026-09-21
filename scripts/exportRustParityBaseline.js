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
const {
  CASES,
  NAVIGATION_CASES,
  FORMAT_CASES,
  getJavaScriptDiagnostics,
  getJavaScriptNavigation,
  getJavaScriptEdit
} = require('./compareRustCore');

const SCHEMA_VERSION = 1;
const DEFAULT_OUTPUT_PATH = path.join(
  __dirname,
  '..',
  'tests',
  'fixtures',
  'rust-parity-baseline.json'
);

/**
 * Build the baseline fixture by running the live JS analyzer over each
 * registered cases. Returns a plain JSON-serializable object.
 */
function buildBaseline() {
  const cases = CASES.map(testCase => ({
    name: testCase.name,
    text: testCase.text,
    expected: getJavaScriptDiagnostics(testCase.text)
  }));
  const navigationCases = NAVIGATION_CASES.map(testCase => ({
    name: testCase.name,
    uri: testCase.uri,
    text: testCase.text,
    expected: getJavaScriptNavigation(testCase.uri, testCase.text)
  }));
  const formatCases = FORMAT_CASES.map(testCase => ({
    name: testCase.name,
    text: testCase.text,
    expected: getJavaScriptEdit(testCase.text)
  }));
  return {
    schemaVersion: SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    generator: 'scripts/exportRustParityBaseline.js',
    note: 'Rust/JS parity baseline captured against v3.1.0 JS analyzer. Used by ' +
      'scripts/compareRustCore.js --baseline <path> after R1.2 JS module removal ' +
      'so compare:rust continues to gate Rust CLI output without needing runtime JS.',
    cases,
    navigationCases,
    formatCases
  };
}

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