// M3 Wasm 开发态探针：验证 ABI、共享 AnalysisResult 结构和稳定字段差分。

const fs = require('fs');
const path = require('path');
const {
  analyzeDocument,
  analyzeNavigationDocument
} = require('../src/analysisCore');
const { createRequest } = require('./benchmarkAnalysis');
const { createRustWasmAdapter } = require('./rustWasmAdapter');
const { loadRustWasmAsset } = require('../src/rustWasmAsset');

const DEFAULT_MANIFEST_PATH = path.join(
  __dirname,
  '..',
  'assets',
  'rust-wasm',
  'manifest.json'
);

/**
 * 加载 Wasm 实例。优先从 manifest 走生产加载器（P0-C 第 1 项）；
 * 当 `SYNTEC_RUST_WASM` 设置时，直接当作 wasm 文件路径绕过 manifest
 * （开发逃逸端口），用于 `cargo build` 刚生成的 artifact 即测即试。
 *
 * @returns {Promise<{instance: WebAssembly.Instance, bytes: Buffer}>}
 */
async function loadWasm() {
  const override = process.env.SYNTEC_RUST_WASM;
  if (override) {
    if (!fs.existsSync(override)) {
      throw new Error(`Rust Wasm override not found: ${override}`);
    }
    const bytes = fs.readFileSync(override);
    const { instance } = await WebAssembly.instantiate(bytes);
    if (!instance.exports.memory || typeof instance.exports.syntec_core_alloc !== 'function') {
      throw new Error('Rust Wasm override is missing required exports');
    }
    return { instance, bytes };
  }
  const { instance, bytes } = await loadRustWasmAsset(DEFAULT_MANIFEST_PATH);
  return { instance, bytes };
}

async function main() {
  const { instance, bytes } = await loadWasm();
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
    '#TEMP := 1;\n@TEMP := 1;\n#0 := 1;\n@0 := 1;\nAR-1;\nMAR1.5;\nAR[-2];',
    'AR[#1];\nMAR[100];\n#1 := 1;',
    '@401 := 1;\n@440 := 1;\n@10081 := 1;\n@10512 := 1;\n@111000 := 1;\n@450 := 1;\n@10500 := 1;',
    'OPEN(\"COM1\");\nAXID(\"Y\");\nOPEN(\"file.nc\");\nAXID(Y);\nMSG(\"OPEN(\\\\\"COM1\\\\\")\");',
    'SYSDATA(336.5);\nSYSDATA(\"336\");\nDRVDATA(1000.5, 3366);\nDRVDATA(1000, \"bad\");',
    'SYSDATA(336);\nDRVDATA(1000, 3366);\nDRVDATA(1000, \"1Ah\");\nDRVDATA(1000, #1);',
    '#1 = 2;\n@3 = #1;\nAR1 = 3;\nMAR[2] = 4;',
    'IF #1 = 2 THEN\n#1 := 2;\nEND_IF;',
    '中文;\n#1 := 1；\nMSG(\"中文\"); // 中文\n(* 中文 *)\n#2 := 2;',
    'GOTO 200;\nN100;\nGOTO 100;\nG65 P1000 G01;',
    'GOTO 100;\nN100;\nG65 P1000;',
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

  // P0-B 真实 request 传输 ABI: ensure `syntec_core_analyze_request_json`
  // exported and producing same AnalysisResult JSON the adapter would route.
  const requestAbi = instance.exports.syntec_core_analyze_request_json;
  if (typeof requestAbi !== 'function') {
    throw new Error('Rust Wasm artifact is missing syntec_core_analyze_request_json export');
  }
  const requestPayload = JSON.stringify({
    protocolVersion: 1,
    document: {
      uri: 'file:///G1000.nc',
      version: 1,
      languageId: 'syntec-macro',
      text: '%@MACRO\nN1;\n'
    },
    profile: 'generic'
  });
  const requestBytes = new TextEncoder().encode(requestPayload);
  const requestPointer = alloc(requestBytes.length);
  if (requestBytes.length > 0 && requestPointer === 0) {
    throw new Error('Rust Wasm returned a null request buffer');
  }
  let requestResultPointer = 0;
  let requestResultLength = 0;
  try {
    new Uint8Array(memory.buffer, requestPointer, requestBytes.length).set(requestBytes);
    const packed = requestAbi(requestPointer, requestBytes.length);
    const pointer = Number(BigInt(packed) >> 32n);
    const length = Number(BigInt(packed) & 0xffffffffn);
    if (pointer === 0 || length === 0) {
      throw new Error('syntec_core_analyze_request_json returned an empty result');
    }
    requestResultPointer = pointer;
    requestResultLength = length;
    const outputBytes = new Uint8Array(memory.buffer, pointer, length).slice();
    const parsed = JSON.parse(new TextDecoder().decode(outputBytes));
    if (parsed.protocolVersion !== 1 || parsed.backend !== 'rust') {
      throw new Error(`Rust Wasm request ABI returned unexpected result: ${JSON.stringify(parsed)}`);
    }
    if (parsed.document.uri !== 'file:///G1000.nc' || parsed.profile !== 'generic') {
      throw new Error(`Rust Wasm request ABI did not echo document/profile: ${JSON.stringify(parsed)}`);
    }
  } finally {
    if (requestResultPointer !== 0 && requestResultLength !== 0) {
      freeOutput(requestResultPointer, requestResultLength);
    }
    if (requestPointer !== 0 || requestBytes.length !== 0) {
      dealloc(requestPointer, requestBytes.length);
    }
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
