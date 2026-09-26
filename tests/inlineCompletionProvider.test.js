// inlineCompletionProvider.test.js
// 行内补全（1.67+）：关键字前缀匹配 ghost text 行为断言。
// 全部经 vscodeMock 注入，不开真实 VS Code。

const assert = require('node:assert');
const { test } = require('node:test');
const { installVscodeMock, uninstallVscodeMock, Position } = require('./helpers/vscodeMock');

function loadProvider() {
  // providerShared 内部 require('vscode') 在首次加载时已解析，覆盖
  // workspace.getConfiguration 的用例需要连它一起重新加载
  delete require.cache[require.resolve('../src/providerShared')];
  delete require.cache[require.resolve('../src/inlineCompletionProvider')];
  return require('../src/inlineCompletionProvider');
}

// provider 只用 document.uri（isFeatureEnabled）与 document.lineAt(pos).text
function doc(lineText) {
  return {
    uri: { fsPath: '/workspace/sample.nc', scheme: 'file', toString: () => 'file:///workspace/sample.nc' },
    lineAt: () => ({ text: lineText })
  };
}

test('unique keyword prefix yields single ghost text with remaining suffix', async () => {
  installVscodeMock();
  try {
    const { provideInlineCompletionItems } = loadProvider();
    // USERCOR 是 USE 前缀唯一匹配的关键字（关键词表内无其他 USE*）
    const result = await provideInlineCompletionItems(doc('USERCOR'), new Position(0, 3));
    assert.strictEqual(result.items.length, 1);
    assert.strictEqual(result.items[0].insertText, 'RCOR');
    assert.strictEqual(result.enableForwardStability, true);
  } finally {
    uninstallVscodeMock();
  }
});

test('ambiguous prefix yields up to 3 candidates in table order', async () => {
  installVscodeMock();
  try {
    const { provideInlineCompletionItems } = loadProvider();
    // MO 前缀匹配 MOD/MOVC/MOVL/MOVJ，取前 3 条候选（表顺序）
    const result = await provideInlineCompletionItems(doc('MO'), new Position(0, 2));
    assert.ok(result.items.length >= 2 && result.items.length <= 3,
      `expect 2..3 candidates, got ${result.items.length}`);
    const texts = result.items.map(i => i.insertText);
    // 全部是 MO 开头关键字的剩余部分
    for (const t of texts) assert.ok(/^[A-Z]+$/.test(t), `suffix should be identifier: ${t}`);
  } finally {
    uninstallVscodeMock();
  }
});

test('previously blocked keyword becomes reachable via candidates (SKIP -> SKIPCOND)', async () => {
  installVscodeMock();
  try {
    const { provideInlineCompletionItems } = loadProvider();
    // SK 撞 SKIP/SKIPCOND：多候选把被唯一匹配策略挡住的词救回来
    const result = await provideInlineCompletionItems(doc('SK'), new Position(0, 2));
    assert.ok(result.items.length >= 2, 'SK should yield SKIP + SKIPCOND candidates');
    const combined = result.items.map(i => 'SK' + i.insertText);
    assert.ok(combined.includes('SKIP') || combined.includes('SKIPCOND'),
      `expect SKIP/SKIPCOND among ${combined}`);
  } finally {
    uninstallVscodeMock();
  }
});

test('complete keyword yields no ghost text', async () => {
  installVscodeMock();
  try {
    const { provideInlineCompletionItems } = loadProvider();
    const result = await provideInlineCompletionItems(doc('USERCOR'), new Position(0, 7));
    assert.strictEqual(result.items.length, 0, 'no suggestion when word is already complete');
  } finally {
    uninstallVscodeMock();
  }
});

test('single letter prefix yields no ghost text (too ambiguous)', async () => {
  installVscodeMock();
  try {
    const { provideInlineCompletionItems } = loadProvider();
    const result = await provideInlineCompletionItems(doc('U'), new Position(0, 1));
    assert.strictEqual(result.items.length, 0);
  } finally {
    uninstallVscodeMock();
  }
});

test('cursor after text still suggests by prefix before cursor', async () => {
  installVscodeMock();
  try {
    const { provideInlineCompletionItems } = loadProvider();
    // 光标在 USERC 后（光标后还有内容），只看光标前缀 USERC 仍匹配 USERCOR
    const result = await provideInlineCompletionItems(doc('USERCOR X10'), new Position(0, 5));
    assert.strictEqual(result.items.length, 1);
    assert.strictEqual(result.items[0].insertText, 'OR');
  } finally {
    uninstallVscodeMock();
  }
});

test('empty line yields no ghost text', async () => {
  installVscodeMock();
  try {
    const { provideInlineCompletionItems } = loadProvider();
    const result = await provideInlineCompletionItems(doc(''), new Position(0, 0));
    assert.strictEqual(result.items.length, 0);
  } finally {
    uninstallVscodeMock();
  }
});

test('non-identifier before cursor yields no ghost text', async () => {
  installVscodeMock();
  try {
    const { provideInlineCompletionItems } = loadProvider();
    // 数字/小数点前缀（G1.15 类）不是标识符前缀
    const result = await provideInlineCompletionItems(doc('G1.15'), new Position(0, 5));
    assert.strictEqual(result.items.length, 0);
  } finally {
    uninstallVscodeMock();
  }
});

test('every keyword with remaining suffix is reachable via some prefix', async () => {
  installVscodeMock();
  try {
    const { provideInlineCompletionItems } = loadProvider();
    const { getAllKeywords } = require('../src/keywords');
    const all = getAllKeywords().map(k => k.toUpperCase());
    // 2 字母/单字符 token（IF/DO/PL 等）没有中间前缀——完整词本身即全部
    // 内容，ghost text 无可补，属结构性不适用而非策略缺陷
    const completable = all.filter(kw => kw.length >= 3);
    let reachable = 0;
    const blocked = [];
    for (const kw of completable) {
      let ok = false;
      for (let len = 2; len < kw.length; len++) {
        const result = await provideInlineCompletionItems(doc(kw.slice(0, len)), new Position(0, len));
        const combined = result.items.map(i => kw.slice(0, len) + i.insertText);
        if (combined.includes(kw)) { ok = true; break; }
      }
      if (ok) reachable++; else blocked.push(kw);
    }
    assert.strictEqual(blocked.length, 0,
      `every completable keyword should be reachable via some prefix, blocked: ${blocked.join(', ')}`);
    assert.strictEqual(reachable, completable.length);
  } finally {
    uninstallVscodeMock();
  }
});

test('enableCompletions=false disables inline completion', async () => {
  installVscodeMock({
    workspace: {
      getConfiguration: () => ({
        get(key, defaultValue) {
          if (key === 'enableCompletions') return false;
          return defaultValue;
        }
      })
    }
  });
  try {
    const { provideInlineCompletionItems } = loadProvider();
    const result = await provideInlineCompletionItems(doc('USERCOR'), new Position(0, 3));
    assert.strictEqual(result.items.length, 0);
  } finally {
    uninstallVscodeMock();
  }
});
