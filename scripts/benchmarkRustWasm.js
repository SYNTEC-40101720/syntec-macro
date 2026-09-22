// M3 开发态 Wasm JSON bridge 基准：测量实例化、调用延迟和结果大小。

const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');
const {
  calculatePercentile,
  createLargeMacroText,
  createRequest
} = require('./benchmarkAnalysis');
// R1.2 Stage B: ../src/analysisCore 已删除; benchmark 不再做 JS↔Rust parity,
// 改为纯 Rust/Wasm 性能测量. JS↔Rust parity 由 CI 的 `npm run compare:rust`
// 走 `tests/fixtures/rust-parity-baseline.json` 完成.
const { normalizeRustAnalysisResult } = require('./rustWasmAdapter');
const { loadRustWasmAsset } = require('../src/rustWasmAsset');

const DEFAULT_MANIFEST_PATH = path.join(
  __dirname,
  '..',
  'assets',
  'rust-wasm',
  'manifest.json'
);

async function loadWasm(override) {
  if (override) {
    if (!fs.existsSync(override)) {
      throw new Error(`Rust Wasm override not found: ${override}`);
    }
    const bytes = fs.readFileSync(override);
    const { instance } = await WebAssembly.instantiate(bytes);
    const exports = instance.exports;
    for (const name of [
      'memory',
      'syntec_core_alloc',
      'syntec_core_dealloc',
      'syntec_core_analyze_json',
      'syntec_core_free_output'
    ]) {
      if (!exports[name]) throw new Error(`Rust Wasm export is missing: ${name}`);
    }
    return { bytes, exports };
  }
  const { instance, bytes } = await loadRustWasmAsset(DEFAULT_MANIFEST_PATH);
  return { bytes, exports: instance.exports };
}

function callJson(exports, text) {
  const input = new TextEncoder().encode(text);
  const inputPointer = exports.syntec_core_alloc(input.length);
  new Uint8Array(exports.memory.buffer, inputPointer, input.length).set(input);
  const packed = BigInt(exports.syntec_core_analyze_json(inputPointer, input.length));
  exports.syntec_core_dealloc(inputPointer, input.length);

  const outputPointer = Number(packed >> 32n);
  const outputLength = Number(packed & 0xffffffffn);
  if (outputPointer === 0 || outputLength === 0) {
    throw new Error('Rust Wasm returned an empty JSON result');
  }
  const output = new Uint8Array(exports.memory.buffer, outputPointer, outputLength).slice();
  exports.syntec_core_free_output(outputPointer, outputLength);
  return {
    result: JSON.parse(new TextDecoder().decode(output)),
    bytes: outputLength
  };
}

function measure(exports, text, iterations) {
  callJson(exports, text);
  const durations = [];
  let last;
  for (let index = 0; index < iterations; index++) {
    const start = performance.now();
    last = callJson(exports, text);
    durations.push(performance.now() - start);
  }
  return {
    p50Ms: calculatePercentile(durations, 0.5),
    p95Ms: calculatePercentile(durations, 0.95),
    maxMs: Math.max(...durations),
    resultBytes: last.bytes,
    result: last.result
  };
}

function stableRustDiagnostics(rustResult) {
  return rustResult.diagnostics.map(diagnostic => ({
    line: diagnostic.range.start.line + 1,
    col: diagnostic.range.start.character,
    endCol: diagnostic.range.end.character,
    severity: diagnostic.severity,
    code: diagnostic.code
  }));
}

async function main(args = process.argv.slice(2)) {
  const iterationsIndex = args.indexOf('--iterations');
  const iterations = Number(iterationsIndex >= 0 ? args[iterationsIndex + 1] : 10);
  if (!Number.isInteger(iterations) || iterations <= 0) {
    throw new Error('--iterations must be a positive integer');
  }

  const override = process.env.SYNTEC_RUST_WASM;
  const { bytes, exports } = await loadWasm(override);
  const cases = [
    ['fixture', fs.readFileSync(path.join(__dirname, '..', 'tests', 'fixtures', 'test-demo.nc'), 'utf8'), 'file:///fixture.nc'],
    ['large', createLargeMacroText(20000), 'file:///large.nc']
  ];

  console.info(`Rust Wasm JSON benchmark: ${iterations} measured runs, artifact ${bytes.length} bytes`);
  for (const [name, text, uri] of cases) {
    const measured = measure(exports, text, iterations);
    const rustResult = normalizeRustAnalysisResult(
      createRequest(text, uri),
      measured.result
    );
    // R1.2 Stage B: 仅断言 Rust 诊断结构齐备, 不再对照 JS;
    // JS↔Rust parity 由 CI compare:rust 走 fixture baseline 完成.
    stableRustDiagnostics(rustResult);
    console.info(
      `${name}: ${text.split(/\r?\n/).length} lines; ` +
      `p50 ${measured.p50Ms.toFixed(2)} ms, p95 ${measured.p95Ms.toFixed(2)} ms, ` +
      `max ${measured.maxMs.toFixed(2)} ms, JSON ${measured.resultBytes} bytes`
    );
  }
}

if (require.main === module) {
  main().catch(err => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
  });
}

module.exports = {
  callJson,
  loadWasm,
  main,
  measure,
  stableRustDiagnostics
};
