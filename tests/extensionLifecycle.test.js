// tests/extensionLifecycle.test.js
// Phase 3 Step 6：extension.js activate/deactivate 集成测试。覆盖：
//   - activate 注册全部 8 个 Provider (Completion/Hover/Definition/
//     DocumentSymbol/WorkspaceSymbol/References/Formatting/CodeActions)
//   - createDiagnosticCollection 调用
//   - commands.registerCommand('syntecMacro.showDiagnosticHelp') 调用
//   - statusBar.text 含 package.json 版本号
//   - 各 onDidChange* 事件订阅
//   - deactivate 不抛错

const assert = require('node:assert');
const { test } = require('node:test');
const {
  installVscodeMock,
  uninstallVscodeMock,
  languages,
  commands
} = require('./helpers/vscodeMock');
const packageJson = require('../package.json');

function loadExtension() {
  // 清掉 providerShared 与各 Provider 的 require cache 让 activate 流程
  // 再 require 一遍，避免不同测试用例间 mock 状态外泄。
  delete require.cache[require.resolve('../src/providerShared')];
  delete require.cache[require.resolve('../src/diagnosticsProvider')];
  delete require.cache[require.resolve('../src/navigationProvider')];
  delete require.cache[require.resolve('../src/completionProvider')];
  delete require.cache[require.resolve('../src/hoverProvider')];
  delete require.cache[require.resolve('../src/definitionProvider')];
  delete require.cache[require.resolve('../src/formattingProvider')];
  delete require.cache[require.resolve('../src/extension')];
  return require('../src/extension');
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

function activateExtension() {
  const { activate } = loadExtension();
  const subscriptions = [];
  const context = {
    subscriptions: {
      push(item) { subscriptions.push(item); }
    },
    extensionUri: { scheme: 'file', fsPath: '/ext', _path: '/ext', toString: () => 'file:///ext' }
  };
  activate(context);
  return { subscriptions, context };
}

test('activate registers 7 language providers and 1 diagnostic collection', withVscodeMock(() => {
  activateExtension();
  const registerCalls = languages._calls.filter(c => c.kind.startsWith('register'));
  // 8 个 register：Completion/Hover/Definition/DocumentSymbol/WorkspaceSymbol/
  // References/Formatting/CodeActions
  assert.strictEqual(registerCalls.length, 8, `expected 8 register calls, got ${registerCalls.length}: ${registerCalls.map(c => c.kind)}`);
  const registeredKinds = new Set(registerCalls.map(c => c.kind));
  for (const expectedKind of [
    'registerCompletionItemProvider',
    'registerHoverProvider',
    'registerDefinitionProvider',
    'registerDocumentSymbolProvider',
    'registerWorkspaceSymbolProvider',
    'registerReferenceProvider',
    'registerDocumentFormattingEditProvider',
    'registerCodeActionsProvider'
  ]) {
    assert.ok(registeredKinds.has(expectedKind), `missing ${expectedKind} register call`);
  }
  const diagCalls = languages._calls.filter(c => c.kind === 'createDiagnosticCollection');
  assert.strictEqual(diagCalls.length, 1);
  assert.strictEqual(diagCalls[0].name, 'syntec-macro');
}));

test('activate registers syntecMacro.showDiagnosticHelp command', withVscodeMock(() => {
  activateExtension();
  const matching = commands._calls.filter(c => c.commandId === 'syntecMacro.showDiagnosticHelp');
  assert.strictEqual(matching.length, 1);
  assert.strictEqual(typeof matching[0].handler, 'function');
}));

test('activate creates language status item scoped to syntec-macro', withVscodeMock(() => {
  const { subscriptions } = activateExtension();
  const statusCalls = languages._calls.filter(c => c.kind === 'createLanguageStatusItem');
  assert.strictEqual(statusCalls.length, 1, 'exactly one language status item');
  const status = statusCalls[0];
  assert.strictEqual(status.id, 'syntecMacro.status');
  assert.strictEqual(status.selector.language, 'syntec-macro');
  // 项对象应已写入版本文本并进入 subscriptions
  const item = subscriptions.find(s => s && s.id === 'syntecMacro.status');
  assert.ok(item, 'language status item should be pushed into context.subscriptions');
  assert.ok(item.text.includes(packageJson.version), `status.text should include version, got: ${item.text}`);
  assert.ok(item.command && item.command.command === 'syntecMacro.showWorkerLog');
}));

test('activate registers syntecMacro.showWorkerLog command', withVscodeMock(() => {
  activateExtension();
  const matching = commands._calls.filter(c => c.commandId === 'syntecMacro.showWorkerLog');
  assert.strictEqual(matching.length, 1);
  assert.strictEqual(typeof matching[0].handler, 'function');
}));

test('activate subscribes to workspace events and pushes disposables into context', withVscodeMock(() => {
  const { subscriptions } = activateExtension();
  // onDidChangeTextDocument / onDidOpenTextDocument / onDidChangeConfiguration
  // 各返回一个 Disposable，应被推入 subscriptions。
  // 至少 3 个来自 workspace 事件的 Disposable + statusBar + 其它 register 返回
  assert.ok(subscriptions.length >= 10, `expected at least 10 subscriptions (8 providers + command + statusbar + 3 events), got ${subscriptions.length}`);
}));

test('activate logs extension version to console', withVscodeMock(() => {
  // 用 spy 替换 console.info 拦截 activate 日志
  const originalInfo = console.info;
  const messages = [];
  console.info = (...args) => { messages.push(args.join(' ')); };
  try {
    activateExtension();
    const activationMessage = messages.find(m => m.includes('扩展已激活'));
    assert.ok(activationMessage, `expected activation message, got: ${messages.join(' | ')}`);
    assert.ok(activationMessage.includes(packageJson.version));
  } finally {
    console.info = originalInfo;
  }
}));

test('deactivate does not throw', withVscodeMock(() => {
  // 先 activate 让 diagnosticsProvider.setDiagnosticCollection 等内部状态就位，
  // 再 deactivate 调 dispose() 与 navigation.dispose()。
  activateExtension();
  const { deactivate } = loadExtension();
  // deactivate 在没有 worker 实际 spawn 时应不抛错
  assert.doesNotThrow(() => deactivate());
}));
