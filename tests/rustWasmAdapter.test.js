// Rust Wasm protocol adapter contract tests.

const assert = require('node:assert');
const { test } = require('node:test');
const {
  createAnalysisRequest,
  createDocumentSnapshot
} = require('../src/analysisProtocol');
const { normalizeRustAnalysisResult } = require('../scripts/rustWasmAdapter');

function createRequest(text = 'IF #1 = 1 THEN', uri = 'file:///adapter.nc') {
  return createAnalysisRequest(createDocumentSnapshot({
    uri,
    version: 3,
    languageId: 'syntec-macro',
    text
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

test('Rust result rejects malformed nested protocol ranges', () => {
  assert.throws(
    () => normalizeRustAnalysisResult(
      createRequest(),
      createRawResult({
        diagnostics: [{
          range: {
            start: { line: 0, character: 4 },
            end: { line: 0, character: 3 }
          },
          message: 'invalid',
          severity: 'warning',
          source: 'syntec-core',
          code: 'SYNTEC_TEST'
        }]
      })
    ),
    /end must not precede start/
  );
  assert.throws(
    () => normalizeRustAnalysisResult(
      createRequest(),
      createRawResult({
        navigation: {
          programEntryName: null,
          macroProgramName: null,
          symbols: [],
          calls: [{
            targetName: 'G1000',
            line: 0,
            start: 3,
            end: 2
          }]
        }
      })
    ),
    /end must not precede start/
  );
});

test('navigation metadata follows the supplied file boundary', () => {
  const rawResult = createRawResult({
    navigation: {
      programEntryName: null,
      macroProgramName: null,
      symbols: [],
      calls: []
    }
  });
  const macroResult = normalizeRustAnalysisResult(
    createRequest('%@MACRO\nN10;', 'file:///G1000'),
    rawResult,
    { navigationFilePath: 'G1000' }
  );
  assert.strictEqual(macroResult.navigation.programEntryName, 'G1000');
  assert.strictEqual(macroResult.navigation.macroProgramName, 'G1000');
  assert.deepStrictEqual(macroResult.symbols, macroResult.navigation.symbols);

  const nonMacroResult = normalizeRustAnalysisResult(
    createRequest('G0 X1;', 'file:///notes.txt'),
    rawResult,
    { navigationFilePath: 'notes.txt' }
  );
  assert.strictEqual(nonMacroResult.navigation, null);
  assert.deepStrictEqual(nonMacroResult.symbols, []);
});
