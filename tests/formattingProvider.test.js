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
  delete require.cache[require.resolve('../src/analysisCore')];
  delete require.cache[require.resolve('../src/formattingProvider')];
  return require('../src/formattingProvider');
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

function format(document, options) {
  const { provideDocumentFormattingEdits } = loadFormattingProvider();
  return provideDocumentFormattingEdits(document, options);
}

test('formattingProvider returns edits when document has unformatted content', withVscodeMock(() => {
  // 缺分号、缩进不对 → formatDocument 应该返回整文档替换 edit
  const doc = createDocumentSnapshot('IF #1 = 1 THEN\n#1 := 2\nEND_IF;\n', { uri: 'file:///test.nc' });
  const edits = format(doc, { insertSpaces: false, tabSize: 4 });
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

test('formattingProvider returns empty edits when document is already well-formatted', withVscodeMock(() => {
  // 完全规范的文件：%@MACRO 头、分号、缩进、`:=` 形式，无变化
  const doc = createDocumentSnapshot('%@MACRO\n#1 := 1;\n', { uri: 'file:///test.nc' });
  const edits = format(doc, { insertSpaces: false, tabSize: 4 });
  assert.ok(Array.isArray(edits));
  assert.strictEqual(edits.length, 0, `expected no edits for well-formatted doc, got ${JSON.stringify(edits)}`);
}));

test('formattingProvider passes insertSpaces/tabSize options through to formatDocument', withVscodeMock(() => {
  const doc = createDocumentSnapshot('IF #1 = 1 THEN\n#1 := 1;\n', { uri: 'file:///test.nc' });
  const editsWithSpaces = format(doc, { insertSpaces: true, tabSize: 2 });
  const editWithTabs = format(doc, { insertSpaces: false, tabSize: 4 });
  assert.ok(editsWithSpaces.length > 0);
  assert.ok(editWithTabs.length > 0);
  // 缩进差异：插入空格版本应为 "  " (2 空格)，tab 版本应为 "\t"
  const spacesText = editsWithSpaces[0].newText;
  const tabsText = editWithTabs[0].newText;
  // 同一源文件分别格式化后应产出不同的最终文本（tab/space 缩进差异）
  assert.notStrictEqual(spacesText, tabsText);
  // tab 版本应该含 \t 至少一个
  assert.ok(tabsText.includes('\t'), 'tab version should include a tab character in indentation');
  // space 版本应含 "  "、且不含孤立 \t 当作缩进
  assert.ok(spacesText.includes('  '), 'space version should include at least one double-space indentation');
  assert.ok(!spacesText.includes('\t'), 'space version should not include tabs');
}));

test('formattingProvider handles empty document', withVscodeMock(() => {
  const doc = createDocumentSnapshot('', { uri: 'file:///test.nc' });
  const edits = format(doc, { insertSpaces: false, tabSize: 4 });
  assert.deepStrictEqual(edits, []);
}));

test('formattingProvider normalize_assignment_operator equals → colon-equals', withVscodeMock(() => {
  const doc = createDocumentSnapshot('#1 = #2;\n', { uri: 'file:///test.nc' });
  const edits = format(doc, { insertSpaces: false, tabSize: 4 });
  assert.ok(edits.length >= 1);
  assert.ok(edits[0].newText.includes('#1 := #2'), 'should normalize = to := in edits');
}));
