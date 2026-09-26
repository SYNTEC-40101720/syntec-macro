// Rust Wasm protocol adapter contract tests.

const assert = require('node:assert');
const { test } = require('node:test');
const {
  createAnalysisRequest,
  createDocumentSnapshot
} = require('../src/analysisProtocol');
const {
  createRustWasmAdapter,
  normalizeRustAnalysisResult
} = require('../scripts/rustWasmAdapter');

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

test('Rust diagnostics may omit the optional code field', () => {
  const rawResult = createRawResult();
  delete rawResult.diagnostics[0].code;
  const result = normalizeRustAnalysisResult(createRequest(), rawResult);
  assert.strictEqual(result.diagnostics[0].code, undefined);
});

/**
 * Minimal fake Wasm module. Records the bytes written into its memory and
 * returns a packed JSON output produced by `encodeOutput`. Supports the
 * P0-B request ABI (`syntec_core_analyze_request_json`).
 */
function createFakeWasm({ requestAbi, output, requestSink = null }) {
  const memory = new WebAssembly.Memory({ initial: 1 });
  const view = () => new Uint8Array(memory.buffer);
  return {
    memory,
    syntec_core_alloc(size) {
      const pointer = 16;
      if (16 + size > view().length) {
        memory.grow(Math.ceil((16 + size - view().length) / 65536));
      }
      return pointer;
    },
    syntec_core_dealloc() {},
    syntec_core_analyze_request_json: requestAbi
      ? (pointer, length) => {
        const bytes = view().subarray(pointer, pointer + length);
        if (requestSink) requestSink.push(Buffer.from(bytes).toString('utf8'));
        if (output === null) return 0n;
        const encoded = new TextEncoder().encode(output);
        const outPointer = 1024;
        if (outPointer + encoded.length > view().length) {
          memory.grow(Math.ceil((outPointer + encoded.length - view().length) / 65536));
        }
        view().set(encoded, outPointer);
        return (BigInt(outPointer) << 32n) | BigInt(encoded.length);
      }
      : undefined,
    syntec_core_free_output() {}
  };
}

function rawResultJson() {
  return JSON.stringify({
    protocolVersion: 1,
    backend: 'rust',
    diagnostics: [],
    symbols: [],
    edits: [],
    navigation: null
  });
}

test('createRustWasmAdapter prefers the P0-B request ABI and forwards the full AnalysisRequest', () => {
  const receivedRequest = [];
  const wasm = createFakeWasm({
    requestAbi: true,
    output: rawResultJson(),
    requestSink: receivedRequest
  });
  const adapter = createRustWasmAdapter(wasm);
  const request = createRequest('N10;\n', 'file:///G1000');
  const result = adapter(request);
  assert.strictEqual(result.backend, 'rust-wasm');
  assert.strictEqual(receivedRequest.length, 1);
  const forwarded = JSON.parse(receivedRequest[0]);
  assert.strictEqual(forwarded.protocolVersion, 1);
  assert.strictEqual(forwarded.document.uri, 'file:///G1000');
  assert.strictEqual(forwarded.document.text, 'N10;\n');
  assert.strictEqual(forwarded.profile, 'generic');
});

test('createRustWasmAdapter surfaces a fallback-worthy error when the request ABI rejects the payload', () => {
  const wasm = createFakeWasm({
    requestAbi: true,
    output: null,
    requestSink: []
  });
  const adapter = createRustWasmAdapter(wasm);
  assert.throws(() => adapter(createRequest('N10;', 'file:///bad')), /rejected the analysis request/);
});

test('createRustWasmAdapter requires the request ABI export', () => {
  const wasm = createFakeWasm({ requestAbi: false, output: null, requestSink: [] });
  const adapter = createRustWasmAdapter(wasm);
  assert.throws(
    () => adapter(createRequest('N10;', 'file:///G1000')),
    /missing Wasm export: syntec_core_analyze_request_json/
  );
});
