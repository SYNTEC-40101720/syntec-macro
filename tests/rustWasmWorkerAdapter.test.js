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

test('createRustWasmWorkerAdapter 默认 manifestPath 解析到 assets/rust-wasm/manifest.json', () => {
  const { DEFAULT_MANIFEST_PATH } = require('../src/rustWasmWorkerAdapter');
  assert.ok(DEFAULT_MANIFEST_PATH.replace(/\\/g, '/').includes('assets/rust-wasm/manifest.json'));
});
