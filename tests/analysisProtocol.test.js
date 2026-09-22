// 分析协议与当前 JavaScript 后端的黄金样例。

const assert = require('node:assert');
const { test } = require('node:test');
const {
  createAnalysisRequest,
  createAnalysisResult,
  createDocumentSnapshot,
  getAnalysisDiagnosticKey,
  normalizeAnalysisRequest,
  toAnalysisDiagnostic
} = require('../src/analysisProtocol');
const { AnalysisHost } = require('../src/analysisHost');
const { RUST_WASM_BACKEND, createAnalysisBackend } = require('../src/analysisBackend');

test('DocumentSnapshot requires stable document identity and text', () => {
  assert.deepStrictEqual(
    createDocumentSnapshot({
      uri: 'file:///program.nc',
      version: 7,
      languageId: 'syntec-macro',
      text: '#1 := 1;'
    }),
    {
      uri: 'file:///program.nc',
      version: 7,
      languageId: 'syntec-macro',
      text: '#1 := 1;'
    }
  );
  assert.throws(
    () => createDocumentSnapshot({
      uri: 'file:///program.nc',
      version: -1,
      languageId: 'syntec-macro',
      text: ''
    }),
    /document\.version must be a non-negative integer/
  );
});

test('analysis result converts validator positions to zero-based ranges', () => {
  const request = createAnalysisRequest(createDocumentSnapshot({
    uri: 'file:///program.nc',
    version: 1,
    languageId: 'syntec-macro',
    text: ''
  }));
  const result = createAnalysisResult(request, [{
    line: 2,
    col: 4,
    endCol: 9,
    msg: '示例诊断',
    severity: 'warning',
    code: 'SYNTEC_TEST',
    keyword: 'IF'
  }]);

  assert.strictEqual(result.protocolVersion, 1);
  assert.strictEqual(result.backend, 'javascript');
  assert.strictEqual(result.profile, 'generic');
  assert.deepStrictEqual(result.diagnostics[0], {
    range: {
      start: { line: 1, character: 4 },
      end: { line: 1, character: 9 }
    },
    message: '示例诊断',
    severity: 'warning',
    source: 'syntec-macro',
    code: 'SYNTEC_TEST',
    keyword: 'IF'
  });
  assert.strictEqual(
    getAnalysisDiagnosticKey(result.diagnostics[0]),
    getAnalysisDiagnosticKey({ ...result.diagnostics[0], message: '新提示' })
  );
});

test('diagnostic conversion rejects malformed backend output', () => {
  assert.throws(
    () => toAnalysisDiagnostic({
      line: 0,
      col: 0,
      msg: 'invalid'
    }),
    /diagnostic\.line must be a positive integer/
  );
  assert.throws(
    () => toAnalysisDiagnostic({
      line: 1,
      col: 4,
      endCol: 3,
      msg: 'invalid'
    }),
    /diagnostic\.endCol must be greater than or equal/
  );
  assert.throws(
    () => normalizeAnalysisRequest({
      protocolVersion: 99,
      document: {
        uri: 'file:///program.nc',
        version: 1,
        languageId: 'syntec-macro',
        text: ''
      },
      profile: 'generic'
    }),
    /unsupported analysis protocol version/
  );
});

test('AnalysisHost caches exact snapshots and evicts oldest entries', () => {
  let calls = 0;
  const host = new AnalysisHost({
    maxEntries: 1,
    analyzer: request => {
      calls++;
      return { protocolVersion: 1, document: request.document, profile: request.profile, backend: 'rust-wasm', diagnostics: [], symbols: [], edits: [], navigation: null };
    }
  });
  const request = createAnalysisRequest(createDocumentSnapshot({
    uri: 'file:///cache.nc',
    version: 1,
    languageId: 'syntec-macro',
    text: '#1 := 1;'
  }));

  const first = host.analyze(request);
  const second = host.analyze(request);
  assert.strictEqual(first, second);
  assert.deepStrictEqual(host.getStats(), { size: 1, hits: 1, misses: 1 });

  const changed = createAnalysisRequest(createDocumentSnapshot({
    ...request.document,
    version: 2,
    text: '#1 := 2;'
  }));
  host.analyze(changed);
  assert.deepStrictEqual(host.getStats(), { size: 1, hits: 1, misses: 2 });
  host.analyze(request);
  assert.strictEqual(calls, 3, 'the evicted snapshot should be analyzed again');
});

test('AnalysisHost invalidates one URI without affecting other documents', () => {
  // R1.2 Stage B: AnalysisHost no longer falls back to createAnalysisBackend
  // without explicit options; inject a stub analyzer.
  const stub = request => ({
    protocolVersion: 1, document: request.document, profile: request.profile,
    backend: 'rust-wasm', diagnostics: [], symbols: [], edits: [], navigation: null
  });
  const host = new AnalysisHost({ maxEntries: 4, analyzer: stub });
  const first = createAnalysisRequest(createDocumentSnapshot({
    uri: 'file:///first.nc',
    version: 1,
    languageId: 'syntec-macro',
    text: '#1 := 1;'
  }));
  const second = createAnalysisRequest(createDocumentSnapshot({
    uri: 'file:///second.nc',
    version: 1,
    languageId: 'syntec-macro',
    text: '#1 := 2;'
  }));
  host.analyze(first);
  host.analyze(second);
  host.invalidate('file:///first.nc');
  assert.strictEqual(host.getStats().size, 1);
  host.analyze(second);
  assert.strictEqual(host.getStats().hits, 1);
});

test('R1.2 Stage B: createAnalysisBackend requires rustAnalyzer + onFallback', () => {
  // backend default changed from javascript to rust-wasm; missing rustAnalyzer/onFallback throws.
  assert.throws(() => createAnalysisBackend(), /rustAnalyzer must be a function/);
  assert.throws(
    () => createAnalysisBackend({ backend: RUST_WASM_BACKEND, rustAnalyzer: () => null }),
    /onFallback must be a function/
  );
  assert.throws(
    () => createAnalysisBackend({ backend: 'javascript', rustAnalyzer: () => null, onFallback: () => {} }),
    /unsupported analysis backend: javascript \(only rust-wasm is available\)/
  );
});

test('R1.2 Stage B: rust-wasm backend does not fall back to JS on failure', () => {
  const request = createAnalysisRequest(createDocumentSnapshot({
    uri: 'file:///backend.nc',
    version: 1,
    languageId: 'syntec-macro',
    text: '#1 := 1;'
  }));
  const fallbackErrors = [];
  const backend = createAnalysisBackend({
    backend: RUST_WASM_BACKEND,
    rustAnalyzer: () => { throw new Error('Wasm unavailable'); },
    onFallback: (error, receivedRequest) => {
      fallbackErrors.push({ error, receivedRequest });
    }
  });
  // R1.2: backend no longer returns a JS result; it rethrows after onFallback.
  assert.throws(() => backend(request), /Wasm unavailable/);
  assert.strictEqual(fallbackErrors.length, 1);
  assert.strictEqual(fallbackErrors[0].error.message, 'Wasm unavailable');
  assert.strictEqual(fallbackErrors[0].receivedRequest, request);
});

test('R1.2 Stage B: rust-wasm backend rejects invalid results by rethrowing (no JS fallback)', () => {
  const request = createAnalysisRequest(createDocumentSnapshot({
    uri: 'file:///backend.nc',
    version: 1,
    languageId: 'syntec-macro',
    text: '#1 := 1;'
  }));
  const errors = [];
  const backend = createAnalysisBackend({
    backend: RUST_WASM_BACKEND,
    rustAnalyzer: () => ({ backend: 'javascript' }),
    onFallback: error => errors.push(error)
  });
  assert.throws(() => backend(request), /invalid result/);
  assert.match(errors[0].message, /invalid result/);
});
