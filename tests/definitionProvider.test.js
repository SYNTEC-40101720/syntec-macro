// tests/definitionProvider.test.js
// Phase 3 Step 4：definitionProvider 独立单测。覆盖 provideDefinition 的
// 单文档内 GOTO N-标签跳转路径（不需要 mock 文件系统的 workspace 查找路径）；
// G65/M98 宏程序文件跳转需真实 workspace fs，暂以「cursor 不在调用词上时返回空」
// 与「GOTO 跳转命中多个 N 标签」覆盖核心行为。

const assert = require('node:assert');
const { test } = require('node:test');
const {
  installVscodeMock,
  uninstallVscodeMock,
  Position,
  Location
} = require('./helpers/vscodeMock');
const { createDocumentSnapshot } = require('./helpers/documentMock');

function loadDefinitionProvider() {
  delete require.cache[require.resolve('../src/providerShared')];
  delete require.cache[require.resolve('../src/definitionProvider')];
  return require('../src/definitionProvider');
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

test('provideDefinition returns N-label location for GOTO 100', withVscodeMock(() => {
  const { provideDefinition } = loadDefinitionProvider();
  const text = 'GOTO 100;\nN100; MSG("start");\n';
  const doc = createDocumentSnapshot(text, { uri: 'file:///test.nc' });
  // cursor 在 "100" 上 (GOTO 后的数字)
  const targets = provideDefinition(doc, new Position(0, 6));
  assert.ok(Array.isArray(targets));
  assert.strictEqual(targets.length, 1);
  const target = targets[0];
  assert.ok(target instanceof Location);
  assert.strictEqual(target.uri.scheme, 'file');
  // N100 在第 1 行（0-indexed），labelStart 字符位置 0
  assert.strictEqual(target.range.start.line, 1);
  assert.strictEqual(target.range.start.character, 0);
  assert.strictEqual(target.range.end.character, 4); // "N100" 长度
}));

test('provideDefinition returns multiple locations when duplicate N-labels exist', withVscodeMock(() => {
  const { provideDefinition } = loadDefinitionProvider();
  const text = 'GOTO 50;\nN50; first;\nN50; second;\n';
  const doc = createDocumentSnapshot(text, { uri: 'file:///test.nc' });
  const targets = provideDefinition(doc, new Position(0, 6));
  assert.ok(Array.isArray(targets));
  assert.strictEqual(targets.length, 2);
  assert.strictEqual(targets[0].range.start.line, 1);
  assert.strictEqual(targets[1].range.start.line, 2);
}));

test('provideDefinition returns empty array when cursor not on GOTO/G65/M98 target', withVscodeMock(() => {
  const { provideDefinition } = loadDefinitionProvider();
  const text = '#1 := 1;\n';
  const doc = createDocumentSnapshot(text, { uri: 'file:///test.nc' });
  // cursor 在 #1 的 '1' 上，不匹配任何调用语法
  const targets = provideDefinition(doc, new Position(0, 2));
  assert.deepStrictEqual(targets, []);
}));

test('provideDefinition returns empty array when GOTO target label does not exist', withVscodeMock(() => {
  const { provideDefinition } = loadDefinitionProvider();
  const text = 'GOTO 999;\nM99;\n';
  const doc = createDocumentSnapshot(text, { uri: 'file:///test.nc' });
  const targets = provideDefinition(doc, new Position(0, 6));
  assert.deepStrictEqual(targets, []);
}));

test('provideDefinition cursor must be on GOTO target number, not on GOTO itself', withVscodeMock(() => {
  const { provideDefinition } = loadDefinitionProvider();
  const text = 'GOTO 100;\nN100;\n';
  const doc = createDocumentSnapshot(text, { uri: 'file:///test.nc' });
  // cursor 在 GOTO 内部（不在 100 数字上）：position 严格在 'GOT' 区间，未覆盖数字
  const targets = provideDefinition(doc, new Position(0, 2));
  assert.deepStrictEqual(targets, []);
}));
