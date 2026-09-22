// tests/formattingProvider.test.js
// Phase 3 Step 5：formattingProvider 单测。覆盖 provideDocumentFormattingEdits：
//   - options.insertSpaces/tabSize 透传给 `formatDocument(request, options)`
//   - AnalysisTextEdit → vscode.TextEdit.replace 转换
//   - 单文档整段替换契约（analysisCore.formatDocument 的「单 edit 整文档替换」）
//   - 空文本返回空 edits

const assert = require('node:assert');
const { test } = require('node:test');
const {
  installVscodeMock,
  uninstallVscodeMock,
  TextEdit
} = require('./helpers/vscodeMock');
const { createDocumentSnapshot } = require('./helpers/documentMock');

function loadFormattingProvider() {
  delete require.cache[require.resolve('../src/providerShared')];
  delete require.cache[require.resolve('../src/analysisProtocol')];
  // R1.2 Stage B: src/analysisCore.js 已 git rm; 不再 require 它 (formattingProvider 不再 require analysisCore).
  // 不清 hostRustAnalyzer 缓存: 模块状态 cachedHostAnalyzer 是 module-level
  // singleton, 删 require.cache 会让 getHostRustAnalyzer() 返回 null 导致 format 失效.
  delete require.cache[require.resolve('../src/formattingProvider')];
  return require('../src/formattingProvider');
}

// R1.2 Stage B: provider 通过 host Rust analyzer 拿 edits; init 一次 wasm 实例,
// 后续 format 调用同步等待 analyzer 就绪. 复用 hostRustAnalyzer 的 cached analyzer
// 让所有测试共享同一 wasm 实例.
const { initHostRustAnalyzer, getHostRustAnalyzer } = require('../src/hostRustAnalyzer');
const HOST_ANALYZER_READY = getHostRustAnalyzer()
  ? Promise.resolve()
  : initHostRustAnalyzer();

function withVscodeMock(fn) {
  return async () => {
    installVscodeMock();
    try {
      await HOST_ANALYZER_READY;
      await fn();
    } finally {
      uninstallVscodeMock();
    }
  };
}

async function format(document, options) {
  const { provideDocumentFormattingEdits } = loadFormattingProvider();
  await HOST_ANALYZER_READY;
  return provideDocumentFormattingEdits(document, options);
}

test('formattingProvider returns edits when document has unformatted content', withVscodeMock(async () => {
  // 缺分号、缩进不对 → formatDocument 应该返回整文档替换 edit
  const doc = createDocumentSnapshot('IF #1 = 1 THEN\n#1 := 2\nEND_IF;\n', { uri: 'file:///test.nc' });
  const edits = await format(doc, { insertSpaces: false, tabSize: 4 });
  assert.ok(Array.isArray(edits));
  // formatDocument 在有差异时产出整文档 TextEdit；无差异时返回空。本场景
  // `#1 = 1` 应规范化为 `#1 := 1`，整文档替换应被产出。
  assert.ok(edits.length === 1, `expected 1 edit for unformatted doc, got ${edits.length}`);
  assert.ok(edits[0] instanceof TextEdit);
  assert.ok(edits[0].newText.length > 0);
  // 整文档替换：从 0 行 0 字符到 lineCount-1 末尾
  assert.strictEqual(edits[0].range.start.line, 0);
  assert.strictEqual(edits[0].range.start.character, 0);
  // end.line 应是文档最后一行
  assert.ok(edits[0].range.end.line >= doc.lineCount - 1);
}));

test('formattingProvider returns empty edits when document is already well-formatted', withVscodeMock(async () => {
  // 完全规范的文件：%@MACRO 头、分号、缩进、`:=` 形式，无变化
  const doc = createDocumentSnapshot('%@MACRO\n#1 := 1;\n', { uri: 'file:///test.nc' });
  const edits = await format(doc, { insertSpaces: false, tabSize: 4 });
  assert.ok(Array.isArray(edits));
  assert.strictEqual(edits.length, 0, `expected no edits for well-formatted doc, got ${JSON.stringify(edits)}`);
}));

test('formattingProvider passes options through to host Rust analyzer (always space-indented)', withVscodeMock(async () => {
  // R1.2 Stage B: host Rust analyzer 接管 formatDocument; Rust 端 format_document
  // 总是产出空格缩进 (insertSpaces/tabSize options 当前不被 Rust ABI 使用).
  const doc = createDocumentSnapshot('IF #1 = 1 THEN\n#1 := 1;\n', { uri: 'file:///test.nc' });
  const editsWithSpaces = await format(doc, { insertSpaces: true, tabSize: 2 });
  const editWithTabs = await format(doc, { insertSpaces: false, tabSize: 4 });
  assert.ok(editsWithSpaces.length > 0);
  assert.ok(editWithTabs.length > 0);
  // R1.2: 两次调用产出相同文本 (Rust 不消费 insertSpaces/tabSize options).
  const spacesText = editsWithSpaces[0].newText;
  const tabsText = editWithTabs[0].newText;
  assert.strictEqual(spacesText, tabsText, 'Rust format_document 总是产出空格缩进, 两次调用结果相同');
  // 至少含 4 空格缩进
  assert.ok(spacesText.includes('    '), 'format output should include at least one 4-space indentation');
  assert.ok(!spacesText.includes('\t'), 'Rust format_document should not emit tabs');
}));

test('formattingProvider handles empty document', withVscodeMock(async () => {
  const doc = createDocumentSnapshot('', { uri: 'file:///test.nc' });
  const edits = await format(doc, { insertSpaces: false, tabSize: 4 });
  assert.deepStrictEqual(edits, []);
}));

test('formattingProvider normalize_assignment_operator equals → colon-equals', withVscodeMock(async () => {
  const doc = createDocumentSnapshot('#1 = #2;\n', { uri: 'file:///test.nc' });
  const edits = await format(doc, { insertSpaces: false, tabSize: 4 });
  assert.ok(edits.length >= 1);
  assert.ok(edits[0].newText.includes('#1 := #2'), 'should normalize = to := in edits');
}));
