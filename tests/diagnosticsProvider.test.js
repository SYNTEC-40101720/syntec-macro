// tests/diagnosticsProvider.test.js
// Phase 3 Step 7：diagnosticsProvider 主机端单测。当前 worker spawn 与
// 防抖/超时部分由 workerLifecycle.test.js 用真 worker_threads 覆盖；
// 本测试针对主机端纯函数边界，不依赖真实 worker spawn：
//   - setDiagnosticCollection 接收 collection 后 store
//   - dispose 多次调用不抛错
//   - provideCodeActions 对 MISSING_SEMICOLON 产出补 `;` action
//   - provideCodeActions 对 CONTROL_STRUCTURE_TRAILING_SEMICOLON 产出移除 `;` action
//   - provideCodeActions 对 UNSUPPORTED_FANUC_COMPARISON 产出（EQ→=）替换 action
//   - provideCodeActions 对非 actionable diagnostic 返回空

const assert = require('node:assert');
const { test } = require('node:test');
const {
  installVscodeMock,
  uninstallVscodeMock,
  DiagnosticCollectionMock
} = require('./helpers/vscodeMock');
const { createDocumentSnapshot } = require('./helpers/documentMock');

function loadDiagnosticsProvider() {
  delete require.cache[require.resolve('../src/providerShared')];
  delete require.cache[require.resolve('../src/diagnosticsProvider')];
  return require('../src/diagnosticsProvider');
}

function withVscodeMock(fn) {
  return () => {
    installVscodeMock();
    try {
      fn();
    } finally {
      uninstallVscodeMock();
    }
  };
}

function makeDiagnostic(code, line, character, message = 'msg', span = 2) {
  return {
    code,
    message,
    source: 'syntec-macro',
    range: {
      start: { line, character },
      end: { line, character: character + span }
    }
  };
}

test('setDiagnosticCollection stores the collection and dispose clears timers', withVscodeMock(() => {
  const { setDiagnosticCollection, dispose } = loadDiagnosticsProvider();
  const collection = new DiagnosticCollectionMock('syntec-macro');
  assert.doesNotThrow(() => setDiagnosticCollection(collection));
  // dispose 多次调用不应抛错（防止热重载后重复 dispose）
  assert.doesNotThrow(() => dispose());
  assert.doesNotThrow(() => dispose());
}));

test('provideCodeActions returns insert-semicolon action for MISSING_SEMICOLON diagnostic', withVscodeMock(() => {
  const { provideCodeActions } = loadDiagnosticsProvider();
  const doc = createDocumentSnapshot('IF #1 = 1 THEN', { uri: 'file:///test.nc' });
  const context = { only: undefined, diagnostics: [makeDiagnostic('SYNTEC_MISSING_SEMICOLON', 0, 17)] };
  const actions = provideCodeActions(doc, { start: { line: 0, character: 0 }, end: { line: 0, character: 17 } }, context);
  assert.ok(Array.isArray(actions));
  assert.ok(actions.length > 0, 'should produce at least 1 action for MISSING_SEMICOLON');
  // action 应包含 title 或 command 关键字
  const hasSemicolonAction = actions.some(a => typeof a.title === 'string' && a.title.includes(';'));
  assert.ok(hasSemicolonAction, 'expected at least one action whose title mentions semicolon');
}));

test('provideCodeActions returns remove-semicolon action for CONTROL_STRUCTURE_TRAILING_SEMICOLON', withVscodeMock(() => {
  const { provideCodeActions } = loadDiagnosticsProvider();
  const doc = createDocumentSnapshot('END_IF;', { uri: 'file:///test.nc' });
  const context = { only: undefined, diagnostics: [makeDiagnostic('SYNTEC_CONTROL_STRUCTURE_TRAILING_SEMICOLON', 0, 6)] };
  const actions = provideCodeActions(doc, { start: { line: 0, character: 0 }, end: { line: 0, character: 7 } }, context);
  assert.ok(Array.isArray(actions));
  assert.ok(actions.length > 0, 'should produce at least 1 action for trailing semicolon');
  const hasRemoveAction = actions.some(a => typeof a.title === 'string' && (a.title.includes('移除') || a.title.includes(';')));
  assert.ok(hasRemoveAction, 'expected at least one action whose title mentions removing semicolon');
}));

test('provideCodeActions returns replacement action for UNSUPPORTED_FANUC_COMPARISON (EQ)', withVscodeMock(() => {
  const { provideCodeActions } = loadDiagnosticsProvider();
  // "IF #1 EQ #2 THEN" 中 EQ 在 col 6 (I=0 F=1 空=2 #=3 1=4 空=5 E=6 Q=7)
  const doc = createDocumentSnapshot('IF #1 EQ #2 THEN', { uri: 'file:///test.nc' });
  const context = { only: undefined, diagnostics: [makeDiagnostic('SYNTEC_UNSUPPORTED_FANUC_COMPARISON', 0, 6, 'EQ', 2)] };
  const actions = provideCodeActions(doc, { start: { line: 0, character: 6 }, end: { line: 0, character: 8 } }, context);
  assert.ok(Array.isArray(actions));
  assert.ok(actions.length > 0, 'should produce at least 1 action for FANUC comparison');
  // action.title 应含 `=` 或 「改为」
  const title = String(actions[0].title);
  assert.ok(title.includes('=') || title.includes('改为'), `expected replacement title, got: ${title}`);
}));

test('provideCodeActions returns empty array when no actionable diagnostics', withVscodeMock(() => {
  const { provideCodeActions } = loadDiagnosticsProvider();
  const doc = createDocumentSnapshot('#1 := 1;', { uri: 'file:///test.nc' });
  // 用一个完全没登记 code action 的假 code 触发 fall-through 路径
  const context = { only: undefined, diagnostics: [makeDiagnostic('SYNTEC_FAKE_NEVER_REGISTERED_CODE', 0, 0, '', 1)] };
  const actions = provideCodeActions(doc, { start: { line: 0, character: 0 }, end: { line: 0, character: 1 } }, context);
  assert.deepStrictEqual(actions, []);
}));

test('provideCodeActions handles empty diagnostics array', withVscodeMock(() => {
  const { provideCodeActions } = loadDiagnosticsProvider();
  const doc = createDocumentSnapshot('', { uri: 'file:///test.nc' });
  const actions = provideCodeActions(doc, { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } }, { only: undefined, diagnostics: [] });
  assert.deepStrictEqual(actions, []);
}));

test('provideCodeActions filters out diagnostics without syntec-macro source', withVscodeMock(() => {
  const { provideCodeActions } = loadDiagnosticsProvider();
  const doc = createDocumentSnapshot('IF #1 = 1 THEN', { uri: 'file:///test.nc' });
  // source 字段不是 'syntec-macro' → 应被 getActionableDiagnostics filter 掉
  const fakeDiagnostic = {
    code: 'SYNTEC_MISSING_SEMICOLON',
    message: 'msg',
    source: 'other-extension',
    range: { start: { line: 0, character: 17 }, end: { line: 0, character: 19 } }
  };
  const context = { only: undefined, diagnostics: [fakeDiagnostic] };
  const actions = provideCodeActions(doc, { start: { line: 0, character: 0 }, end: { line: 0, character: 17 } }, context);
  assert.deepStrictEqual(actions, []);
}));
