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
    'WAITSYNC', 'ENDSYNC', 'CIRMODE',
    'ACC', 'DEC', 'FJ', 'FEJ', 'FL', 'FR', 'PL', 'PQ', 'PR'];
  for (const instr of robotInstructions) {
    assert.ok(allKw.includes(instr), `Robot instruction ${instr} should be in keywords`);
  }
  assert.ok(!allKw.includes('TOOLCORON'), 'TOOLCORON should not be suggested');
});

test('MOVJ second syntax is documented without MOVJ-II keyword', () => {
  const { getAllKeywords, getKeywordDoc } = require('../src/keywords');
  assert.ok(!getAllKeywords().includes('MOVJ-II'), 'MOVJ-II should not be a standalone keyword');
  assert.strictEqual(getKeywordDoc('MOVJ-II'), null, 'MOVJ-II should not have hover docs');
  const doc = getKeywordDoc('MOVJ');
  assert.ok(doc.sig.includes('MOVJ X...'), 'MOVJ docs should include second syntax without equals on X');
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
  assert.ok(gcodes.includes('G04.101'), 'G04.101 should be in gcodes');
  assert.ok(gcodes.includes('G04.103'), 'G04.103 should be in gcodes');
  assert.ok(gcodes.includes('G11.103'), 'G11.103 should be in gcodes');
  assert.ok(gcodes.includes('G53.101'), 'G53.101 should be in gcodes');
  assert.ok(gcodes.includes('G53.102'), 'G53.102 should be in gcodes');
  assert.ok(gcodes.includes('G43.16'), 'G43.16 should be in gcodes');
  assert.ok(gcodes.includes('G68.18'), 'G68.18 should be in gcodes');
  assert.ok(gcodes.includes('G142.101'), 'G142.101 should be in gcodes');
  assert.ok(gcodes.includes('G142.102'), 'G142.102 should be in gcodes');
  assert.ok(gcodes.includes('G192.1'), 'G192.1 should be in gcodes');
  assert.ok(gcodes.includes('G192.2'), 'G192.2 should be in gcodes');
});

test('New robot application keywords have hover docs', () => {
  const { getKeywordDoc } = require('../src/keywords');
  for (const keyword of ['WAITSYNC', 'ENDSYNC', 'CIRMODE']) {
    const doc = getKeywordDoc(keyword);
    assert.ok(doc, `${keyword} should have hover docs`);
    assert.ok(doc.sig.includes(keyword), `${keyword} sig should contain keyword`);
  }
});

test('Language associations include common machining extensions', () => {
  const packageJson = require('../package.json');
  const language = packageJson.contributes.languages.find(lang => lang.id === 'syntec-macro');
  for (const ext of ['.nc', '.cnc', '.tap', '.prt', '.mpf', '.ptp', '.pim', '.anc', '.bj', '.edit', '.demo']) {
    assert.ok(language.extensions.includes(ext), `${ext} should be associated with syntec-macro`);
  }
  for (const ext of ['.macro', '.scp', '.G', '.txt']) {
    assert.ok(!language.extensions.includes(ext), `${ext} should not be globally associated`);
  }
  assert.ok(!language.extensions.includes('.txt'), '.txt should not be globally associated');
});

test('Configuration contribution exposes documented setting keys', () => {
  const packageJson = require('../package.json');
  const properties = packageJson.contributes.configuration.properties;
  for (const key of ['syntecMacro.enableDiagnostics', 'syntecMacro.enableCompletions', 'syntecMacro.enableHover', 'syntecMacro.includePath']) {
    assert.ok(properties[key], `${key} should be contributed as a setting`);
  }
  assert.strictEqual(properties.syntecMacro, undefined, 'syntecMacro should not be contributed as a nested object setting');
});

test('Macro file candidates prefer extensionless file then known macro suffixes', () => {
  const { buildFileCandidates } = require('../src/fileResolver');
  const candidates = buildFileCandidates('C:\\MACRO', 'G0200');
  assert.strictEqual(candidates[0], 'C:\\MACRO\\G0200');
  assert.ok(candidates.includes('C:\\MACRO\\G0200.nc'));
  assert.ok(candidates.includes('C:\\MACRO\\G0200.cnc'));
  assert.ok(candidates.includes('C:\\MACRO\\G0200.demo'));
  assert.ok(!candidates.includes('C:\\MACRO\\G0200.macro'));
  assert.ok(!candidates.includes('C:\\MACRO\\G0200.scp'));
  assert.ok(!candidates.includes('C:\\MACRO\\G0200.G'));
  assert.ok(!candidates.includes('C:\\MACRO\\G0200.txt'));
});

test('Program name normalization supports G macros and O subprograms', () => {
  const { normalizeProgramName, normalizeSubprogramName } = require('../src/fileResolver');
  assert.strictEqual(normalizeProgramName('200'), 'G0200');
  assert.strictEqual(normalizeProgramName('G200'), 'G0200');
  assert.strictEqual(normalizeSubprogramName('200'), 'O0200');
  assert.strictEqual(normalizeSubprogramName('O200'), 'O0200');
});

test('M198 exists in mcodes array', () => {
  const { keywords } = require('../src/keywords');
  assert.ok(keywords.mcodes.includes('M198'), 'M198 should be in mcodes');
});

test('G and M code hover docs include signatures and descriptions', () => {
  const { getCodeDoc } = require('../src/codeDocs');
  const g65 = getCodeDoc('G65');
  assert.ok(g65.sig.includes('G65'), 'G65 hover doc should include signature');
  assert.ok(g65.doc.includes('非模态宏程序呼叫'), 'G65 hover doc should describe macro call');

  const m98 = getCodeDoc('M98');
  assert.ok(m98.sig.includes('M98'), 'M98 hover doc should include signature');
  assert.ok(m98.doc.includes('O 副程序'), 'M98 hover doc should describe O subprogram call');
});

test('G10 L1803 and L1805 have detailed hover docs', () => {
  const { getG10LCodeDoc } = require('../src/codeDocs');
  const l1803 = getG10LCodeDoc('L1803');
  assert.ok(l1803.sig.includes('G10 L1803 I_ Q_ P_ R_'), 'L1803 signature should include required arguments');
  assert.ok(l1803.doc.includes('运动单节内'), 'L1803 docs should describe in-motion triggering');
  assert.ok(l1803.doc.includes('G31'), 'L1803 docs should mention supported G31 version notes');

  const l1805 = getG10LCodeDoc('l1805');
  assert.ok(l1805.sig.includes('G10 L1805 I_ Q_ R_'), 'L1805 signature should include required arguments');
  assert.ok(l1805.doc.includes('单节间'), 'L1805 docs should describe between-block triggering');
  assert.ok(l1805.doc.includes('G10 L1801'), 'L1805 docs should mention related cancel command');
});

test('G10 communication L codes have detailed hover docs', () => {
  const { getG10LCodeDoc } = require('../src/codeDocs');
  const expected = [
    ['L1021', 'EtherNet/IP', 'COR-350'],
    ['L1022', 'EtherCAT', 'COR-146'],
    ['L1900', 'Modbus-TCP', 'COR-356'],
    ['L1901', '自定义封包', 'COR-358'],
    ['L1910', 'Modbus-RS485', 'Pr3950'],
    ['L1911', 'Modbus-RS485', 'R5040']
  ];
  for (const [lCode, docText, errorText] of expected) {
    const doc = getG10LCodeDoc(lCode);
    assert.ok(doc, `${lCode} should have hover docs`);
    assert.ok(doc.sig.includes(`G10 ${lCode}`), `${lCode} signature should include code`);
    assert.ok(doc.doc.includes(docText), `${lCode} docs should mention ${docText}`);
    assert.ok(doc.doc.includes(errorText), `${lCode} docs should mention ${errorText}`);
  }
});

test('G10 register and signal wait L codes have detailed hover docs', () => {
  const { getG10LCodeDoc } = require('../src/codeDocs');
  const expected = [
    ['L1000', 'R 寄存器写入', 'Pr3241'],
    ['L1810', '讯号等待', 'COR-335'],
    ['L1820', 'COR-338', '10.118.19']
  ];
  for (const [lCode, docText, extraText] of expected) {
    const doc = getG10LCodeDoc(lCode);
    assert.ok(doc, `${lCode} should have hover docs`);
    assert.ok(doc.sig.includes(`G10 ${lCode}`), `${lCode} signature should include code`);
    assert.ok(doc.doc.includes(docText), `${lCode} docs should mention ${docText}`);
    assert.ok(doc.doc.includes(extraText), `${lCode} docs should mention ${extraText}`);
  }
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

test('Symbol operators have keyword documentation for hover', () => {
  const { getAllKeywords, getKeywordDoc } = require('../src/keywords');
  assert.ok(getAllKeywords().includes('&'), '& should be in keywords');
  for (const operator of [':=', '=', '<>', '<', '>', '<=', '>=', '+', '-', '*', '/', '&']) {
    const doc = getKeywordDoc(operator);
    assert.ok(doc, `${operator} should have hover docs`);
  }
  assert.ok(getKeywordDoc('&').doc.includes('AND'), '& docs should mention AND equivalence');
  assert.ok(getKeywordDoc('/').doc.includes('整数'), '/ docs should mention integer division');
});

test('SLEEP takes no parameters', () => {
  const { functions } = require('../src/functions');
  const sleep = functions.find(f => f.name === 'SLEEP');
  assert.ok(sleep, 'SLEEP function should exist');
  assert.strictEqual(sleep.sig, 'SLEEP()', 'SLEEP should have no parameters');
});

test('Function completion snippets match function signatures', () => {
  const { buildFunctionSnippet } = require('../src/completionSnippets');
  assert.strictEqual(buildFunctionSnippet({ name: 'ABS', sig: 'ABS(num)' }), 'ABS(${1})');
  assert.strictEqual(buildFunctionSnippet({ name: 'SLEEP', sig: 'SLEEP()' }), 'SLEEP()');
  assert.strictEqual(buildFunctionSnippet({ name: 'WAIT', sig: 'WAIT()' }), 'WAIT()');
  assert.strictEqual(buildFunctionSnippet({ name: 'STKTOP', sig: 'STKTOP[index]' }), 'STKTOP[${1}]');
});

test('Formatter adjusts indentation without rewriting statements', () => {
  const { formatSyntecMacroDocument } = require('../src/formatter');
  const input = '%@MACRO\nIF #1 = 1 THEN   \n#2 := ABS(-1);\nELSE\n#2 := 0;\nEND_IF;';
  const expected = '%@MACRO\nIF #1 = 1 THEN\n    #2 := ABS(-1);\nELSE\n    #2 := 0;\nEND_IF;';
  assert.strictEqual(formatSyntecMacroDocument(input, { insertSpaces: true, tabSize: 4 }), expected);
});

test('Formatter ignores keywords inside comments and strings', () => {
  const { formatSyntecMacroDocument } = require('../src/formatter');
  const input = '%@MACRO\nMSG("END_IF")\n// IF #1 THEN\n#1 := 1;';
  assert.strictEqual(formatSyntecMacroDocument(input, { insertSpaces: true, tabSize: 4 }), input);
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
  assert.ok(byPrefix.g10l1803.body[0].includes('G10 L1803'), 'G10 L1803 snippet should exist');
  assert.ok(byPrefix.g10l1805.body[0].includes('G10 L1805'), 'G10 L1805 snippet should exist');
  for (const prefix of ['g10l1000', 'g10l1810', 'g10l1820', 'g10l1021', 'g10l1022r', 'g10l1022w', 'g10l1900r', 'g10l1900w', 'g10l1901', 'g10l1910r', 'g10l1910w', 'g10l1911']) {
    assert.ok(byPrefix[prefix], `${prefix} snippet should exist`);
  }
});

test('Grammar highlights documented operators and variable forms', () => {
  const grammar = require('../syntaxes/syntec-macro.tmLanguage.json');
  const patternByName = Object.fromEntries(
    grammar.patterns.filter(p => p.match && p.name).map(p => [p.name, p.match])
  );

  assert.match('&', new RegExp(patternByName['keyword.operator.logical.syntec-macro']));
  assert.doesNotMatch('NOT', new RegExp(patternByName['keyword.operator.logical.syntec-macro']));
  assert.match('NOT', new RegExp(patternByName['keyword.operator.bitwise.syntec-macro']));
  assert.match('MOD', new RegExp(patternByName['keyword.operator.arithmetic.syntec-macro']));
  assert.doesNotMatch('DIV', new RegExp(patternByName['keyword.operator.arithmetic.syntec-macro']));
  assert.match('=', new RegExp(patternByName['keyword.operator.comparison.syntec-macro']));
  assert.doesNotMatch('==', new RegExp(patternByName['keyword.operator.comparison.syntec-macro']));
  assert.match('#123', new RegExp(patternByName['variable.language.local.syntec-macro']));
  assert.match('#[10+#3]', new RegExp(patternByName['variable.language.local.syntec-macro']));
  assert.doesNotMatch('#TEMP', new RegExp(patternByName['variable.language.local.syntec-macro']));
  assert.match('@123', new RegExp(patternByName['variable.language.global.syntec-macro']));
  assert.doesNotMatch('@TEMP', new RegExp(patternByName['variable.language.global.syntec-macro']));
  assert.match('0xFFFF', new RegExp(patternByName['constant.numeric.hex.syntec-macro']));
  assert.match('M#4', new RegExp(patternByName['entity.name.function.mcode.dynamic.syntec-macro']));
  assert.match('AR[#3]', new RegExp(patternByName['variable.language.app.syntec-macro']));
  assert.match('MAR[#3]', new RegExp(patternByName['variable.language.app.syntec-macro']));
  assert.match('WAITSYNC', new RegExp(patternByName['keyword.control.robot-app.syntec-macro']));
  assert.match('CIRMODE', new RegExp(patternByName['keyword.control.robot-app.syntec-macro']));
  assert.match('$1', new RegExp(patternByName['variable.language.axis-group.syntec-macro']));
  assert.match('$4', new RegExp(patternByName['variable.language.axis-group.syntec-macro']));
  assert.doesNotMatch('MOVJ-II', new RegExp(patternByName['keyword.control.robot-move.syntec-macro']));
  assert.doesNotMatch('TOOLCORON', new RegExp(patternByName['keyword.control.robot-coord.syntec-macro']));
});
