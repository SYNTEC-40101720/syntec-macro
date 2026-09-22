// extension.test.js
// 用法: node --test tests/extension.test.js
// 测试覆盖: 关键字、函数索引、G/M代码、机器人指令、PAUSE、SLEEP

const { test } = require('node:test');
const assert = require('node:assert');
test('Generated diagnostic documentation matches the committed file', () => {
  const fs = require('fs');
  const path = require('path');
  const {
    isDiagnosticDocsCurrent,
    renderDiagnosticDocs
  } = require('../scripts/generateDiagnosticDocs');
  const documentation = fs.readFileSync(path.join(__dirname, '..', 'docs', '诊断规则与修复动作.md'), 'utf8');
  assert.strictEqual(documentation, renderDiagnosticDocs());
  assert.strictEqual(isDiagnosticDocsCurrent(documentation), true);
  assert.strictEqual(isDiagnosticDocsCurrent(documentation + '\n<!-- stale -->'), false);
});
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
  // 严格 sig 断言，防止签名被误改导致补全/悬停文档静默回归
  assert.strictEqual(index.get('GETPR').sig, 'GETPR(prNo)', 'GETPR sig must match exactly');
  assert.strictEqual(index.get('SETPR').sig, 'SETPR(prNo, val)', 'SETPR sig must match exactly');
});

test('Critical function signatures are stable', () => {
  const { buildFunctionIndex } = require('../src/functions');
  const index = buildFunctionIndex();
  // 关键函数签名回归测试：防止 sig 被误改导致补全/悬停文档静默回归
  const expectedSigs = {
    'WAIT': 'WAIT()',
    'OPEN': 'OPEN("path"[, "mode"])',
    'CLOSE': 'CLOSE()',
    'READABIT': 'READABIT(portNo)',
    'SETABIT': 'SETABIT(portNo, val)'
  };
  for (const [name, expectedSig] of Object.entries(expectedSigs)) {
    const fn = index.get(name);
    assert.ok(fn, `${name} should exist in function index`);
    assert.strictEqual(fn.sig, expectedSig, `${name} sig must match exactly`);
  }
});

test('WAIT and MSG function docs include runtime caveats', () => {
  const { buildFunctionIndex } = require('../src/functions');
  const index = buildFunctionIndex();
  assert.ok(index.get('WAIT').doc.includes('M98/M99/M198'), 'WAIT docs should describe subprogram call exception');
  assert.ok(index.get('MSG').doc.includes('程序结束时自动消失'), 'MSG docs should describe its lifecycle');
  assert.ok(index.get('MSG').doc.includes('65535'), 'MSG docs should describe default ID version boundary');
});

test('GETARG and GETTRAPARG function docs distinguish argument sources', () => {
  const { buildFunctionIndex } = require('../src/functions');
  const index = buildFunctionIndex();
  assert.ok(index.get('GETARG').doc.includes('标准或扩充引数'), 'GETARG docs should describe standard and extended arguments');
  assert.ok(index.get('GETARG').doc.includes('VACANT (#0)'), 'GETARG docs should describe missing arguments');
  assert.ok(index.get('GETTRAPARG').doc.includes('Trap 单节'), 'GETTRAPARG docs should describe trap-block arguments');
  assert.ok(index.get('GETTRAPARG').doc.includes('不同于 GETARG'), 'GETTRAPARG docs should distinguish caller arguments');
});

test('DRVDATA function docs include documented static formats', () => {
  const { buildFunctionIndex } = require('../src/functions');
  const doc = buildFunctionIndex().get('DRVDATA').doc;
  assert.ok(doc.includes('stationNo 必须为整数'), 'DRVDATA docs should describe station number format');
  assert.ok(doc.includes('"xxxh"'), 'DRVDATA docs should describe hexadecimal string format');
  assert.ok(doc.includes('小写 h'), 'DRVDATA docs should describe lowercase h suffix');
});

test('ATAN2 function docs use correct quadrant examples', () => {
  const { buildFunctionIndex } = require('../src/functions');
  const doc = buildFunctionIndex().get('ATAN2').doc;
  assert.ok(doc.includes('ATAN2(1,-1) -> 135'), 'ATAN2 docs should use the second-quadrant example');
  assert.ok(doc.includes('ATAN2(1,0) -> 90'), 'ATAN2 docs should document the positive y axis');
  assert.ok(doc.includes('不可同时为 0'), 'ATAN2 docs should describe the zero-pair domain error');
});

test('ACOS and ASIN function docs describe documented domain limits', () => {
  const { buildFunctionIndex } = require('../src/functions');
  const index = buildFunctionIndex();
  for (const name of ['ACOS', 'ASIN']) {
    const doc = index.get(name).doc;
    assert.ok(doc.includes('-1~1'), `${name} docs should describe the inclusive domain`);
    assert.ok(doc.includes('RS-008'), `${name} docs should describe the domain error`);
  }
});

test('MAX, MIN, SIGN, and RANDOM function docs describe documented results', () => {
  const { buildFunctionIndex } = require('../src/functions');
  const index = buildFunctionIndex();
  assert.ok(index.get('MAX').doc.includes('两输入值的最大值'), 'MAX docs should describe the selected result');
  assert.ok(index.get('MIN').doc.includes('两输入值的最小值'), 'MIN docs should describe the selected result');
  assert.ok(index.get('SIGN').doc.includes('-1/0/1'), 'SIGN docs should describe all possible sign results');
  assert.ok(index.get('RANDOM').doc.includes('0~32767'), 'RANDOM docs should describe the documented result range');
});

test('CEIL, FLOOR, and ROUND function docs describe documented rounding behavior', () => {
  const { buildFunctionIndex } = require('../src/functions');
  const index = buildFunctionIndex();
  assert.ok(index.get('CEIL').doc.includes('返回>=该值的最小整数'), 'CEIL docs should describe upward rounding');
  assert.ok(index.get('FLOOR').doc.includes('返回<=该值的最大整数'), 'FLOOR docs should describe downward rounding');
  assert.ok(index.get('ROUND').doc.includes('ROUND(1.5) -> 2'), 'ROUND docs should describe half-up rounding');
});

test('base math function docs describe documented semantics', () => {
  const { buildFunctionIndex } = require('../src/functions');
  const index = buildFunctionIndex();
  assert.ok(index.get('ABS').doc.includes('取绝对值'), 'ABS docs should describe absolute value');
  assert.ok(index.get('SIN').doc.includes('SIN(90) -> 1'), 'SIN docs should describe degree input');
  assert.ok(index.get('COS').doc.includes('COS(180) -> -1'), 'COS docs should describe degree input');
  assert.ok(index.get('TAN').doc.includes('TAN(45) -> 1'), 'TAN docs should describe degree input');
  assert.ok(index.get('ATAN').doc.includes('±90°'), 'ATAN docs should describe its output range');
  assert.ok(index.get('EXP').doc.includes('以自然数 e 为底'), 'EXP docs should describe its natural base');
});

test('LN and POW function docs include documented domain alarms', () => {
  const { buildFunctionIndex } = require('../src/functions');
  const index = buildFunctionIndex();
  assert.ok(index.get('LN').doc.includes('RS-008'), 'LN docs should describe its domain alarm');
  assert.ok(index.get('LN').doc.includes('引数需为正数'), 'LN docs should describe its positive domain');
  assert.ok(index.get('POW').doc.includes('COR-122'), 'POW docs should describe its documented alarm');
  assert.ok(index.get('POW').doc.includes('基底不可为负值'), 'POW docs should describe its non-negative base domain');
});

test('SETDRAW and DRAWHOLE function docs describe documented simulation state', () => {
  const { buildFunctionIndex } = require('../src/functions');
  const index = buildFunctionIndex();
  assert.ok(index.get('SETDRAW').doc.includes('BGR码'), 'SETDRAW docs should describe BGR color encoding');
  assert.ok(index.get('SETDRAW').doc.includes('恢复路径颜色'), 'SETDRAW docs should describe restoring the path color');
  assert.ok(index.get('DRAWHOLE').doc.includes('仅图形模拟内有效'), 'DRAWHOLE docs should describe its simulation-only scope');
  assert.ok(index.get('DRAWHOLE').doc.includes('当前 SETDRAW'), 'DRAWHOLE docs should describe its current draw-state dependency');
});

test('STR2INT and SCANTEXT function docs describe string conversion behavior', () => {
  const { buildFunctionIndex } = require('../src/functions');
  const index = buildFunctionIndex();
  assert.ok(index.get('STR2INT').doc.includes('STR2INT("123.456") -> 123'), 'STR2INT docs should describe decimal string truncation');
  assert.ok(index.get('STR2INT').doc.includes('含文字则不合法'), 'STR2INT docs should reject text input');
  assert.ok(index.get('SCANTEXT').doc.includes('ASCII 转码'), 'SCANTEXT docs should describe ASCII conversion');
  assert.ok(index.get('SCANTEXT').doc.includes('公用变数号码'), 'SCANTEXT docs should describe global variable addresses');
});

test('STD, STDAX, and stack function docs include documented conversion boundaries', () => {
  const { buildFunctionIndex } = require('../src/functions');
  const index = buildFunctionIndex();
  assert.ok(index.get('STD').doc.includes('Pr17'), 'STD docs should describe the control precision source');
  assert.ok(index.get('STD').doc.includes('#1600'), 'STD docs should describe the standard LIU variable');
  assert.ok(index.get('STDAX').doc.includes('Pr3241=1'), 'STDAX docs should describe computer decimal mode');
  assert.ok(index.get('STDAX').doc.includes('不进行数值或型别转换'), 'STDAX docs should preserve decimal input behavior');
  assert.ok(index.get('POP').doc.includes('移除'), 'POP docs should describe destructive stack reads');
  assert.ok(index.get('STKTOP').doc.includes('index 从 0 开始'), 'STKTOP docs should describe zero-based stack indexing');
  assert.ok(index.get('STKTOP').doc.includes('不删除'), 'STKTOP docs should describe non-destructive reads');
});

test('SETDO and SETABIT function docs include PLC write conflict warning', () => {
  const { buildFunctionIndex } = require('../src/functions');
  const index = buildFunctionIndex();
  for (const name of ['SETDO', 'SETABIT']) {
    const doc = index.get(name).doc;
    assert.ok(doc.includes('插值阶段'), `${name} docs should describe interpolation-stage writes`);
    assert.ok(doc.includes('后令覆盖前令'), `${name} docs should describe PLC write ordering risk`);
  }
});

test('OPEN and Cycle DB function docs include documented ordering constraints', () => {
  const { buildFunctionIndex } = require('../src/functions');
  const index = buildFunctionIndex();
  assert.ok(index.get('OPEN').doc.includes('PRINT 必须在 OPEN 成功后'), 'OPEN docs should describe PRINT ordering');
  assert.ok(index.get('OPEN').doc.includes('Pr3905'), 'OPEN docs should describe COM configuration');
  assert.ok(index.get('DBNEW').doc.includes('先 DBINSERT'), 'DBNEW docs should describe empty file initialization');
  assert.ok(index.get('DBNEW').doc.includes('同时间只能开启一个'), 'DBNEW docs should describe active file limit');
  assert.ok(index.get('DBSAVE').doc.includes('DBLOAD/DBINSERT'), 'DBSAVE docs should describe required prior load or insert');
  assert.ok(index.get('DBSAVE').doc.includes('不支援图形模拟'), 'DBSAVE docs should describe simulation limitation');
});

test('Cycle DB function docs describe documented Cycle name state and delete results', () => {
  const { buildFunctionIndex } = require('../src/functions');
  const index = buildFunctionIndex();
  assert.ok(index.get('DBLOAD').doc.includes('目前 Cycle name'), 'DBLOAD docs should describe Cycle name selection');
  assert.ok(index.get('DBINSERT').doc.includes('覆盖先前 DBLOAD/DBINSERT'), 'DBINSERT docs should describe Cycle name replacement');
  assert.ok(index.get('DBDELETE').doc.includes('-1(超出范围)'), 'DBDELETE docs should describe out-of-range result');
  assert.ok(index.get('DBDELETE').doc.includes('-2(未开档)'), 'DBDELETE docs should describe unopened-file result');
});

test('CHK function docs include return values and version baseline', () => {
  const { buildFunctionIndex } = require('../src/functions');
  const index = buildFunctionIndex();
  for (const name of ['CHKMN', 'CHKSN', 'CHKMT', 'CHKMI']) {
    const doc = index.get(name).doc;
    assert.ok(doc.includes('1(一致) / 0(不符)'), `${name} docs should describe return values`);
    assert.ok(doc.includes('10.116.6A'), `${name} docs should describe version baseline`);
  }
});

test('AXID function docs prefer the documented bare-axis syntax', () => {
  const { buildFunctionIndex } = require('../src/functions');
  const axid = buildFunctionIndex().get('AXID');
  assert.ok(axid.sig.includes('AXID(axis)'), 'AXID signature should use an axis identifier');
  assert.ok(axid.doc.includes('裸轴名'), 'AXID docs should recommend a bare axis identifier');
  assert.ok(axid.doc.includes('VACANT'), 'AXID docs should describe the missing-axis result');
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
  for (const gcode of ['G1.15', 'G1.16', 'G2.15', 'G4.15', 'G11.15', 'G11.16', 'G11.17',
    'G31.15', 'G43.15', 'G52.15', 'G52.16', 'G52.17', 'G52.20', 'G52.21',
    'G53.15', 'G53.16', 'G53.17', 'G53.18', 'G68.15', 'G141.1', 'G142.1',
    'G190.1', 'G190.2', 'G191.1', 'G191.2']) {
    assert.ok(gcodes.includes(gcode), `${gcode} should be in gcodes`);
  }
  // 资料补章 §8.16~§8.21 新登机器人指令
  for (const gcode of ['G196', 'G193.101', 'G903']) {
    assert.ok(gcodes.includes(gcode), `${gcode} should be in gcodes (资料补章 §8.16~§8.21)`);
  }
});

test('CHKMN/CHKSN/CHKMT/CHKMI/CHKINF doc mention MACRO XML 应用关系', () => {
  const { buildFunctionIndex } = require('../src/functions');
  const index = buildFunctionIndex();
  for (const name of ['CHKMN', 'CHKSN', 'CHKMT', 'CHKMI', 'CHKINF']) {
    const fn = index.get(name);
    assert.ok(fn, `${name} should be present in functions index`);
    assert.ok(fn.doc.includes('MACRO XML 资料应用关系'), `${name} doc should mention MACRO XML relation (资料补章 §9.13)`);
  }
});

test('资料补章 new G codes have hover docs', () => {
  const { getCodeDoc, getG10LCodeDoc } = require('../src/codeDocs');
  for (const code of ['G196', 'G193.101', 'G903']) {
    const doc = getCodeDoc(code);
    assert.ok(doc, `${code} should have hover doc (资料补章 §8.16~§8.21)`);
    assert.ok(doc.sig.includes(code), `${code} sig should contain code`);
  }
  const l1802 = getG10LCodeDoc('L1802');
  assert.ok(l1802, 'L1802 should have hover doc (资料补章 §8.4.3)');
  assert.ok(l1802.doc.includes('静音模式'), 'L1802 doc should mention 静音模式 version gate');
  assert.ok(l1802.doc.includes('COR-345'), 'L1802 doc should reference COR-345');
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
  const path = require('path');
  const { buildFileCandidates } = require('../src/fileResolver');
  const candidates = buildFileCandidates('C:\\MACRO', 'G0200');
  assert.strictEqual(candidates[0], path.join('C:\\MACRO', 'G0200'));
  assert.ok(candidates.includes(path.join('C:\\MACRO', 'G0200.nc')));
  assert.ok(candidates.includes(path.join('C:\\MACRO', 'G0200.cnc')));
  assert.ok(candidates.includes(path.join('C:\\MACRO', 'G0200.demo')));
  assert.ok(!candidates.includes(path.join('C:\\MACRO', 'G0200.macro')));
  assert.ok(!candidates.includes(path.join('C:\\MACRO', 'G0200.scp')));
  assert.ok(!candidates.includes(path.join('C:\\MACRO', 'G0200.G')));
  assert.ok(!candidates.includes(path.join('C:\\MACRO', 'G0200.txt')));
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
  assert.ok(g65.doc.includes('独立 #1~#400'), 'G65 hover doc should describe isolated local variables');

  const g66 = getCodeDoc('G66');
  assert.ok(g66.doc.includes('移动单节结束后'), 'G66 hover doc should describe motion-block triggering');

  const g661 = getCodeDoc('G66.1');
  assert.ok(g661.doc.includes('每个单节结束后'), 'G66.1 hover doc should describe every-block triggering');

  const m98 = getCodeDoc('M98');
  assert.ok(m98.sig.includes('M98'), 'M98 hover doc should include signature');
  assert.ok(m98.doc.includes('O 副程序'), 'M98 hover doc should describe O subprogram call');
  assert.ok(m98.doc.includes('继承调用方 #1~#400'), 'M98 hover doc should describe inherited local variables');

  const m198 = getCodeDoc('M198');
  assert.ok(m198.doc.includes('重新读取目标档案'), 'M198 hover doc should describe file reload behavior');

  const m99 = getCodeDoc('M99');
  assert.ok(m99.sig.includes('[P_] [Q_]'), 'M99 hover doc should include optional return targets');
  assert.ok(m99.doc.includes('指定 N 序号'), 'M99 hover doc should describe N-label returns');
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
  assert.strictEqual(byPrefix.msg.body[0], 'MSG("${1:提示信息}");', 'MSG snippet should not insert a leading space and should end with semicolon');
  assert.ok(byPrefix.for.body[0].includes(' := '), 'FOR snippet should use recommended := assignment');
  assert.strictEqual(byPrefix.if.body.at(-1), 'END_IF;', 'IF snippet should close with semicolon');
  assert.strictEqual(byPrefix.while.body.at(-1), 'END_WHILE;', 'WHILE snippet should close with semicolon');
  assert.strictEqual(byPrefix.repeat.body.at(-1), 'UNTIL ${2:条件} END_REPEAT;', 'REPEAT snippet should use single-line UNTIL END_REPEAT with semicolon');
  // OPEN: path-based API, not file-handle
  assert.strictEqual(byPrefix.open.body[0], 'OPEN("${1:文件路径}");', 'OPEN snippet should use valid overwrite syntax');
  assert.strictEqual(byPrefix.opena.body[0], 'OPEN("${1:文件路径}", "a");', 'OPEN append snippet should use valid append syntax');
  // READABIT: single arg, no 位号
  assert.ok(!byPrefix.readabit.body[0].includes('位号'), 'READABIT should have single arg');
  // SETABIT: two args, no 位号
  assert.ok(!byPrefix.setabit.body[0].includes('位号'), 'SETABIT should not have three args');
  assert.ok(byPrefix.g10l1803.body[0].includes('G10 L1803'), 'G10 L1803 snippet should exist');
  assert.ok(byPrefix.g10l1805.body[0].includes('G10 L1805'), 'G10 L1805 snippet should exist');
  assert.strictEqual(byPrefix.g10l1022r.body[0], 'G10 L1022 P0 A${1:1} I"${2:2000h}" U${3:0} R${4:30000};', 'G10 L1022 read snippet should keep quotes outside placeholder');
  assert.ok(byPrefix.ife.body.includes('// ${2:代码}'), 'control-flow snippets should keep comment markers outside placeholders');
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
  assert.match('<>', new RegExp(patternByName['keyword.operator.comparison.syntec-macro']));
  assert.doesNotMatch('==', new RegExp(patternByName['keyword.operator.comparison.syntec-macro']));
  assert.doesNotMatch('!=', new RegExp(patternByName['keyword.operator.comparison.syntec-macro']));
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