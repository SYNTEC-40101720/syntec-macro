// validator.test.js
// 用法: node validator.test.js
// 测试覆盖: IF/END_IF配对、CASE/END_CASE、REPEAT/UNTIL、中文字符检测、括号匹配、替代关键字、EXIT、GOTO、%@MACRO

const { validateDocument } = require('../src/validator');

// 辅助: 宽松比较 - 只比较 [sev, msg片段] 对，忽略 line/col/endCol/重复
// 格式: [['error', '精确消息'], ['warning', '包含此串']]
function match(text, expected) {
  const got = validateDocument(text);
  // 按 severity 分组，逐组比较
  const gotBySev = { error: got.filter(d => d.severity === 'error').map(d => d.msg),
    warning: got.filter(d => d.severity === 'warning').map(d => d.msg) };
  const expBySev = { error: (expected.filter(e => e[0] === 'error').map(e => e[1])),
    warning: (expected.filter(e => e[0] === 'warning').map(e => e[1])) };
  for (const sev of ['error', 'warning']) {
    if (gotBySev[sev].length !== expBySev[sev].length) return { ok: false, got, expected, detail: sev + ' count: got ' + gotBySev[sev].length + ', expected ' + expBySev[sev].length };
    for (const msg of expBySev[sev]) {
      if (!gotBySev[sev].some(g => g.includes(msg))) {
        return { ok: false, got, expected, detail: 'missing ' + sev + ': ' + msg };
      }
    }
  }
  return { ok: true };
}

let passed = 0, failed = 0;

function eq(name, text, expected) {
  const r = match(text, expected);
  if (r.ok) {
    console.log('  ✅ ' + name);
    passed++;
  } else {
    console.log('  ❌ ' + name);
    console.log('    got:      ' + JSON.stringify(validateDocument(text).map(d => [d.severity, d.msg])));
    console.log('    expected: ' + JSON.stringify(expected));
    if (r.detail) console.log('    detail:   ' + r.detail);
    failed++;
  }
}

// ============================================================
// 1. IF/END_IF 配对
// ============================================================
console.log('\n[1] IF/END_IF 配对');
{
  eq('正确嵌套 IF/END_IF 无报错',
    'IF #1=1 THEN\nEND_IF', []);

  eq('单行 IF 无 END_IF → warning',
    'IF #1=1 THEN',
    [['warning', 'IF 块缺少对应的 END_']]);

  eq('多余 END_IF 报 error',
    'END_IF',
    [['error', 'END_IF 没有匹配的 IF']]);

  eq('IF 嵌套两层，内层 END_IF 闭合，外层仍缺 → warning',
    'IF #1=1 THEN\n  IF #2=1 THEN\nEND_IF',
    [['warning', 'IF 块缺少对应的 END_']]);

  eq('IF 嵌套两层，两层都缺 END_IF → 两条 warning',
    'IF #1=1 THEN\n  IF #2=1 THEN',
    [['warning', 'IF 块缺少对应的 END_'], ['warning', 'IF 块缺少对应的 END_']]);
}

// ============================================================
// 2. ELSE / ELSEIF
// ============================================================
console.log('\n[2] ELSE / ELSEIF');
{
  eq('IF+ELSE+END_IF 正确', 'IF #1=1 THEN\nELSE\nEND_IF', []);
  eq('IF+ELSEIF+ELSE+END_IF 正确', 'IF #1=1 THEN\nELSEIF #2=1 THEN\nELSE\nEND_IF', []);
  eq('ELSE 无匹配 IF', 'ELSE',
    [['error', 'ELSE 没有匹配的 IF 或 CASE']]);
  eq('ELSEIF 无匹配 IF', 'ELSEIF #1=1 THEN',
    [['error', 'ELSEIF 没有匹配的 IF']]);
  // IF+ELSE后ELSEIF前没有END_IF → ELSEIF无匹配IF；IF层也缺END_IF
  // 注意：当前实现 ELSEIF 在 ELSE 后报 "IF 块已有 ELSE" 而非 "ELSEIF 没有匹配的 IF"
  // 这是正确的行为，因为 ELSEIF 确实匹配到了 IF，只是该 IF 已有 ELSE
  eq('IF+ELSE+ELSEIF（非法）→ 两层警告',
    'IF #1=1 THEN\nELSE\nELSEIF #2=1 THEN',
    [['warning', 'IF 块缺少对应的 END_'], ['error', 'IF 块已有 ELSE']]);
  eq('IF+ELSEIF+END_IF（无ELSE）正确', 'IF #1=1 THEN\nELSEIF #2=1 THEN\nEND_IF', []);
}

// ============================================================
// 3. CASE/END_CASE
// ============================================================
console.log('\n[3] CASE/END_CASE');
{
  eq('CASE OF END_CASE 正确', 'CASE #51 OF\nEND_CASE', []);
  eq('CASE OF DEFAULT值 END_CASE 正确',
    'CASE #51 OF\nN10:\nDEFAULT:\nEND_CASE', []);
  eq('CASE OF 缺少 END_CASE', 'CASE #51 OF',
    [['warning', 'CASE 块缺少对应的 END_']]);
  eq('CASE 中 ELSE 正确', 'CASE #51 OF\nN10:\nELSE\nEND_CASE', []);
}

// ============================================================
// 4. FOR/END_FOR
// ============================================================
console.log('\n[4] FOR/END_FOR');
{
  eq('FOR TO DO END_FOR 正确', 'FOR #1=1 TO 10 DO\nEND_FOR', []);
  eq('FOR TO BY DO END_FOR 正确', 'FOR #1=1 TO 10 BY 2 DO\nEND_FOR', []);
  eq('FOR 缺少 END_FOR', 'FOR #1=1 TO 10 DO',
    [['warning', 'FOR 块缺少对应的 END_']]);
  eq('END_FOR 无匹配', 'END_FOR',
    [['error', 'END_FOR 没有匹配的 FOR']]);
}

// ============================================================
// 5. WHILE/DO/END_WHILE
// ============================================================
console.log('\n[5] WHILE/DO/END_WHILE');
{
  eq('WHILE DO END_WHILE 正确', 'WHILE #1=1 DO\nEND_WHILE', []);
  eq('WHILE 缺少 END_WHILE', 'WHILE #1=1 DO',
    [['warning', 'WHILE 块缺少对应的 END_']]);
}

// ============================================================
// 6. REPEAT/UNTIL
// ============================================================
console.log('\n[6] REPEAT/UNTIL');
{
  eq('REPEAT UNTIL 正确', 'REPEAT\nUNTIL #1=1', []);
  eq('REPEAT 缺少 UNTIL', 'REPEAT',
    [['warning', 'REPEAT 块缺少对应的 END_']]);
  eq('UNTIL 无匹配 REPEAT', 'UNTIL #1=1',
    [['error', 'UNTIL 没有匹配的 REPEAT']]);
}

// ============================================================
// 7. 混嵌
// ============================================================
console.log('\n[7] 混嵌');
{
  eq('IF 内嵌 CASE，外层正确闭合',
    'IF #1=1 THEN\n  CASE #51 OF\n  END_CASE\nELSE\nEND_IF', []);

  eq('IF 内嵌 FOR，先遇到 END_IF → 报嵌套顺序错误',
    'IF #1=1 THEN\n  FOR #1=1 TO 10 DO\nEND_IF',
    [['error', 'END_IF 嵌套顺序错误']]);

  eq('WHILE 内嵌 REPEAT，先遇到 END_WHILE → 报嵌套顺序错误',
    'WHILE #1=1 DO\n  REPEAT\nEND_WHILE',
    [['error', 'END_WHILE 嵌套顺序错误']]);
}

// ============================================================
// 8. 注释内关键字应豁免
// ============================================================
console.log('\n[8] 注释内关键字豁免');
{
  eq('行注释内 END_IF 不触发报错', '// IF #1=1 THEN\n// END_IF', []);
  eq('块注释内 END_IF 不触发报错', '(* END_IF *)', []);
  eq('跨行块注释内 IF 不触发报错', '(*\nIF #1=1 THEN\nEND_IF\n*)', []);
  eq('跨行块注释内 GOTO 不验证目标', '(*\nGOTO 99\n*)', []);
  // 关键修复: 字符串内 END_IF 不被误报
  eq('字符串内关键字不触发报错', 'MSG("END_IF is keyword")', []);
  eq('字符串内 #变量 不触发', 'MSG("hello #VAR world")', []);
  eq('字符串内 M99 不触发', 'MSG("M99")', []);
}

// ============================================================
// 9. 中文字符检测
// ============================================================
console.log('\n[9] 中文字符检测');
{
  eq('中文汉字在代码中报错', '加工=1',
    [['error', '中文字符']]);
  eq('中文标点 "；" 在代码中报错（IF未闭合同时报warning）',
    'IF #1=1；',
    [['warning', 'IF 块缺少对应的 END_'], ['error', '中文标点 "；"']]);
  eq('中文标点 "，" 在代码中报错', 'MSG=1；',
    [['error', '中文标点']]);
  eq('注释内中文字符不报错', '// 中文注释', []);
  eq('块注释内中文字符不报错', '(* 中文 *)', []);
  eq('块注释结束后的中文字符仍报错', '(* 中文 *) 加工=1',
    [['error', '中文字符']]);
  eq('注释行首含中文标点不报错', '// ；中文', []);
  // 字符串内 CJK 不报错（合法用法：宏程序可输出中文消息）
  eq('字符串内中文不报错（合法用法）', 'MSG("你好")', []);
  eq('纯字符串含中文不报错', '"中文"', []);
}

// ============================================================
// 10. 括号匹配
// ============================================================
console.log('\n[10] 括号匹配');
{
  // 单行 IF 无 END_IF 本身就会报 warning，这是预期行为
  eq('IF ABS(#1-#2)=1 THEN → 括号正确，IF缺END_IF报warning',
    'IF ABS(#1-#2)=1 THEN',
    [['warning', 'IF 块缺少对应的 END_']]);
  eq('IF 带完整 END_IF，括号正确 → 无括号警告',
    'IF ABS(#1-#2)=1 THEN\nEND_IF', []);
  eq('多余右括号', 'IF #1=1 THEN)',
    [['warning', 'IF 块缺少对应的 END_'], ['warning', '括号不匹配：多余的右括号']]);
  // 缺少右括号时，报缺少右括号
  eq('缺少右括号', 'IF (ABS(#1)=1 THEN',
    [['warning', 'IF 块缺少对应的 END_（文件结束）'], ['warning', '括号不匹配：缺少 1 个右括号']]);
  eq('注释内括号不触发', '// IF ( #1=1 THEN', []);
  eq('字符串内括号不触发', 'MSG("(")', []);
  eq('IF 带 END_IF，括号正确', 'IF ABS(SIN(#1))=1 THEN\nEND_IF', []);
  eq('IF 带 END_IF，括号正确（多级嵌套）',
    'IF ABS(SIN(#1))=1 THEN\nEND_IF', []);
}

// ============================================================
// 11. 分号结尾关键字
// ============================================================
console.log('\n[11] 分号结尾关键字');
{
  eq('IF; 视为 IF（IF缺END_IF报warning，正确）',
    'IF #1=1; THEN',
    [['warning', 'IF 块缺少对应的 END_']]);
  eq('END_IF; 视为 END_IF', 'IF #1=1 THEN\nEND_IF;', []);
}

// ============================================================
// 12. GOTO 标签
// ============================================================
console.log('\n[12] GOTO 标签');
{
  eq('GOTO 不影响 IF 配对（目标N100存在，IF正常闭合）',
    'IF #1=1 THEN\nGOTO 100\nEND_IF\nN100;',
    []);
  eq('GOTO #变量 为运行期目标，不做静态标签存在性校验',
    'N10;\nGOTO #10;\nN20;',
    []);
  eq('GOTO #变量 即使当前文件无同号标签也不报目标不存在',
    'GOTO #10;',
    []);
  eq('GOTO 标签不存在报 warning',
    'GOTO 99;',
    [['warning', 'GOTO 目标 99 不存在']]);
  eq('GOTO 标签存在不报错', 'N99;\nGOTO 99;', []);
  eq('GOTO 100 不应把 N1000 当作目标',
    'N1000;\nGOTO 100;',
    [['warning', 'GOTO 目标 100 不存在']]);
}

// ============================================================
// 13. 替代关键字（不带下划线）
// ============================================================
console.log('\n[13] 替代关键字（不带下划线）');
{
  eq('ENDIF 等效于 END_IF，但建议 END_IF', 'IF #1=1 THEN\nENDIF',
    [['warning', 'ENDIF 支援但不推荐']]);
  eq('ENDFOR 等效于 END_FOR，但建议 END_FOR', 'FOR #1=1 TO 10 DO\nENDFOR',
    [['warning', 'ENDFOR 支援但不推荐']]);
  eq('ENDCASE 等效于 END_CASE，但建议 END_CASE', 'CASE #51 OF\nENDCASE',
    [['warning', 'ENDCASE 支援但不推荐']]);
  eq('ENDWHILE 等效于 END_WHILE，但建议 END_WHILE', 'WHILE #1=1 DO\nENDWHILE',
    [['warning', 'ENDWHILE 支援但不推荐']]);
  eq('ENDREPEAT 等效于 END_REPEAT，但建议 END_REPEAT', 'REPEAT\nUNTIL #1=1 ENDREPEAT',
    [['warning', 'ENDREPEAT 支援但不推荐']]);
  eq('混用标准与替代形式 正确',
    'IF #1=1 THEN\nFOR #2=1 TO 10 DO\nENDFOR\nENDIF',
    [['warning', 'ENDFOR 支援但不推荐'], ['warning', 'ENDIF 支援但不推荐']]);
}

// ============================================================
// 14. EXIT 跳出
// ============================================================
console.log('\n[14] EXIT 跳出');
{
  eq('EXIT 在 FOR 内不影响块栈匹配（FOR...EXIT...ENDFOR 正确配对）',
    'FOR #1=1 TO 10 DO\nIF #1=5 THEN\nEXIT\nEND_IF\nEND_FOR',
    []);
  eq('EXIT 在 WHILE 内不影响块栈匹配（WHILE...EXIT...END_WHILE 正确配对）',
    'WHILE #1=1 DO\nEXIT\nEND_WHILE',
    []);
  eq('EXIT 在 REPEAT 内不影响块栈匹配（REPEAT...EXIT...UNTIL...END_REPEAT 正确配对）',
    'REPEAT\nEXIT\nUNTIL #1=1 END_REPEAT',
    []);
  eq('EXIT 单独出现 不报错（允许在最外层使用）',
    'EXIT', []);
}

// ============================================================
// 15. %@MACRO 文件头检查
// ============================================================
console.log('\n[15] %@MACRO 文件头检查');
{
  eq('有 %@MACRO 不报 warning',
    '%@MACRO\nIF #1=1 THEN\nEND_IF', []);
  eq('仅有 % 无 %@MACRO 报 warning',
    '%\nG01 X100.;',
    [['warning', '此文件缺少 %@MACRO 文件头']]);
  eq('注释行后出现 %@MACRO 不报错',
    '// 这是一个MACRO程序\n%@MACRO\nIF #1=1 THEN\nEND_IF', []);
  eq('ISO格式文件不强制要求 %@MACRO',
    'G01 X100.;\nM30;', []);
}

// ============================================================
// 16. 不支持的语法检测
// ============================================================
console.log('\n[16] 不支持的语法检测');
{
  eq('ELSIF 报错提示使用 ELSEIF',
    '%@MACRO\nIF #1=1 THEN\nELSIF #1=2 THEN\nEND_IF',
    [['error', 'ELSIF 不支持']]);
  eq('命名局部变量 #TEMP 报错',
    '%@MACRO\n#TEMP := 1;',
    [['error', '#TEMP 是不支持的命名变量']]);
  eq('命名公用变量 @TEMP 报错',
    '%@MACRO\n@TEMP := 1;',
    [['error', '@TEMP 是不支持的命名变量']]);
  eq('字符串和注释中的命名变量不报错',
    '%@MACRO\nMSG("#TEMP @TEMP")\n// #TEMP\n(* @TEMP *)\n#1 := 1;', []);
}

// ============================================================
// 17. 风格建议
// ============================================================
console.log('\n[17] 风格建议');
{
  eq('赋值 = 支援但建议 :=',
    '%@MACRO\n#1 = 100;',
    [['warning', '赋值使用 = 支援但不推荐']]);
  eq('条件比较 = 不触发赋值建议',
    '%@MACRO\nIF #1 = 100 THEN\nEND_IF;', []);
  eq('推荐赋值 := 不触发建议',
    '%@MACRO\n#1 := 100;', []);
}

// ============================================================
// 结果汇总
// ============================================================
console.log('\n' + '========================================');
console.log('  结果: ' + passed + ' passed, ' + failed + ' failed');
console.log('========================================\n');

if (failed > 0) process.exit(1);
