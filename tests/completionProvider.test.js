// tests/completionProvider.test.js
// Phase 3 Step 2：completionProvider 独立单测。覆盖 completionProvider.js 中
// provideCompletionItems 的所有分支：变量 `#` 补全、函数补全、关键字补全、
// G/M 码补全、enableCompletions=false 时返回空、wordMatch 无匹配返回空。
//
// 通过 tests/helpers/vscodeMock.js + tests/helpers/documentMock.js 让
// completionProvider 在 node --test 下跑 unit，不依赖真实 VS Code extension host。

const assert = require('node:assert');
const { test } = require('node:test');
const {
  installVscodeMock,
  uninstallVscodeMock,
  Position,
  CompletionItem
} = require('./helpers/vscodeMock');
const { createDocumentSnapshot } = require('./helpers/documentMock');

function loadCompletionProvider() {
  // 清除 providerShared/completionProvider 的 require cache 让下面的 require
  // 重新执行模块初始化逻辑（再次 require('vscode')，从而读到最新 mock 配置）。
  delete require.cache[require.resolve('../src/providerShared')];
  delete require.cache[require.resolve('../src/completionProvider')];
  return require('../src/completionProvider');
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

test('provideCompletionItems returns variable items when prefix ends with #', withVscodeMock(() => {
  const { provideCompletionItems } = loadCompletionProvider();
  // 第二行 `#` 单独：wordMatch 失败，但 textBefore 以 `#` 结束→走变量补全
  const doc = createDocumentSnapshot('#1 := 100;\n#\n', { uri: 'file:///test.nc' });
  const items = provideCompletionItems(doc, new Position(1, 1));
  assert.ok(Array.isArray(items));
  // VARIABLE_COMPLETION_COUNT=20 + BIG_VARIABLES 10 = 30 项
  assert.strictEqual(items.length, 30);
  assert.ok(items[0] instanceof CompletionItem);
  assert.strictEqual(items[0].label, '#1');
  assert.strictEqual(items[0].detail, '局部变量 #1');
  assert.strictEqual(items[0].insertText, '1');
  assert.strictEqual(items[items.length - 1].label, '#9906');
}));

test('provideCompletionItems returns functions matching prefix (IF)', withVscodeMock(() => {
  const { provideCompletionItems } = loadCompletionProvider();
  const doc = createDocumentSnapshot('I', { uri: 'file:///test.nc' });
  // `I` 之前没有其他字符 → wordMatch='I'，转大写后查 IF 函数
  const items = provideCompletionItems(doc, new Position(0, 1));
  assert.ok(items.length > 0);
  // 至少有一项 label 以 'I' 开头（IF 函数补全）
  const hasIf = items.some(i => i.label === 'IF');
  assert.ok(hasIf, 'expected an IF completion in items');
}));

test('provideCompletionItems returns G codes when prefix starts with G', withVscodeMock(() => {
  const { provideCompletionItems } = loadCompletionProvider();
  const doc = createDocumentSnapshot('G1', { uri: 'file:///test.nc' });
  const items = provideCompletionItems(doc, new Position(0, 2));
  // 只是确保 G 码补全路径染动了；不要对具体数量硬断言（与 functions.js 数据耦合）
  assert.ok(items.length > 0);
  const allStartWithG = items.some(i => String(i.label).startsWith('G'));
  assert.ok(allStartWithG, 'expected at least one G-code completion');
}));

test('provideCompletionItems returns M codes when prefix starts with M', withVscodeMock(() => {
  const { provideCompletionItems } = loadCompletionProvider();
  const doc = createDocumentSnapshot('M9', { uri: 'file:///test.nc' });
  const items = provideCompletionItems(doc, new Position(0, 2));
  assert.ok(items.length > 0);
  const allStartWithM = items.some(i => String(i.label).startsWith('M'));
  assert.ok(allStartWithM, 'expected at least one M-code completion');
}));

test('provideCompletionItems returns empty when wordMatch does not match any function/keyword/code', withVscodeMock(() => {
  const { provideCompletionItems } = loadCompletionProvider();
  // 没有匹配 'ZZZ' 的函数/关键字/G/M 码
  const doc = createDocumentSnapshot('ZZZ', { uri: 'file:///test.nc' });
  const items = provideCompletionItems(doc, new Position(0, 3));
  assert.deepStrictEqual(items, []);
}));

test('provideCompletionItems returns empty when wordMatch is absent', withVscodeMock(() => {
  const { provideCompletionItems } = loadCompletionProvider();
  // 数字开头无标识符词汇
  const doc = createDocumentSnapshot('123', { uri: 'file:///test.nc' });
  const items = provideCompletionItems(doc, new Position(0, 3));
  assert.deepStrictEqual(items, []);
}));

test('provideCompletionItems returns empty when enableCompletions=false', () => {
  // 使用 overrides.workspace 注入 enableCompletions=false 的 getConfiguration，
  // 避免直接修改 vscode.workspace 字段污染后续用例（installVscodeMock
  // 每次重建 workspace，但当前 Module.__syntecVscodeMock 还是同一对象引用）。
  installVscodeMock({
    workspace: {
      getConfiguration() {
        const store = { enableCompletions: false };
        return {
          get(key, def) {
            if (key === 'enableCompletions') return false;
            return store[key] === undefined ? def : store[key];
          },
          has() { return true; },
          inspect() { return {}; },
          update() { return Promise.resolve(); }
        };
      }
    }
  });
  try {
    const { provideCompletionItems } = loadCompletionProvider();
    const doc = createDocumentSnapshot('IF', { uri: 'file:///test.nc' });
    const items = provideCompletionItems(doc, new Position(0, 2));
    assert.deepStrictEqual(items, []);
  } finally {
    uninstallVscodeMock();
  }
});

test('provideCompletionItems excludes GOTO from keyword completions', withVscodeMock(() => {
  const { provideCompletionItems } = loadCompletionProvider();
  // 按 completionProvider.js：kw.startsWith(prefix) && kw !== 'GOTO' 跳过 GOTO
  const doc = createDocumentSnapshot('GOTO', { uri: 'file:///test.nc' });
  const items = provideCompletionItems(doc, new Position(0, 4));
  const hasGoto = items.some(i => i.label === 'GOTO');
  assert.ok(!hasGoto, 'GOTO should not appear in keyword completions');
}));

test('provideCompletionItems uppercases the prefix (lowercase input still matches)', withVscodeMock(() => {
  const { provideCompletionItems } = loadCompletionProvider();
  const doc = createDocumentSnapshot('if', { uri: 'file:///test.nc' });
  const items = provideCompletionItems(doc, new Position(0, 2));
  // 函数索引/关键字都按大写登记，小写 'if' 仍应匹配 IF
  const hasIf = items.some(i => i.label === 'IF');
  assert.ok(hasIf, 'lowercase prefix should still match IF');
}));
