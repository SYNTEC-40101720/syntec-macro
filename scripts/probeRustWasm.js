// M3 Wasm 边界探针：只验证导出符号和协议版本，不接入生产 Provider。

const fs = require('fs');
const path = require('path');
const {
  analyzeDocument,
  analyzeNavigationDocument
} = require('../src/analysisCore');
const { createRequest } = require('./benchmarkAnalysis');

const DEFAULT_WASM_PATH = path.join(
  __dirname,
  '..',
  'crates',
  'syntec-core',
  'target',
  'wasm32-unknown-unknown',
  'release',
  'syntec_core.wasm'
);

async function main() {
  const wasmPath = process.env.SYNTEC_RUST_WASM || DEFAULT_WASM_PATH;
  if (!fs.existsSync(wasmPath)) {
    throw new Error(`Rust Wasm artifact not found: ${wasmPath}; build it before probing`);
  }
  const bytes = fs.readFileSync(wasmPath);
  const { instance } = await WebAssembly.instantiate(bytes);
  const version = instance.exports.syntec_core_protocol_version;
  const alloc = instance.exports.syntec_core_alloc;
  const dealloc = instance.exports.syntec_core_dealloc;
  const diagnosticCount = instance.exports.syntec_core_diagnostic_count;
  const analyzeJson = instance.exports.syntec_core_analyze_json;
  const freeOutput = instance.exports.syntec_core_free_output;
  const memory = instance.exports.memory;
  if (typeof version !== 'function' ||
      typeof alloc !== 'function' ||
      typeof dealloc !== 'function' ||
      typeof diagnosticCount !== 'function' ||
      typeof analyzeJson !== 'function' ||
      typeof freeOutput !== 'function' ||
      !(memory instanceof WebAssembly.Memory)) {
    throw new Error('Rust Wasm protocol/JSON exports are incomplete');
  }
  const actual = version();
  if (actual !== 1) {
    throw new Error(`Unexpected Rust Wasm protocol version: ${actual}`);
  }
  const encoder = new TextEncoder();
  const validSource = 'IF #1 = 1 THEN\nEND_IF;';
  const invalidSource = 'IF #1 = 1 THEN';
  const validText = encoder.encode(validSource);
  const invalidText = encoder.encode(invalidSource);
  const validPointer = alloc(validText.length);
  new Uint8Array(memory.buffer, validPointer, validText.length).set(validText);
  const invalidPointer = alloc(invalidText.length);
  new Uint8Array(memory.buffer, invalidPointer, invalidText.length).set(invalidText);
  const validCount = diagnosticCount(validPointer, validText.length);
  const invalidCount = diagnosticCount(invalidPointer, invalidText.length);
  dealloc(validPointer, validText.length);
  dealloc(invalidPointer, invalidText.length);
  if (validCount !== 0 || invalidCount !== 1) {
    throw new Error(`Rust Wasm diagnostic count mismatch: valid=${validCount}, invalid=${invalidCount}`);
  }

  const analyzeJsonResult = text => {
    const input = encoder.encode(text);
    const inputPointer = alloc(input.length);
    new Uint8Array(memory.buffer, inputPointer, input.length).set(input);
    const packed = BigInt(analyzeJson(inputPointer, input.length));
    dealloc(inputPointer, input.length);
    const outputPointer = Number(packed >> 32n);
    const outputLength = Number(packed & 0xffffffffn);
    if (outputPointer === 0 || outputLength === 0) {
      throw new Error('Rust Wasm JSON result is empty');
    }
    const output = new Uint8Array(memory.buffer, outputPointer, outputLength).slice();
    freeOutput(outputPointer, outputLength);
    return JSON.parse(new TextDecoder().decode(output));
  };
  const stableDiagnostics = diagnostics => diagnostics.map(diagnostic => ({
    line: diagnostic.line,
    col: diagnostic.col,
    endCol: diagnostic.endCol || diagnostic.col + 1,
    severity: diagnostic.severity,
    code: diagnostic.code
  }));
  const cases = [validSource, invalidSource, 'MSG("IF END_IF"); // IF\nEND_IF;'];
  for (const text of cases) {
    const rustResult = analyzeJsonResult(text);
    const javascriptResult = analyzeDocument(createRequest(text, 'file:///wasm-probe.nc'));
    const rustDiagnostics = stableDiagnostics(rustResult.diagnostics);
    const javascriptDiagnostics = stableDiagnostics(javascriptResult.diagnostics.map(diagnostic => ({
      line: diagnostic.range.start.line + 1,
      col: diagnostic.range.start.character,
      endCol: diagnostic.range.end.character,
      severity: diagnostic.severity,
      code: diagnostic.code
    })));
    if (JSON.stringify(rustDiagnostics) !== JSON.stringify(javascriptDiagnostics)) {
      throw new Error(`Rust Wasm JSON mismatch: ${JSON.stringify(rustResult)}`);
    }
  }
  const navigationText = '%@MACRO\nN10;\nG65 P1000;';
  const rustNavigation = analyzeJsonResult(navigationText);
  const jsNavigation = analyzeNavigationDocument(
    createRequest(navigationText, 'file:///G1000'),
    'G1000'
  ).navigation;
  const rustSymbols = rustNavigation.symbols.map(symbol => ({
    name: symbol.name,
    kind: symbol.kind,
    line: symbol.line,
    startCharacter: symbol.startCharacter,
    endCharacter: symbol.endCharacter
  }));
  const jsSymbols = jsNavigation.symbols.map(symbol => ({
    name: symbol.name,
    kind: symbol.kind,
    line: symbol.line,
    startCharacter: symbol.startCharacter,
    endCharacter: symbol.endCharacter
  }));
  const rustCalls = rustNavigation.navigation.calls;
  if (JSON.stringify(rustSymbols) !== JSON.stringify(jsSymbols) ||
      JSON.stringify(rustCalls) !== JSON.stringify(jsNavigation.calls)) {
    throw new Error(`Rust Wasm navigation mismatch: ${JSON.stringify(rustNavigation)}`);
  }
  console.info(`Rust Wasm JSON ABI probe passed: v${actual}, counts=${validCount}/${invalidCount} (${bytes.length} bytes)`);
}

if (require.main === module) {
  main().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = { main };
