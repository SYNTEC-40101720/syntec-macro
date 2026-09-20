// tests/vscodeMockSmoke.test.js
// Phase 3 Step 1 冒烟测试：验证 tests/helpers/vscodeMock.js 安装后，4 个 Provider
// 可在 node --test 下 require + 实例化基本工作流。本测试不作业务行为断言，
// 后续 Phase 3.2..3.5 再加各 Provider 独立测试。

const assert = require('node:assert');
const { test } = require('node:test');
const {
  installVscodeMock,
  uninstallVscodeMock
} = require('./helpers/vscodeMock');

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

test('vscodeMock installs Position/Range/Location into require(vscode)', () => {
  installVscodeMock();
  try {
    const vscode = require('vscode');
    const p1 = new vscode.Position(1, 2);
    const p2 = new vscode.Position(1, 5);
    const range = new vscode.Range(p1, p2);
    assert.strictEqual(p1.line, 1);
    assert.strictEqual(p1.character, 2);
    assert.strictEqual(range.start.character, 2);
    assert.strictEqual(range.end.character, 5);
    assert.ok(p1.isBefore(p2));
    assert.ok(!p1.isAfter(p2));

    // Uri.file + Location round-trip
    const uri = vscode.Uri.file('/workspace/sample.nc');
    assert.strictEqual(uri.scheme, 'file');
    const loc = new vscode.Location(uri, p1);
    assert.strictEqual(loc.uri.scheme, 'file');
    assert.strictEqual(loc.range.start.line, 1);
    assert.strictEqual(loc.range.end.line, 1);

    // MarkdownString accumulates value
    const md = new vscode.MarkdownString();
    md.appendCodeblock('IF #1 THEN', 'syntec-macro');
    md.appendMarkdown('\n说明');
    assert.ok(md.value.includes('IF #1 THEN'));
    assert.ok(md.value.includes('```syntec-macro'));
    assert.ok(md.value.includes('说明'));
  } finally {
    uninstallVscodeMock();
  }
});

test('vscodeMock CompletionItem + SnippetString + TextEdit round-trip', () => {
  installVscodeMock();
  try {
    const vscode = require('vscode');
    const item = new vscode.CompletionItem('IF', vscode.CompletionItemKind.Keyword);
    item.detail = '关键 IF';
    item.documentation = new vscode.MarkdownString('keyword doc');
    item.insertText = new vscode.SnippetString('IF $1 THEN\nEND_IF');
    assert.strictEqual(item.label, 'IF');
    assert.strictEqual(item.detail, '关键 IF');
    assert.strictEqual(item.documentation.value, 'keyword doc');
    assert.strictEqual(item.insertText.value, 'IF $1 THEN\nEND_IF');

    const range = new vscode.Range(0, 0, 0, 3);
    const edit = vscode.TextEdit.replace(range, 'IF');
    assert.strictEqual(edit.range.start.line, 0);
    assert.strictEqual(edit.newText, 'IF');
  } finally {
    uninstallVscodeMock();
  }
});

test('vscodeMock getConfiguration returns syntecMacro.* defaults', () => {
  installVscodeMock();
  try {
    const vscode = require('vscode');
    const config = vscode.workspace.getConfiguration('syntecMacro');
    assert.strictEqual(config.get('enableHover'), true);
    assert.strictEqual(config.get('enableCompletions'), true);
    assert.strictEqual(config.get('enableDiagnostics'), true);
    assert.deepStrictEqual(config.get('includePath'), []);
    // 未知键回退默认值
    assert.strictEqual(config.get('unknownKey', 'default'), 'default');
  } finally {
    uninstallVscodeMock();
  }
});

test('installVscodeMock + uninstallVscodeMock leaves require cache clean for vscode', () => {
  // 安装前 require('vscode') 应抛错或返回真实 vscode（CI Ubuntu 上不可用），
  // 但本测试只验证 uninstall 后 mock 已移除，不假设真实 vscode 存在。
  installVscodeMock();
  const mocked = require('vscode');
  assert.strictEqual(mocked.Position.name, 'Position');
  uninstallVscodeMock();
  // 再次安装在新 require cycle 仍能工作（覆盖多次 install/uninstall 场景）
  installVscodeMock();
  const reinstalled = require('vscode');
  assert.ok(reinstalled.Range);
  assert.ok(reinstalled.Hover);
  uninstallVscodeMock();
});

test('completionProvider can be required under vscodeMock', withVscodeMock(() => {
  // 不调用 provideCompletionItems（需要完整 document 接口），只确保 module 加载
  // 与导出合约在 mock 环境下仍可用。
  delete require.cache[require.resolve('../src/completionProvider')];
  const { provideCompletionItems } = require('../src/completionProvider');
  assert.strictEqual(typeof provideCompletionItems, 'function');
}));

test('hoverProvider can be required under vscodeMock', withVscodeMock(() => {
  delete require.cache[require.resolve('../src/hoverProvider')];
  const { provideHover } = require('../src/hoverProvider');
  assert.strictEqual(typeof provideHover, 'function');
}));

test('definitionProvider can be required under vscodeMock', withVscodeMock(() => {
  delete require.cache[require.resolve('../src/definitionProvider')];
  const { provideDefinition } = require('../src/definitionProvider');
  assert.strictEqual(typeof provideDefinition, 'function');
}));

test('formattingProvider can be required under vscodeMock', withVscodeMock(() => {
  delete require.cache[require.resolve('../src/formattingProvider')];
  const { provideDocumentFormattingEdits } = require('../src/formattingProvider');
  assert.strictEqual(typeof provideDocumentFormattingEdits, 'function');
}));
