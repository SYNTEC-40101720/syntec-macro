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
const {
  analyzeDocument,
  analyzeNavigationDocument,
  formatDocument
} = require('../src/analysisCore');
const { DiagnosticCode } = require('../src/diagnosticCodes');
const { AnalysisHost } = require('../src/analysisHost');
const {
  JAVASCRIPT_BACKEND,
  RUST_WASM_BACKEND,
  createAnalysisBackend
} = require('../src/analysisBackend');

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

test('current JavaScript backend preserves known diagnostic code and boundary', () => {
  const request = createAnalysisRequest(createDocumentSnapshot({
    uri: 'file:///program.nc',
    version: 3,
    languageId: 'syntec-macro',
    text: 'ELSIF #1 = 1 THEN'
  }), { profile: 'generic' });
  const result = analyzeDocument(request);
  const diagnostic = result.diagnostics.find(item => item.code === DiagnosticCode.UNSUPPORTED_ELSIF);

  assert.ok(diagnostic, 'unsupported ELSIF diagnostic should be preserved');
  assert.strictEqual(diagnostic.range.start.line, 0);
  assert.strictEqual(diagnostic.severity, 'error');
  assert.deepStrictEqual(result.document, request.document);
});

test('analysis facade exposes formatter output as a protocol text edit', () => {
  const request = createAnalysisRequest(createDocumentSnapshot({
    uri: 'file:///program.nc',
    version: 4,
    languageId: 'syntec-macro',
    text: 'IF #1 = 1 THEN\n#2 = 2\nEND_IF'
  }));
  const result = formatDocument(request, { tabSize: 4, insertSpaces: true });

  assert.strictEqual(result.backend, 'javascript');
  assert.strictEqual(result.edits.length, 1);
  assert.deepStrictEqual(result.edits[0].range, {
    start: { line: 0, character: 0 },
    end: { line: 2, character: 6 }
  });
  assert.strictEqual(result.edits[0].newText, 'IF #1 = 1 THEN\n    #2 := 2;\nEND_IF;');
});

test('analysis facade routes navigation indexing without changing symbols', () => {
  const request = createAnalysisRequest(createDocumentSnapshot({
    uri: 'file:///G1000',
    version: 1,
    languageId: 'syntec-macro',
    text: '%@MACRO\nN10;\nG65 P1000;'
  }));
  const result = analyzeNavigationDocument(request, 'G1000');
  const index = result.navigation;

  assert.ok(index, 'G1000 should be indexed as a macro file');
  assert.deepStrictEqual(result.symbols, index.symbols);
  assert.strictEqual(index.programEntryName, 'G1000');
  assert.deepStrictEqual(
    index.symbols.map(symbol => [symbol.name, symbol.kind, symbol.line]),
    [['%@MACRO', 'macroHeader', 0], ['N10', 'label', 1]]
  );
  assert.deepStrictEqual(index.calls.map(call => call.targetName), ['G1000']);
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
      return analyzeDocument(request);
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
  const host = new AnalysisHost({ maxEntries: 4 });
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

test('analysis backend keeps JavaScript as the default', () => {
  const request = createAnalysisRequest(createDocumentSnapshot({
    uri: 'file:///backend.nc',
    version: 1,
    languageId: 'syntec-macro',
    text: '#1 := 1;'
  }));
  const backend = createAnalysisBackend();
  const result = backend(request);
  assert.strictEqual(backend(request).backend, JAVASCRIPT_BACKEND);
  assert.strictEqual(result.backend, JAVASCRIPT_BACKEND);
});

test('Rust backend falls back explicitly to JavaScript on failure', () => {
  const request = createAnalysisRequest(createDocumentSnapshot({
    uri: 'file:///backend.nc',
    version: 1,
    languageId: 'syntec-macro',
    text: '#1 := 1;'
  }));
  const fallbackErrors = [];
  const backend = createAnalysisBackend({
    backend: RUST_WASM_BACKEND,
    rustAnalyzer: () => {
      throw new Error('Wasm unavailable');
    },
    onFallback: (error, receivedRequest) => {
      fallbackErrors.push({ error, receivedRequest });
    }
  });
  const result = backend(request);
  assert.strictEqual(result.backend, JAVASCRIPT_BACKEND);
  assert.strictEqual(fallbackErrors.length, 1);
  assert.strictEqual(fallbackErrors[0].error.message, 'Wasm unavailable');
  assert.strictEqual(fallbackErrors[0].receivedRequest, request);
});

test('Rust backend rejects invalid results through the same fallback boundary', () => {
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
  assert.strictEqual(backend(request).backend, JAVASCRIPT_BACKEND);
  assert.match(errors[0].message, /invalid result/);
});
