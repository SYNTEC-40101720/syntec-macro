// M3 Wasm 开发态探针：验证 ABI、共享 AnalysisResult 结构和稳定字段差分。

const fs = require('fs');
const path = require('path');
const {
  analyzeDocument,
  analyzeNavigationDocument
} = require('../src/analysisCore');
const { createRequest } = require('./benchmarkAnalysis');
const { createRustWasmAdapter } = require('./rustWasmAdapter');

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
  const analyzeRust = createRustWasmAdapter(instance.exports);
  const analyzeRustNavigation = createRustWasmAdapter(instance.exports, {
    navigationFilePath: 'G1000'
  });
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

  const cases = [validSource, invalidSource, 'MSG("IF END_IF"); // IF\nEND_IF;'];
  const parityCases = [
    ...cases,
    'ELSE',
    'ELSEIF #1 = 1 THEN',
    'ELSIF #1 = 1 THEN',
    '#1 := #2 DIV #3;',
    'IF #1 = 1 THEN;',
    'ELSE;',
    '#1 == #2;',
    '#1 != #2;',
    '#1 && #2;',
    '#1 || #2;',
    '#1 += 1;',
    '#1++;',
    '#1 % #2;',
    '!#1;',
    '#1 EQ #2;',
    '(#1 + 1;',
    '#1 := [1 + 2;',
    ');',
    'MSG(\"(\");',
    '1 MOD 2.5;',
    '1 MOD 2;',
    '#1 := 1',
    'END_IF',
    'IF #1 = 1 THEN',
    '1:',
    'G65 P1000',
    '#1 := ATAN2(0, 0);\n#2 := POW(-1, 2);\n#3 := LN(0);\n#4 := SQRT(-1);\n#5 := ACOS(1.1);\n#6 := ASIN(-1.1);',
    '#1 := ATAN2(#2, #3);\n#4 := SQRT(#5 + 1);\n#6 := ACOS(1);',
    'READDI(512);\nSETDO(1, 2);\nREADRREGBIT(65536, 0);\nREADRREGBIT(1, 32);',
    'READDI(#1);\nSETDO(#1, #2);\nREADRREGBIT(#3, #4);\nSETRREGBIT(1, 2, 1);',
    'ALARM(65536);\nMSG(-1);\nPARAM(1.5, 2);\nCHKINF(6);',
    'ALARM(#1);\nMSG(#2);\nPARAM(#3, #4);\nCHKINF(#5);',
    'IF #1 = 1 THEN\nELSE\nELSEIF #2 = 2 THEN\nEND_IF;',
    'IF #1 = 1 THEN\nWHILE #2 = 1 DO\nEXIT;',
    [
      ...Array(11).fill('IF #1 = 1 THEN'),
      ...Array(11).fill('END_IF;')
    ].join('\n')
  ];
  const stableDiagnostics = result => result.diagnostics.map(diagnostic => ({
    line: diagnostic.range.start.line + 1,
    col: diagnostic.range.start.character,
    endCol: diagnostic.range.end.character,
    severity: diagnostic.severity,
    code: diagnostic.code
  }));
  for (const text of parityCases) {
    const rustResult = analyzeRust(createRequest(text, 'file:///wasm-probe.nc'));
    const javascriptResult = analyzeDocument(createRequest(text, 'file:///wasm-probe.nc'));
    const rustDiagnostics = stableDiagnostics(rustResult);
    const javascriptDiagnostics = stableDiagnostics(javascriptResult);
    if (JSON.stringify(rustDiagnostics) !== JSON.stringify(javascriptDiagnostics)) {
      throw new Error(`Rust Wasm JSON mismatch: ${JSON.stringify(rustResult)}`);
    }
  }
  const navigationText = '%@MACRO\nN10;\nG65 P100;\nG66 P"MyMacro";\nM198 P7;\nM98 P1234;';
  const rustNavigation = analyzeRustNavigation(
    createRequest(navigationText, 'file:///G1000')
  );
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
  if (rustNavigation.navigation.programEntryName !== jsNavigation.programEntryName ||
      rustNavigation.navigation.macroProgramName !== jsNavigation.macroProgramName ||
      JSON.stringify(rustSymbols) !== JSON.stringify(jsSymbols) ||
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
