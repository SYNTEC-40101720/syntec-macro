// M3 开发态 Rust Wasm 协议适配器：不注册到生产 Provider。

const {
  ANALYSIS_PROTOCOL_VERSION,
  normalizeAnalysisRequest
} = require('../src/analysisProtocol');

function assertObject(value, name) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${name} must be an object`);
  }
}

function assertArray(value, name) {
  if (!Array.isArray(value)) throw new TypeError(`${name} must be an array`);
}

function assertDiagnosticShape(diagnostic, index) {
  assertObject(diagnostic, `result.diagnostics[${index}]`);
  assertObject(diagnostic.range, `result.diagnostics[${index}].range`);
  assertObject(diagnostic.range.start, `result.diagnostics[${index}].range.start`);
  assertObject(diagnostic.range.end, `result.diagnostics[${index}].range.end`);
  if (typeof diagnostic.message !== 'string' ||
      typeof diagnostic.severity !== 'string' ||
      typeof diagnostic.code !== 'string') {
    throw new TypeError(`result.diagnostics[${index}] has invalid fields`);
  }
}

/**
 * Normalize Rust's core JSON result into the shared AnalysisResult shape.
 *
 * @param {import('../src/analysisProtocol').AnalysisRequest} request
 * @param {Object} rawResult
 * @returns {import('../src/analysisProtocol').AnalysisResult}
 */
function normalizeRustAnalysisResult(request, rawResult) {
  const normalizedRequest = normalizeAnalysisRequest(request);
  assertObject(rawResult, 'result');
  if (rawResult.protocolVersion !== ANALYSIS_PROTOCOL_VERSION) {
    throw new TypeError(`unsupported Rust protocol version: ${rawResult.protocolVersion}`);
  }
  if (rawResult.backend !== 'rust') {
    throw new TypeError(`unexpected Rust backend: ${rawResult.backend}`);
  }
  assertArray(rawResult.diagnostics, 'result.diagnostics');
  assertArray(rawResult.symbols, 'result.symbols');
  assertArray(rawResult.edits, 'result.edits');
  if (rawResult.navigation !== null) assertObject(rawResult.navigation, 'result.navigation');
  rawResult.diagnostics.forEach(assertDiagnosticShape);

  return {
    protocolVersion: ANALYSIS_PROTOCOL_VERSION,
    document: normalizedRequest.document,
    profile: normalizedRequest.profile,
    backend: 'rust-wasm',
    diagnostics: rawResult.diagnostics,
    symbols: rawResult.symbols,
    edits: rawResult.edits,
    navigation: rawResult.navigation
  };
}

function splitPackedPointer(packed) {
  const value = BigInt(packed);
  return {
    pointer: Number(value >> 32n),
    length: Number(value & 0xffffffffn)
  };
}

/**
 * @param {Object} wasmExports
 * @returns {(request: import('../src/analysisProtocol').AnalysisRequest) => import('../src/analysisProtocol').AnalysisResult}
 */
function createRustWasmAdapter(wasmExports) {
  assertObject(wasmExports, 'wasmExports');
  for (const name of [
    'memory',
    'syntec_core_alloc',
    'syntec_core_dealloc',
    'syntec_core_analyze_json',
    'syntec_core_free_output'
  ]) {
    if (!wasmExports[name]) throw new TypeError(`missing Wasm export: ${name}`);
  }

  return request => {
    const text = request.document.text;
    const input = new TextEncoder().encode(text);
    const inputPointer = wasmExports.syntec_core_alloc(input.length);
    new Uint8Array(wasmExports.memory.buffer, inputPointer, input.length).set(input);
    const packed = wasmExports.syntec_core_analyze_json(inputPointer, input.length);
    wasmExports.syntec_core_dealloc(inputPointer, input.length);
    const output = splitPackedPointer(packed);
    if (output.pointer === 0 || output.length === 0) {
      throw new Error('Rust Wasm returned an empty result');
    }
    const bytes = new Uint8Array(
      wasmExports.memory.buffer,
      output.pointer,
      output.length
    ).slice();
    wasmExports.syntec_core_free_output(output.pointer, output.length);
    return normalizeRustAnalysisResult(
      request,
      JSON.parse(new TextDecoder().decode(bytes))
    );
  };
}

module.exports = {
  createRustWasmAdapter,
  normalizeRustAnalysisResult,
  splitPackedPointer
};
