// Rust Wasm protocol adapter contract tests.

const assert = require('node:assert');
const { test } = require('node:test');
const {
  createAnalysisRequest,
  createDocumentSnapshot
} = require('../src/analysisProtocol');
const { normalizeRustAnalysisResult } = require('../scripts/rustWasmAdapter');

function createRequest() {
  return createAnalysisRequest(createDocumentSnapshot({
    uri: 'file:///adapter.nc',
    version: 3,
    languageId: 'syntec-macro',
    text: 'IF #1 = 1 THEN'
  }), { profile: 'generic' });
}

function createRawResult(overrides = {}) {
  return {
    protocolVersion: 1,
    backend: 'rust',
    diagnostics: [{
      range: {
        start: { line: 0, character: 0 },
        end: { line: 0, character: 2 }
      },
      message: 'IF 块缺少闭合语句',
      severity: 'warning',
      source: 'syntec-core',
      code: 'SYNTEC_CONTROL_UNCLOSED_BLOCK'
    }],
    symbols: [],
    edits: [],
    navigation: null,
    ...overrides
  };
}

test('Rust result normalizes into the shared AnalysisResult shape', () => {
  const result = normalizeRustAnalysisResult(createRequest(), createRawResult());
  assert.strictEqual(result.protocolVersion, 1);
  assert.strictEqual(result.backend, 'rust-wasm');
  assert.strictEqual(result.document.uri, 'file:///adapter.nc');
  assert.strictEqual(result.profile, 'generic');
  assert.strictEqual(result.diagnostics.length, 1);
  assert.deepStrictEqual(result.symbols, []);
  assert.deepStrictEqual(result.edits, []);
  assert.strictEqual(result.navigation, null);
});

test('Rust result rejects protocol and shape drift', () => {
  assert.throws(
    () => normalizeRustAnalysisResult(
      createRequest(),
      createRawResult({ protocolVersion: 2 })
    ),
    /unsupported Rust protocol version/
  );
  assert.throws(
    () => normalizeRustAnalysisResult(
      createRequest(),
      createRawResult({ symbols: null })
    ),
    /result\.symbols must be an array/
  );
});
