// Rust Wasm 协议适配器：可随扩展发布，但不注册为默认生产后端。

const {
  ANALYSIS_PROTOCOL_VERSION,
  normalizeAnalysisRequest
} = require('./analysisProtocol');
// R1.2 Stage B §2.4 (2026-09-22): rustWasmAdapter 不再直 require 即将被 R1.2
// 剔除的 `navigationSymbols.js`, 改走 host-only 元数据 helper 集合
// `pathResolver.js` (§2.3 新建). 当前 pathResolver 暂 re-export 既有实现,
// R1.2 Stage B `git rm navigationSymbols.js` 时在 pathResolver 内 inline.
const {
  getMacroProgramName,
  getProgramEntryName,
  isMacroFileContent
} = require('./pathResolver');

function assertObject(value, name) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${name} must be an object`);
  }
}

function assertArray(value, name) {
  if (!Array.isArray(value)) throw new TypeError(`${name} must be an array`);
}

function assertNonNegativeInteger(value, name) {
  if (!Number.isInteger(value) || value < 0) {
    throw new TypeError(`${name} must be a non-negative integer`);
  }
}

function assertPosition(position, name) {
  assertObject(position, name);
  assertNonNegativeInteger(position.line, `${name}.line`);
  assertNonNegativeInteger(position.character, `${name}.character`);
}

function assertRange(range, name) {
  assertObject(range, name);
  assertPosition(range.start, `${name}.start`);
  assertPosition(range.end, `${name}.end`);
  if (range.end.line < range.start.line ||
      (range.end.line === range.start.line &&
       range.end.character < range.start.character)) {
    throw new TypeError(`${name} end must not precede start`);
  }
}

function assertDiagnosticShape(diagnostic, index) {
  assertObject(diagnostic, `result.diagnostics[${index}]`);
  const name = `result.diagnostics[${index}]`;
  assertRange(diagnostic.range, `${name}.range`);
  if (typeof diagnostic.message !== 'string' || diagnostic.message.length === 0 ||
      !['error', 'warning', 'info', 'hint'].includes(diagnostic.severity) ||
      typeof diagnostic.source !== 'string' || diagnostic.source.length === 0 ||
      (diagnostic.code !== undefined &&
       (typeof diagnostic.code !== 'string' || diagnostic.code.length === 0)) ||
      (diagnostic.keyword !== undefined &&
       (typeof diagnostic.keyword !== 'string' || diagnostic.keyword.length === 0))) {
    throw new TypeError(`result.diagnostics[${index}] has invalid fields`);
  }
}

function assertSymbolShape(symbol, index, name = 'result.symbols') {
  assertObject(symbol, `${name}[${index}]`);
  if (typeof symbol.name !== 'string' || symbol.name.length === 0 ||
      typeof symbol.kind !== 'string' || symbol.kind.length === 0) {
    throw new TypeError(`${name}[${index}] has invalid name or kind`);
  }
  assertNonNegativeInteger(symbol.line, `${name}[${index}].line`);
  if (symbol.startCharacter !== undefined) {
    assertNonNegativeInteger(symbol.startCharacter, `${name}[${index}].startCharacter`);
  }
  if (symbol.endCharacter !== undefined) {
    assertNonNegativeInteger(symbol.endCharacter, `${name}[${index}].endCharacter`);
  }
  if (symbol.startCharacter !== undefined && symbol.endCharacter !== undefined &&
      symbol.endCharacter < symbol.startCharacter) {
    throw new TypeError(`${name}[${index}] endCharacter must not precede startCharacter`);
  }
}

function assertEditShape(edit, index) {
  assertObject(edit, `result.edits[${index}]`);
  assertRange(edit.range, `result.edits[${index}].range`);
  if (typeof edit.newText !== 'string') {
    throw new TypeError(`result.edits[${index}].newText must be a string`);
  }
}

function assertNavigationShape(navigation) {
  assertObject(navigation, 'result.navigation');
  if ((navigation.programEntryName !== null &&
       typeof navigation.programEntryName !== 'string') ||
      (navigation.macroProgramName !== null &&
       typeof navigation.macroProgramName !== 'string')) {
    throw new TypeError('result.navigation names must be strings or null');
  }
  assertArray(navigation.symbols, 'result.navigation.symbols');
  navigation.symbols.forEach((symbol, index) => {
    assertSymbolShape(symbol, index, 'result.navigation.symbols');
  });
  assertArray(navigation.calls, 'result.navigation.calls');
  navigation.calls.forEach((call, index) => {
    assertObject(call, `result.navigation.calls[${index}]`);
    if (typeof call.targetName !== 'string' || call.targetName.length === 0) {
      throw new TypeError(`result.navigation.calls[${index}].targetName must be a non-empty string`);
    }
    assertNonNegativeInteger(call.line, `result.navigation.calls[${index}].line`);
    assertNonNegativeInteger(call.start, `result.navigation.calls[${index}].start`);
    assertNonNegativeInteger(call.end, `result.navigation.calls[${index}].end`);
    if (call.end < call.start) {
      throw new TypeError(`result.navigation.calls[${index}] end must not precede start`);
    }
  });
}

function applyNavigationFileMetadata(result, request, filePath) {
  if (filePath === undefined) return result;
  if (typeof filePath !== 'string' || filePath.length === 0) {
    throw new TypeError('navigationFilePath must be a non-empty string');
  }
  if (result.navigation === null) return result;

  const text = request.document.text;
  if (!isMacroFileContent(filePath, text)) {
    result.navigation = null;
    result.symbols = [];
    return result;
  }

  result.navigation.programEntryName = getProgramEntryName(filePath);
  result.navigation.macroProgramName = getMacroProgramName(filePath, text);
  result.symbols = result.navigation.symbols;
  return result;
}

/**
 * Normalize Rust's core JSON result into the shared AnalysisResult shape.
 *
 * @param {import('../src/analysisProtocol').AnalysisRequest} request
 * @param {Object} rawResult
 * @param {{navigationFilePath?: string}} [options]
 * @returns {import('../src/analysisProtocol').AnalysisResult}
 */
function normalizeRustAnalysisResult(request, rawResult, options = {}) {
  const normalizedRequest = normalizeAnalysisRequest(request);
  assertObject(options, 'options');
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
  rawResult.diagnostics.forEach(assertDiagnosticShape);
  rawResult.symbols.forEach((symbol, index) => assertSymbolShape(symbol, index));
  rawResult.edits.forEach(assertEditShape);
  if (rawResult.navigation !== null) assertNavigationShape(rawResult.navigation);

  const result = {
    protocolVersion: ANALYSIS_PROTOCOL_VERSION,
    document: normalizedRequest.document,
    profile: normalizedRequest.profile,
    backend: 'rust-wasm',
    diagnostics: rawResult.diagnostics,
    symbols: rawResult.symbols,
    edits: rawResult.edits,
    navigation: rawResult.navigation
  };
  return applyNavigationFileMetadata(result, normalizedRequest, options.navigationFilePath);
}

function splitPackedPointer(packed) {
  const value = BigInt(packed);
  return {
    pointer: Number(value >> 32n),
    length: Number(value & 0xffffffffn)
  };
}

/**
 * P0-B 真实 request 传输: serialize the full `AnalysisRequest` JSON and let
 * Rust validate protocolVersion / document.uri / version / languageId / text /
 * profile. The Wasm ABI `syntec_core_analyze_request_json` returns 0 when the
 * request is malformed; the contract is that the caller must take the explicit
 * `onFallback` path in that case, never silently post-fill document/profile.
 *
 * When `syntec_core_analyze_request_json` is exported by the Wasm instance,
 * this adapter uses it and passes the entire `AnalysisRequest`. When it is
 * missing (older Wasm artifact compiled before P0-B), the adapter falls back
 * to the legacy text-only `syntec_core_analyze_json` ABI so development probes
 * keep working; the fallback path is still recorded via the returned result's
 * `backend = 'rust-wasm'` marker and `options.navigationFilePath` filter.
 *
 * @param {Object} wasmExports
 * @param {{navigationFilePath?: string}} [options]
 * @returns {(request: import('../src/analysisProtocol').AnalysisRequest) => import('../src/analysisProtocol').AnalysisResult}
 */
function createRustWasmAdapter(wasmExports, options = {}) {
  assertObject(wasmExports, 'wasmExports');
  assertObject(options, 'options');
  for (const name of [
    'memory',
    'syntec_core_alloc',
    'syntec_core_dealloc',
    'syntec_core_free_output'
  ]) {
    if (!wasmExports[name]) throw new TypeError(`missing Wasm export: ${name}`);
  }
  const requestAbi = wasmExports.syntec_core_analyze_request_json;
  const navigationAbi = wasmExports.syntec_core_analyze_navigation_json;
  const legacyAbi = wasmExports.syntec_core_analyze_json;

  return request => {
    const normalizedRequest = normalizeAnalysisRequest(request);
    let outputPointer = 0;
    let outputLength = 0;
    let inputPointer = 0;
    let inputLength = 0;
    try {
      // Navigation-only batch path: when options.navigationFilePath is set
      // (mirroring `analyzeNavigationDocument` / `buildNavigationIndexEntry`
      // in JS) and the Wasm artifact exposes the lightweight
      // `syntec_core_analyze_navigation_json` export, route the request through
      // the navigation-only analyzer so we skip diagnostics+formatter and
      // benchmark the same workload as the JS navigation indexer.
      const useNavigation = typeof navigationAbi === 'function' && options.navigationFilePath !== undefined;
      const abi = useNavigation ? navigationAbi : requestAbi;
      if (typeof abi === 'function') {
        // P0-B preferred path: send the entire AnalysisRequest JSON.
        const requestJson = JSON.stringify({
          protocolVersion: normalizedRequest.protocolVersion,
          document: normalizedRequest.document,
          profile: normalizedRequest.profile
        });
        const input = new TextEncoder().encode(requestJson);
        inputLength = input.length;
        if (input.length > 0) {
          inputPointer = wasmExports.syntec_core_alloc(input.length);
          if (inputPointer === 0) {
            throw new Error('Rust Wasm returned a null request input buffer');
          }
          new Uint8Array(wasmExports.memory.buffer, inputPointer, input.length).set(input);
        }
        const packed = abi(inputPointer, input.length);
        const output = splitPackedPointer(packed);
        outputPointer = output.pointer;
        outputLength = output.length;
        if (outputPointer === 0 || outputLength === 0) {
          throw new Error(useNavigation
            ? 'Rust Wasm rejected the navigation request'
            : 'Rust Wasm rejected the analysis request');
        }
      } else if (!useNavigation && typeof legacyAbi === 'function') {
        // Legacy fallback for older Wasm artifacts that only expose the
        // text-only ABI. The adapter still post-fills document/profile, which
        // is exactly the gap P0-B intends to close; this branch exists only so
        // development probes keep working until the new Wasm artifact rebuilds.
        const text = normalizedRequest.document.text;
        const input = new TextEncoder().encode(text);
        inputLength = input.length;
        if (input.length > 0) {
          inputPointer = wasmExports.syntec_core_alloc(input.length);
          if (inputPointer === 0) {
            throw new Error('Rust Wasm returned a null input buffer');
          }
          new Uint8Array(wasmExports.memory.buffer, inputPointer, input.length).set(input);
        }
        const packed = legacyAbi(inputPointer, input.length);
        const output = splitPackedPointer(packed);
        outputPointer = output.pointer;
        outputLength = output.length;
        if (outputPointer === 0 || outputLength === 0) {
          throw new Error('Rust Wasm returned an empty result');
        }
      } else if (!useNavigation) {
        throw new TypeError('missing Wasm export: syntec_core_analyze_request_json or syntec_core_analyze_json');
      } else {
        throw new TypeError('missing Wasm export: syntec_core_analyze_navigation_json');
      }
      const bytes = new Uint8Array(
        wasmExports.memory.buffer,
        outputPointer,
        outputLength
      ).slice();
      return normalizeRustAnalysisResult(
        normalizedRequest,
        JSON.parse(new TextDecoder().decode(bytes)),
        options
      );
    } finally {
      if (outputPointer !== 0 && outputLength !== 0) {
        wasmExports.syntec_core_free_output(outputPointer, outputLength);
      }
      if (inputPointer !== 0 || inputLength !== 0) {
        wasmExports.syntec_core_dealloc(inputPointer, inputLength);
      }
    }
  };
}

module.exports = {
  applyNavigationFileMetadata,
  createRustWasmAdapter,
  normalizeRustAnalysisResult,
  splitPackedPointer
};
