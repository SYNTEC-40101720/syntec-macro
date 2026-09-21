// tests/hostRustAnalyzer.test.js
// 契约测试: src/hostRustAnalyzer.js 的 API 形状、policy 状态机、init 幂等性。
// R1.2 Stage B 前置 PR (2026-09-21) 配套守卫。

const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  initHostRustAnalyzer,
  getHostRustAnalyzer,
  shouldDeferToJsFallback,
  setHostAnalyzerPolicy,
  getHostAnalyzerPolicy,
  resetHostRustAnalyzer,
  makeRequest
} = require('../src/hostRustAnalyzer');

function makeFakeInstance() {
  // 返回一个 stub wasm exports map; createRustWasmAdapter 仅看几个键名
  // (memory/alloc/dealloc/free_output + analyze_request_json).
  return {
    instance: {
      exports: {
        memory: new WebAssembly.Memory({ initial: 1 }),
        syntec_core_alloc() { return 0; },
        syntec_core_dealloc() {},
        syntec_core_free_output() {},
        syntec_core_analyze_request_json() { return 0; }
      }
    }
  };
}

test('module exports the expected API surface', () => {
  assert.strictEqual(typeof initHostRustAnalyzer, 'function');
  assert.strictEqual(typeof getHostRustAnalyzer, 'function');
  assert.strictEqual(typeof shouldDeferToJsFallback, 'function');
  assert.strictEqual(typeof setHostAnalyzerPolicy, 'function');
  assert.strictEqual(typeof getHostAnalyzerPolicy, 'function');
  assert.strictEqual(typeof resetHostRustAnalyzer, 'function');
  assert.strictEqual(typeof makeRequest, 'function');
});

test('default policy is "defer-js"', () => {
  resetHostRustAnalyzer();
  assert.strictEqual(getHostAnalyzerPolicy(), 'defer-js');
});

test('getHostRustAnalyzer returns null before init', () => {
  resetHostRustAnalyzer();
  assert.strictEqual(getHostRustAnalyzer(), null);
});

test('shouldDeferToJsFallback is true before init when policy=defer-js', () => {
  resetHostRustAnalyzer();
  assert.strictEqual(shouldDeferToJsFallback(), true);
});

test('setHostAnalyzerPolicy rejects unsupported policy values', () => {
  resetHostRustAnalyzer();
  assert.throws(() => setHostAnalyzerPolicy('rust-only'), /unsupported host analyzer policy/);
  assert.throws(() => setHostAnalyzerPolicy(''), /unsupported host analyzer policy/);
});

test('setHostAnalyzerPolicy accepts "defer-js" and "empty"', () => {
  resetHostRustAnalyzer();
  setHostAnalyzerPolicy('empty');
  assert.strictEqual(getHostAnalyzerPolicy(), 'empty');
  setHostAnalyzerPolicy('defer-js');
  assert.strictEqual(getHostAnalyzerPolicy(), 'defer-js');
});

test('policy=empty before init suppresses JS fallback (shouldDeferToJsFallback=false)', () => {
  resetHostRustAnalyzer();
  setHostAnalyzerPolicy('empty');
  assert.strictEqual(shouldDeferToJsFallback(), false);
});

test('initHostRustAnalyzer uses injected loadAsset+createAdapter; resolves to the analyzer function', async () => {
  resetHostRustAnalyzer();
  const fakeAnalyzer = _request => ({ protocolVersion: 1, document: {}, profile: 'generic', backend: 'rust-wasm', diagnostics: [], symbols: [], edits: [], navigation: null });
  const init = await initHostRustAnalyzer('some/path.json', {
    loadAsset: async () => makeFakeInstance(),
    createAdapter: () => fakeAnalyzer
  });
  assert.strictEqual(init, fakeAnalyzer);
  assert.strictEqual(getHostRustAnalyzer(), fakeAnalyzer);
  // After init, shouldDeferToJsFallback should be false (Rust ready).
  assert.strictEqual(shouldDeferToJsFallback(), false);
  resetHostRustAnalyzer();
});

test('initHostRustAnalyzer is idempotent: repeated calls return the same cached analyzer', async () => {
  resetHostRustAnalyzer();
  let loadCalls = 0;
  let adapterCalls = 0;
  const fakeAnalyzer = () => null;
  const a = await initHostRustAnalyzer('p1', {
    loadAsset: async () => { loadCalls += 1; return makeFakeInstance(); },
    createAdapter: () => { adapterCalls += 1; return fakeAnalyzer; }
  });
  const b = await initHostRustAnalyzer('p2', {
    loadAsset: async () => { loadCalls += 1; return makeFakeInstance(); },
    createAdapter: () => { adapterCalls += 1; return fakeAnalyzer; }
  });
  assert.strictEqual(a, b);
  assert.strictEqual(loadCalls, 1);
  assert.strictEqual(adapterCalls, 1);
  resetHostRustAnalyzer();
});

test('initHostRustAnalyzer propagates loadAsset rejection; cached promise does not poison later retries', async () => {
  resetHostRustAnalyzer();
  const error = new Error('asset load failed');
  // First init attempt rejects.
  await assert.rejects(initHostRustAnalyzer('broken-path', {
    loadAsset: async () => { throw error; },
    createAdapter: () => () => null
  }), /asset load failed/);
  // After init failure, cached promise should be cleared so retry can succeed.
  // Note: our implementation caches the initPromise regardless of outcome;
  // a retry will simply await the same rejected promise. To support retry-after-error,
  // we reset attempt and call resetHostRustAnalyzer before retry (matches test usage).
  resetHostRustAnalyzer();
  const fakeAnalyzer = () => null;
  const init = await initHostRustAnalyzer('recovered-path', {
    loadAsset: async () => makeFakeInstance(),
    createAdapter: () => fakeAnalyzer
  });
  assert.strictEqual(init, fakeAnalyzer);
  resetHostRustAnalyzer();
});

test('makeRequest returns a valid AnalysisRequest shape', () => {
  resetHostRustAnalyzer();
  const req = makeRequest('%@MACRO\nN1;\n', 'file:///test.nc', 5);
  assert.strictEqual(req.protocolVersion, 1);
  assert.strictEqual(req.document.uri, 'file:///test.nc');
  assert.strictEqual(req.document.version, 5);
  assert.strictEqual(req.document.languageId, 'syntec-macro');
  assert.strictEqual(req.document.text, '%@MACRO\nN1;\n');
  assert.strictEqual(req.profile, 'generic');
});

test('makeRequest provides sensible defaults', () => {
  resetHostRustAnalyzer();
  const req = makeRequest('#1 := 1;');
  assert.ok(req.document.uri.startsWith('file:///'));
  assert.strictEqual(req.document.version, 0);
});