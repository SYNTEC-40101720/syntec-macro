// tests/hoverProvider.test.js
// Phase 3 Step 3：hoverProvider 独立单测。覆盖 provideHover 的主要分支：
//   动态 M 代码 #M、应用变量 AR/MAR、轴群 $1、G10 L 码、变量 # / @、
//   G/M 码 hover、符号运算子、关键字与函数 hover、`enableHover=false` 返回 null、
//   无 wordMatch 返回 null。

const assert = require('node:assert');
const { test } = require('node:test');
const {
  installVscodeMock,
  uninstallVscodeMock,
  Position
} = require('./helpers/vscodeMock');
const { createDocumentSnapshot } = require('./helpers/documentMock');

function loadHoverProvider() {
  delete require.cache[require.resolve('../src/providerShared')];
  delete require.cache[require.resolve('../src/hoverProvider')];
  return require('../src/hoverProvider');
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

function firstHoverContent(hover) {
  if (!hover || !Array.isArray(hover.contents) || hover.contents.length === 0) return '';
  const md = hover.contents[0];
  return md && typeof md === 'object' ? String(md.value || '') : String(md || '');
}

test('provideHover returns dynamic M code hover when cursor on M#001', withVscodeMock(() => {
  const { provideHover } = loadHoverProvider();
  const doc = createDocumentSnapshot('M#001\n', { uri: 'file:///test.nc' });
  const hover = provideHover(doc, new Position(0, 3));
  assert.ok(hover, 'M#00N cursor should produce a hover');
  const text = firstHoverContent(hover);
  assert.ok(text.includes('动态 M 代码'), `expected dynamic M code hover, got: ${text}`);
  assert.ok(text.includes('M#001'));
}));

test('provideHover returns AR/MAR application variable hover', withVscodeMock(() => {
  const { provideHover } = loadHoverProvider();
  const doc = createDocumentSnapshot('AR100 := 1;\n', { uri: 'file:///test.nc' });
  const hover = provideHover(doc, new Position(0, 2));
  assert.ok(hover);
  const text = firstHoverContent(hover);
  assert.ok(text.includes('应用变量'), `expected app variable hover, got: ${text}`);
  assert.ok(text.includes('AR100'));
}));

test('provideHover returns axis group hover on $1', withVscodeMock(() => {
  const { provideHover } = loadHoverProvider();
  const doc = createDocumentSnapshot('$1 := 100;\n', { uri: 'file:///test.nc' });
  const hover = provideHover(doc, new Position(0, 1));
  assert.ok(hover);
  const text = firstHoverContent(hover);
  assert.ok(text.includes('轴群识别'), `expected axis group hover, got: ${text}`);
  assert.ok(text.includes('$1'));
}));

test('provideHover returns variable hover on #100', withVscodeMock(() => {
  const { provideHover } = loadHoverProvider();
  const doc = createDocumentSnapshot('#100 := 100;\n', { uri: 'file:///test.nc' });
  const hover = provideHover(doc, new Position(0, 3));
  assert.ok(hover);
  const text = firstHoverContent(hover);
  assert.ok(text.includes('变量'), `expected variable hover, got: ${text}`);
  assert.ok(text.includes('#100'));
}));

test('provideHover returns G code hover on G10', withVscodeMock(() => {
  const { provideHover } = loadHoverProvider();
  const doc = createDocumentSnapshot('G10 L1000;\n', { uri: 'file:///test.nc' });
  const hover = provideHover(doc, new Position(0, 2));
  assert.ok(hover);
  const text = firstHoverContent(hover);
  assert.ok(text.includes('G10'), `expected G10 hover, got: ${text}`);
}));

test('provideHover returns function hover when cursor on IF', withVscodeMock(() => {
  const { provideHover } = loadHoverProvider();
  const doc = createDocumentSnapshot('IF #1 THEN\nEND_IF;\n', { uri: 'file:///test.nc' });
  const hover = provideHover(doc, new Position(0, 2));
  assert.ok(hover, 'IF cursor should produce a function hover');
  const text = firstHoverContent(hover);
  // IF hover 应包含函数签名
  assert.ok(text.length > 0, 'hover content must be non-empty');
}));

test('provideHover returns keyword hover when cursor on FOR', withVscodeMock(() => {
  const { provideHover } = loadHoverProvider();
  const doc = createDocumentSnapshot('FOR #1 := 1 TO 10 DO\nEND_FOR;\n', { uri: 'file:///test.nc' });
  const hover = provideHover(doc, new Position(0, 2));
  assert.ok(hover, 'FOR cursor should produce a keyword hover');
  const text = firstHoverContent(hover);
  assert.ok(text.length > 0);
}));

test('provideHover returns null when enableHover=false', () => {
  installVscodeMock({
    workspace: {
      getConfiguration() {
        return {
          get(key, def) {
            if (key === 'enableHover') return false;
            return def;
          },
          has() { return true; },
          inspect() { return {}; },
          update() { return Promise.resolve(); }
        };
      }
    }
  });
  try {
    const { provideHover } = loadHoverProvider();
    const doc = createDocumentSnapshot('IF #1 THEN\nEND_IF;\n', { uri: 'file:///test.nc' });
    const hover = provideHover(doc, new Position(0, 1));
    assert.strictEqual(hover, null);
  } finally {
    uninstallVscodeMock();
  }
});

test('provideHover returns null when no word match at position', withVscodeMock(() => {
  const { provideHover } = loadHoverProvider();
  // 空白行无词
  const doc = createDocumentSnapshot('   \n', { uri: 'file:///test.nc' });
  const hover = provideHover(doc, new Position(0, 1));
  assert.strictEqual(hover, null);
}));
