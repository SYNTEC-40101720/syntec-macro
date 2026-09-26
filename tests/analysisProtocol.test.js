// 分析协议黄金样例：DocumentSnapshot / AnalysisRequest 形状与校验。

const assert = require('node:assert');
const { test } = require('node:test');
const {
  createAnalysisRequest,
  createDocumentSnapshot,
  getAnalysisDiagnosticKey,
  normalizeAnalysisRequest
} = require('../src/analysisProtocol');

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

test('createAnalysisRequest builds a normalized protocol request', () => {
  const request = createAnalysisRequest(createDocumentSnapshot({
    uri: 'file:///program.nc',
    version: 1,
    languageId: 'syntec-macro',
    text: '#1 := 1;'
  }));
  assert.strictEqual(request.protocolVersion, 1);
  assert.strictEqual(request.profile, 'generic');
  assert.deepStrictEqual(request.document, {
    uri: 'file:///program.nc',
    version: 1,
    languageId: 'syntec-macro',
    text: '#1 := 1;'
  });
});

test('protocol rejects malformed shapes', () => {
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
  assert.throws(
    () => createAnalysisRequest({
      uri: '',
      version: 1,
      languageId: 'syntec-macro',
      text: ''
    }),
    /document\.uri must be a non-empty string/
  );
});

test('getAnalysisDiagnosticKey is stable across message changes and keyword-aware', () => {
  const base = {
    range: {
      start: { line: 1, character: 4 },
      end: { line: 1, character: 9 }
    },
    message: '示例诊断',
    severity: 'warning',
    source: 'syntec-macro',
    code: 'SYNTEC_TEST',
    keyword: 'IF'
  };
  assert.strictEqual(
    getAnalysisDiagnosticKey(base),
    getAnalysisDiagnosticKey({ ...base, message: '新提示' })
  );
  assert.notStrictEqual(
    getAnalysisDiagnosticKey(base),
    getAnalysisDiagnosticKey({ ...base, code: 'SYNTEC_OTHER' })
  );
  assert.notStrictEqual(
    getAnalysisDiagnosticKey(base),
    getAnalysisDiagnosticKey({ ...base, keyword: 'WHILE' })
  );
});
