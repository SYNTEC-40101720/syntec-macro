// extension.test.js
// 用法: node --test tests/extension.test.js
// 测试覆盖: 关键字、函数索引、G/M代码、机器人指令、PAUSE、SLEEP

const { test } = require('node:test');
const assert = require('node:assert');

// ===== v2.6.0 新增测试 =====

test('Robot instructions exist in getAllKeywords', () => {
  const { getAllKeywords } = require('../src/keywords');
  const allKw = getAllKeywords();
  const robotInstructions = ['MOVJ', 'MOVL', 'MOVC', 'INCMOVJ', 'INCMOVL',
    'USERCOR', 'OBJCORON', 'TOOLCOR', 'SKIPCOND', 'SWAITSIG',
    'SYNCOUT', 'WEAVEON', 'STITCHON', 'POSEMAP', 'SHIFTON', 'PAUSE',
    'ACC', 'DEC', 'FJ', 'FEJ', 'FL', 'FR', 'PL', 'PQ', 'PR'];
  for (const instr of robotInstructions) {
    assert.ok(allKw.includes(instr), `Robot instruction ${instr} should be in keywords`);
  }
});

test('GETPR and SETPR exist in function index', () => {
  const { buildFunctionIndex } = require('../src/functions');
  const index = buildFunctionIndex();
  assert.ok(index.has('GETPR'), 'GETPR should be in function index');
  assert.ok(index.has('SETPR'), 'SETPR should be in function index');
  const getpr = index.get('GETPR');
  assert.ok(getpr.sig.includes('GETPR'), 'GETPR sig should contain function name');
  const setpr = index.get('SETPR');
  assert.ok(setpr.sig.includes('SETPR'), 'SETPR sig should contain function name');
});

test('New G codes exist in gcodes array', () => {
  const { keywords } = require('../src/keywords');
  const gcodes = keywords.gcodes;
  assert.ok(gcodes.includes('G04.102'), 'G04.102 should be in gcodes');
  assert.ok(gcodes.includes('G68.18'), 'G68.18 should be in gcodes');
  assert.ok(gcodes.includes('G192.1'), 'G192.1 should be in gcodes');
  assert.ok(gcodes.includes('G192.2'), 'G192.2 should be in gcodes');
});

test('M198 exists in mcodes array', () => {
  const { keywords } = require('../src/keywords');
  assert.ok(keywords.mcodes.includes('M198'), 'M198 should be in mcodes');
});

test('PAUSE exists in flow keywords', () => {
  const { keywords } = require('../src/keywords');
  assert.ok(keywords.flow.includes('PAUSE'), 'PAUSE should be in flow keywords');
});

test('Deprecated short closers are not suggested', () => {
  const { getAllKeywords, getKeywordDoc } = require('../src/keywords');
  const allKw = getAllKeywords();
  for (const keyword of ['ENDIF', 'ENDFOR', 'ENDWHILE', 'ENDCASE', 'ENDREPEAT']) {
    assert.ok(!allKw.includes(keyword), `${keyword} should not be suggested`);
    assert.strictEqual(getKeywordDoc(keyword), null, `${keyword} should not have hover docs`);
  }
  assert.ok(!getKeywordDoc('END_IF').doc.includes('ENDIF'), 'END_IF docs should not mention ENDIF');
});

test('SLEEP takes no parameters', () => {
  const { functions } = require('../src/functions');
  const sleep = functions.find(f => f.name === 'SLEEP');
  assert.ok(sleep, 'SLEEP function should exist');
  assert.strictEqual(sleep.sig, 'SLEEP()', 'SLEEP should have no parameters');
});

test('Snippets match function definitions (no stale parameters)', () => {
  const snippets = require('../snippets/syntec-macro.json');
  const byPrefix = {};
  for (const val of Object.values(snippets)) {
    byPrefix[val.prefix] = val;
  }
  // SLEEP/WAIT/CLOSE: parameterless
  assert.strictEqual(byPrefix.sleep.body[0], 'SLEEP();', 'SLEEP snippet should be parameterless');
  assert.strictEqual(byPrefix.wait.body[0], 'WAIT();', 'WAIT snippet should be parameterless');
  assert.strictEqual(byPrefix.close.body[0], 'CLOSE();', 'CLOSE snippet should be parameterless');
  assert.strictEqual(byPrefix.msg.body[0], 'MSG("${1:提示信息}")', 'MSG snippet should not insert a leading space');
  assert.ok(byPrefix.for.body[0].includes(' := '), 'FOR snippet should use recommended := assignment');
  // OPEN: path-based API, not file-handle
  assert.strictEqual(byPrefix.open.body[0], 'OPEN("${1:文件路径}")', 'OPEN snippet should use valid overwrite syntax');
  assert.strictEqual(byPrefix.opena.body[0], 'OPEN("${1:文件路径}", "a")', 'OPEN append snippet should use valid append syntax');
  // READABIT: single arg, no 位号
  assert.ok(!byPrefix.readabit.body[0].includes('位号'), 'READABIT should have single arg');
  // SETABIT: two args, no 位号
  assert.ok(!byPrefix.setabit.body[0].includes('位号'), 'SETABIT should not have three args');
});

test('Grammar highlights documented operators and variable forms', () => {
  const grammar = require('../syntaxes/syntec-macro.tmLanguage.json');
  const patternByName = Object.fromEntries(
    grammar.patterns.filter(p => p.match && p.name).map(p => [p.name, p.match])
  );

  assert.match('&', new RegExp(patternByName['keyword.operator.logical.syntec-macro']));
  assert.match('MOD', new RegExp(patternByName['keyword.operator.arithmetic.syntec-macro']));
  assert.match('DIV', new RegExp(patternByName['keyword.operator.arithmetic.syntec-macro']));
  assert.match('=', new RegExp(patternByName['keyword.operator.comparison.syntec-macro']));
  assert.match('==', new RegExp(patternByName['keyword.operator.comparison.syntec-macro']));
  assert.match('#123', new RegExp(patternByName['variable.language.local.syntec-macro']));
  assert.match('#[10+#3]', new RegExp(patternByName['variable.language.local.syntec-macro']));
  assert.doesNotMatch('#TEMP', new RegExp(patternByName['variable.language.local.syntec-macro']));
  assert.match('@123', new RegExp(patternByName['variable.language.global.syntec-macro']));
  assert.doesNotMatch('@TEMP', new RegExp(patternByName['variable.language.global.syntec-macro']));
  assert.match('M#4', new RegExp(patternByName['entity.name.function.mcode.dynamic.syntec-macro']));
  assert.match('AR[#3]', new RegExp(patternByName['variable.language.app.syntec-macro']));
  assert.match('MAR[#3]', new RegExp(patternByName['variable.language.app.syntec-macro']));
  assert.match('$1', new RegExp(patternByName['variable.language.axis-group.syntec-macro']));
  assert.match('$4', new RegExp(patternByName['variable.language.axis-group.syntec-macro']));
});
