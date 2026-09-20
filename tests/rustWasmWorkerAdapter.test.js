// RustWasmWorkerAdapter (P0-C 第 2 项) 契约测试。
//
// 用模块暴露的 `loadAsset` 与 `createAdapter` 注入点构造 fake 资产加载
// 与适配器，验证 shadow 与 primary 两种模式下的契约：
// - shadow：始终返回 JS 结果；Rust 抛错或差分时调用 onShadowMismatch；
// - primary：返回 Rust 结果，资产加载失败时抛错（上层回退 JS）。
//
// 不依赖真实 wasm 资产。

const assert = require('node:assert');
const { test } = require('node:test');
const { RustWasmAssetError } = require('../src/rustWasmAsset');

const sampleRequest = {
  protocolVersion: 1,
  document: {
    uri: 'file:///G1000',
    version: 1,
    languageId: 'syntec-macro',
    text: 'IF #1 = 1 THEN\nEND_IF;'
  },
  profile: 'generic'
};

function makeResult(backend, diagnostics = []) {
  return {
    protocolVersion: 1,
    document: sampleRequest.document,
    profile: sampleRequest.profile,
    backend,
    diagnostics,
    symbols: [],
    edits: [],
    navigation: null
  };
}

function makeDiagnostic(line, character, code = 'SYNTEC_TEST') {
  return {
    range: {
      start: { line, character },
      end: { line, character: character + 1 }
    },
    message: 'test diagnostic',
    severity: 'warning',
    source: 'syntec-core',
    code
  };
}

test('shadow 模式返回 JS 结果，结果一致不触发 onShadowMismatch', async () => {
  let mismatchCount = 0;
  const { createRustWasmWorkerAdapter } = require('../src/rustWasmWorkerAdapter');
  const adapter = await createRustWasmWorkerAdapter({
    manifestPath: '/nonexistent/manifest.json',
    loadAsset: async () => ({ instance: { exports: {} } }),
    createAdapter: () => () => makeResult('rust-wasm', [makeDiagnostic(0, 0)]),
    javascriptAnalyzer: () => makeResult('javascript', [makeDiagnostic(0, 0)]),
    shadow: { mode: 'shadow', log: () => {} },
    onShadowMismatch: () => { mismatchCount++; }
  });
  const result = await adapter(sampleRequest);
  assert.strictEqual(result.backend, 'javascript');
  assert.strictEqual(mismatchCount, 0);
});

test('shadow 模式差分触发 onShadowMismatch 但仍返回 JS 结果', async () => {
  let mismatchCount = 0;
  const { createRustWasmWorkerAdapter } = require('../src/rustWasmWorkerAdapter');
  const adapter = await createRustWasmWorkerAdapter({
    manifestPath: '/nonexistent/manifest.json',
    loadAsset: async () => ({ instance: { exports: {} } }),
    createAdapter: () => () => makeResult('rust-wasm', [makeDiagnostic(0, 0)]),
    javascriptAnalyzer: () => makeResult('javascript', []),
    shadow: { mode: 'shadow', log: () => {} },
    onShadowMismatch: () => { mismatchCount++; }
  });
  const result = await adapter(sampleRequest);
  assert.strictEqual(result.backend, 'javascript');
  assert.strictEqual(mismatchCount, 1);
});

test('shadow 模式 Rust 运行时抛错时显式 fallback 但仍返回 JS', async () => {
  let fallbackCount = 0;
  let mismatchCount = 0;
  const { createRustWasmWorkerAdapter } = require('../src/rustWasmWorkerAdapter');
  const adapter = await createRustWasmWorkerAdapter({
    manifestPath: '/nonexistent/manifest.json',
    loadAsset: async () => ({ instance: { exports: {} } }),
    createAdapter: () => () => { throw new Error('rust run failure'); },
    javascriptAnalyzer: () => makeResult('javascript', [makeDiagnostic(0, 0)]),
    shadow: { mode: 'shadow', log: () => {} },
    onFallback: () => { fallbackCount++; },
    onShadowMismatch: () => { mismatchCount++; }
  });
  const result = await adapter(sampleRequest);
  assert.strictEqual(result.backend, 'javascript');
  // 运行时错误时只走 onFallback；rustResult 为空，不进入 resultsEqualShallow 比较，因而不触发 onShadowMismatch
  assert.strictEqual(fallbackCount, 1);
  assert.strictEqual(mismatchCount, 0);
});

test('shadow 模式资产加载失败时优雅回退到 JS，不抛错', async () => {
  let fallbackCount = 0;
  const { createRustWasmWorkerAdapter } = require('../src/rustWasmWorkerAdapter');
  const adapter = await createRustWasmWorkerAdapter({
    manifestPath: '/nonexistent/manifest.json',
    loadAsset: async () => { throw new Error('asset missing'); },
    javascriptAnalyzer: () => makeResult('javascript', [makeDiagnostic(0, 0)]),
    shadow: { mode: 'shadow', log: () => {} },
    onFallback: () => { fallbackCount++; }
  });
  const result = await adapter(sampleRequest);
  assert.strictEqual(result.backend, 'javascript');
  assert.strictEqual(fallbackCount, 1);
});

test('shadow 模式资产加载失败为 RustWasmAssetError 时 reason 透传', async () => {
  let lastReason = null;
  const { createRustWasmWorkerAdapter } = require('../src/rustWasmWorkerAdapter');
  const adapter = await createRustWasmWorkerAdapter({
    manifestPath: '/nonexistent/manifest.json',
    loadAsset: async () => {
      throw new RustWasmAssetError('manifest-missing', 'fake missing');
    },
    javascriptAnalyzer: () => makeResult('javascript', [makeDiagnostic(0, 0)]),
    shadow: { mode: 'shadow', log: () => {} },
    onFallback: (reason) => { lastReason = reason; }
  });
  const result = await adapter(sampleRequest);
  assert.strictEqual(result.backend, 'javascript');
  assert.strictEqual(lastReason, 'manifest-missing');
});

test('primary 模式资产加载失败抛错供上层回退', async () => {
  const { createRustWasmWorkerAdapter } = require('../src/rustWasmWorkerAdapter');
  await assert.rejects(
    createRustWasmWorkerAdapter({
      manifestPath: '/nonexistent/manifest.json',
      loadAsset: async () => { throw new Error('asset missing'); }
    }),
    /asset missing/
  );
});

test('primary 模式返回 Rust 结果', async () => {
  const { createRustWasmWorkerAdapter } = require('../src/rustWasmWorkerAdapter');
  const adapter = await createRustWasmWorkerAdapter({
    manifestPath: '/nonexistent/manifest.json',
    loadAsset: async () => ({ instance: { exports: {} } }),
    createAdapter: () => () => makeResult('rust-wasm', [makeDiagnostic(0, 0)])
  });
  const result = await adapter(sampleRequest);
  assert.strictEqual(result.backend, 'rust-wasm');
  assert.strictEqual(result.diagnostics.length, 1);
});

test('resultsEqualShallow 检测字段差异', () => {
  const { resultsEqualShallow } = require('../src/rustWasmWorkerAdapter');
  const a = makeResult('javascript', [makeDiagnostic(0, 0)]);
  const b = makeResult('rust-wasm', [makeDiagnostic(0, 0)]);
  assert.strictEqual(resultsEqualShallow(a, b), true);
  const c = makeResult('rust-wasm', [makeDiagnostic(0, 0, 'OTHER')]);
  assert.strictEqual(resultsEqualShallow(a, c), false);
  const d = makeResult('rust-wasm', []);
  assert.strictEqual(resultsEqualShallow(a, d), false);
});

test('createRustWasmWorkerAdapter 默认 manifestPath 解析到 assets/rust-wasm/manifest.json', () => {
  const { DEFAULT_MANIFEST_PATH } = require('../src/rustWasmWorkerAdapter');
  assert.ok(DEFAULT_MANIFEST_PATH.replace(/\\/g, '/').includes('assets/rust-wasm/manifest.json'));
});
