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
    'IF #1=1 THEN\nEND_IF;', []);

  eq('单行 IF 无 END_IF → warning',
    'IF #1=1 THEN',
    [['warning', 'IF 块缺少对应的 END_']]);

  eq('多余 END_IF 报 error',
    'END_IF;',
    [['error', 'END_IF 没有匹配的 IF']]);

  eq('IF 嵌套两层，内层 END_IF 闭合，外层仍缺 → warning',
    'IF #1=1 THEN\n  IF #2=1 THEN\nEND_IF;',
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
  eq('IF+ELSE+END_IF 正确', 'IF #1=1 THEN\nELSE\nEND_IF;', []);
  eq('IF+ELSEIF+ELSE+END_IF 正确', 'IF #1=1 THEN\nELSEIF #2=1 THEN\nELSE\nEND_IF;', []);
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
  eq('IF+ELSEIF+END_IF（无ELSE）正确', 'IF #1=1 THEN\nELSEIF #2=1 THEN\nEND_IF;', []);
}

// ============================================================
// 3. CASE/END_CASE
// ============================================================
console.log('\n[3] CASE/END_CASE');
{
  eq('CASE OF END_CASE 正确', 'CASE #51 OF\nEND_CASE;', []);
  eq('CASE 多值分支和 ELSE 正确',
    'CASE #51 OF\n1:\n  #1 := 10;\n2,3:\n  #1 := 20;\nELSE\n  #1 := 0;\nEND_CASE;', []);
  eq('CASE 分支标签后同行陈述支援但不推荐',
    'CASE #51 OF\n1: #1 := 10;\nEND_CASE;',
    [['warning', 'CASE 分支标签后同行陈述支援但不推荐']]);
  eq('CASE 不支持 DEFAULT',
    'CASE #51 OF\n1: #1 := 10;\nDEFAULT: #1 := 0;\nEND_CASE;',
    [['warning', 'CASE 分支标签后同行陈述支援但不推荐'], ['error', 'DEFAULT 不支持，请使用 ELSE']]);
  eq('CASE OF 缺少 END_CASE', 'CASE #51 OF',
    [['warning', 'CASE 块缺少对应的 END_']]);
  eq('CASE 中 ELSE 正确', 'CASE #51 OF\n1:\nELSE\nEND_CASE;', []);
}

// ============================================================
// 4. FOR/END_FOR
// ============================================================
console.log('\n[4] FOR/END_FOR');
{
  eq('FOR TO DO END_FOR 正确', 'FOR #1=1 TO 10 DO\nEND_FOR;', []);
  eq('FOR TO BY DO END_FOR 正确', 'FOR #1=1 TO 10 BY 2 DO\nEND_FOR;', []);
  eq('FOR 缺少 END_FOR', 'FOR #1=1 TO 10 DO',
    [['warning', 'FOR 块缺少对应的 END_']]);
  eq('END_FOR 无匹配', 'END_FOR',
    [['error', '语句应以 ; 结尾'], ['error', 'END_FOR 没有匹配的 FOR']]);
}

// ============================================================
// 5. WHILE/DO/END_WHILE
// ============================================================
console.log('\n[5] WHILE/DO/END_WHILE');
{
  eq('WHILE DO END_WHILE; 正确', 'WHILE #1=1 DO\nEND_WHILE;', []);
  eq('END_WHILE 缺少分号报错', 'WHILE #1=1 DO\nEND_WHILE',
    [['error', '语句应以 ; 结尾']]);
  eq('WHILE 缺少 END_WHILE', 'WHILE #1=1 DO',
    [['warning', 'WHILE 块缺少对应的 END_']]);
}

// ============================================================
// 6. REPEAT/UNTIL
// ============================================================
console.log('\n[6] REPEAT/UNTIL');
{
  eq('REPEAT UNTIL END_REPEAT; 正确', 'REPEAT\nUNTIL #1=1 END_REPEAT;', []);
  eq('UNTIL 缺少分号报错', 'REPEAT\nUNTIL #1=1 END_REPEAT',
    [['error', '语句应以 ; 结尾']]);
  eq('REPEAT 缺少 UNTIL', 'REPEAT',
    [['warning', 'REPEAT 块缺少对应的 END_']]);
  eq('UNTIL 无匹配 REPEAT', 'UNTIL #1=1;',
    [['error', 'UNTIL 没有匹配的 REPEAT']]);
}

// ============================================================
// 7. 混嵌
// ============================================================
console.log('\n[7] 混嵌');
{
  eq('IF 内嵌 CASE，外层正确闭合',
    'IF #1=1 THEN\n  CASE #51 OF\n  END_CASE;\nELSE\nEND_IF;', []);

  eq('IF 内嵌 FOR，先遇到 END_IF → 报嵌套顺序错误',
    'IF #1=1 THEN\n  FOR #1=1 TO 10 DO\nEND_IF;',
    [['error', 'END_IF 嵌套顺序错误']]);

  eq('WHILE 内嵌 REPEAT，先遇到 END_WHILE → 报嵌套顺序错误',
    'WHILE #1=1 DO\n  REPEAT\nEND_WHILE',
    [['error', '语句应以 ; 结尾'], ['error', 'END_WHILE 嵌套顺序错误']]);
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
  eq('字符串内关键字不触发报错', 'MSG("END_IF is keyword");', []);
  eq('字符串内 #变量 不触发', 'MSG("hello #VAR world");', []);
  eq('字符串内 M99 不触发', 'MSG("M99");', []);
}

// ============================================================
// 9. 中文字符检测
// ============================================================
console.log('\n[9] 中文字符检测');
{
  eq('中文汉字在代码中报错', '加工=1;',
    [['error', '中文字符']]);
  eq('中文标点 "；" 在代码中报错（IF未闭合同时报warning）',
    'IF #1=1；',
    [['warning', 'IF 块缺少对应的 END_'], ['error', '中文标点 "；"']]);
  eq('中文标点 "，" 在代码中报错', 'MSG=1；',
    [['error', '中文标点']]);
  eq('注释内中文字符不报错', '// 中文注释', []);
  eq('块注释内中文字符不报错', '(* 中文 *)', []);
  eq('块注释结束后的中文字符仍报错', '(* 中文 *) 加工=1;',
    [['error', '中文字符']]);
  eq('注释行首含中文标点不报错', '// ；中文', []);
  // 字符串内 CJK 不报错（合法用法：宏程序可输出中文消息）
  eq('字符串内中文不报错（合法用法）', 'MSG("你好");', []);
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
    'IF ABS(#1-#2)=1 THEN\nEND_IF;', []);
  eq('多余右括号', 'IF #1=1 THEN)',
    [['warning', 'IF 块缺少对应的 END_'], ['warning', '括号不匹配：多余的右括号']]);
  // 缺少右括号时，报缺少右括号
  eq('缺少右括号', 'IF (ABS(#1)=1 THEN',
    [['warning', 'IF 块缺少对应的 END_（文件结束）'], ['warning', '括号不匹配：缺少 1 个右括号']]);
  eq('注释内括号不触发', '// IF ( #1=1 THEN', []);
  eq('字符串内括号不触发', 'MSG("(");', []);
  eq('IF 带 END_IF，括号正确', 'IF ABS(SIN(#1))=1 THEN\nEND_IF;', []);
  eq('IF 带 END_IF，括号正确（多级嵌套）',
    'IF ABS(SIN(#1))=1 THEN\nEND_IF;', []);
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
    'IF #1=1 THEN\nGOTO 100;\nEND_IF;\nN100;',
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
  eq('ENDIF; 等效于 END_IF;，正式支援', 'IF #1=1 THEN\nENDIF;', []);
  eq('ENDFOR; 等效于 END_FOR;，正式支援', 'FOR #1=1 TO 10 DO\nENDFOR;', []);
  eq('ENDCASE; 等效于 END_CASE;，正式支援', 'CASE #51 OF\nENDCASE;', []);
  eq('ENDWHILE; 等效于 END_WHILE;，正式支援', 'WHILE #1=1 DO\nENDWHILE;', []);
  eq('ENDREPEAT; 等效于 END_REPEAT;，正式支援', 'REPEAT\nUNTIL #1=1 ENDREPEAT;', []);
  eq('混用标准与替代形式 正确',
    'IF #1=1 THEN\nFOR #2=1 TO 10 DO\nENDFOR;\nENDIF;',
    []);
}

// ============================================================
// 14. EXIT 跳出
// ============================================================
console.log('\n[14] EXIT 跳出');
{
  eq('EXIT 在 FOR 内不影响块栈匹配（FOR...EXIT...ENDFOR 正确配对）',
    'FOR #1=1 TO 10 DO\nIF #1=5 THEN\nEXIT;\nEND_IF;\nEND_FOR;',
    []);
  eq('EXIT 在 WHILE 内不影响块栈匹配（WHILE...EXIT...END_WHILE 正确配对）',
    'WHILE #1=1 DO\nEXIT;\nEND_WHILE;',
    []);
  eq('EXIT 在 REPEAT 内不影响块栈匹配（REPEAT...EXIT...UNTIL...END_REPEAT 正确配对）',
    'REPEAT\nEXIT;\nUNTIL #1=1 END_REPEAT;',
    []);
  eq('EXIT 单独出现 不报错（允许在最外层使用）',
    'EXIT;', []);
}

// ============================================================
// 15. %@MACRO 文件头检查
// ============================================================
console.log('\n[15] %@MACRO 文件头检查');
{
  eq('有 %@MACRO 不报 warning',
    '%@MACRO\nIF #1=1 THEN\nEND_IF;', []);
  eq('仅有 % 无 %@MACRO 报 warning',
    '%\nG01 X100.;',
    [['warning', '此文件缺少 %@MACRO 文件头']]);
  eq('注释行后出现 %@MACRO 不报错',
    '// 这是一个MACRO程序\n%@MACRO\nIF #1=1 THEN\nEND_IF;', []);
  eq('ISO格式文件不强制要求 %@MACRO',
    'G01 X100.;\nM30;', []);
}

// ============================================================
// 16. 不支持的语法检测
// ============================================================
console.log('\n[16] 不支持的语法检测');
{
  eq('ELSIF 报错提示使用 ELSEIF',
    '%@MACRO\nIF #1=1 THEN\nELSIF #1=2 THEN\nEND_IF;',
    [['error', 'ELSIF 不支持']]);
  eq('DIV 不支持，整数除法请使用 /',
    '%@MACRO\n#1 := 100 DIV 7;',
    [['error', 'DIV 不支持']]);
  eq('== 不支持，等于比较请使用 =',
    '%@MACRO\nIF #1 == 100 THEN\nEND_IF;',
    [['error', '== 不支持']]);
  eq('!= 不支持，不等于比较请使用 <>',
    '%@MACRO\nIF #1 != 100 THEN\nEND_IF;',
    [['error', '!= 不支持']]);
  eq('比较表达式不能单独成行',
    '%@MACRO\n@1 <> 2\nM99;',
    [['error', '比较表达式不能单独成行']]);
  eq('赋值语句缺少分号报错',
    '%@MACRO\n#203 := #203 + 1\nM99;',
    [['error', '语句应以 ; 结尾']]);
  eq('一般指令缺少分号报错',
    '%@MACRO\nG01 X100.\nWAIT()\nM99;',
    [['error', '语句应以 ; 结尾'], ['error', '语句应以 ; 结尾']]);
  eq('控制结构开头行和 CASE 空分支标签可不加分号，结束语句需加分号',
    '%@MACRO\nWHILE #1 < 10 DO\nCASE #1 OF\n1:\nELSE\nEND_CASE;\nEND_WHILE;\nM99;', []);
  eq('控制结构开头行误加分号报错',
    '%@MACRO\nWHILE #203 < 10 DO;\n  CASE #203 OF;\n  0:;\n  ELSE;\n  END_CASE;\nEND_WHILE;\nM99;',
    [['error', '控制结构行不应以 ; 结尾'], ['error', '控制结构行不应以 ; 结尾'], ['error', '控制结构行不应以 ; 结尾'], ['error', '控制结构行不应以 ; 结尾']]);
  eq('错误诊断抑制同区间风格提示',
    '%@MACRO\nCASE #1 OF\n1:;\nEND_CASE;',
    [['error', '控制结构行不应以 ; 结尾']]);
  eq('所有控制结构开头和分支行误加分号都报错',
    '%@MACRO\nIF #1 > 50 THEN;\nELSEIF #1 > 20 THEN;\nELSE;\nEND_IF;\nFOR #1 := 1 TO 10 BY 2 DO;\nEND_FOR;\nREPEAT;\nUNTIL #1 > 10 END_REPEAT;\nCASE #10 OF;\n1:;\nEND_CASE;\nWHILE #1 > 0 DO;\nEND_WHILE;\nM99;',
    [['error', '控制结构行不应以 ; 结尾'], ['error', '控制结构行不应以 ; 结尾'], ['error', '控制结构行不应以 ; 结尾'], ['error', '控制结构行不应以 ; 结尾'], ['error', '控制结构行不应以 ; 结尾'], ['error', '控制结构行不应以 ; 结尾'], ['error', '控制结构行不应以 ; 结尾'], ['error', '控制结构行不应以 ; 结尾']]);
  eq('% 不支持，取模请使用 MOD',
    '%@MACRO\n#1 := 10 % 3;',
    [['error', '% 不支持']]);
  eq('&& 不支持，逻辑且请使用 AND 或 &',
    '%@MACRO\nIF (#1 > 0) && (#2 < 10) THEN\nEND_IF;',
    [['error', '&& 不支持']]);
  eq('|| 不支持，逻辑或请使用 OR',
    '%@MACRO\nIF (#1 = 1) || (#1 = 2) THEN\nEND_IF;',
    [['error', '|| 不支持']]);
  eq('! 不支持，NOT 是补数而非 C 风格逻辑非',
    '%@MACRO\nIF !#1 THEN\nEND_IF;',
    [['error', '! 不支持']]);
  eq('MOD 静态小数操作数不支援',
    '%@MACRO\n#1 := 10.0 MOD 3;\n#2 := 10 MOD 3.0;\n#3 := .5 MOD 2;',
    [['error', 'MOD 仅适用于 Long'], ['error', 'MOD 仅适用于 Long'], ['error', 'MOD 仅适用于 Long']]);
  eq('MOD 静态整数操作数支援',
    '%@MACRO\n#1 := 10 MOD 3;', []);
  eq('+= 不支持，需使用完整赋值',
    '%@MACRO\n#1 += 1;',
    [['error', '+= 不支持']]);
  eq('++ 不支持，无自增语法',
    '%@MACRO\n#1++;',
    [['error', '++ 不支持']]);
  eq('FANUC 比较关键字不支持',
    '%@MACRO\nIF #1 EQ 1 THEN\nEND_IF;\nIF #2 NE 0 THEN\nEND_IF;\nIF #3 GT 0 THEN\nEND_IF;\nIF #4 GE 0 THEN\nEND_IF;\nIF #5 LT 0 THEN\nEND_IF;\nIF #6 LE 0 THEN\nEND_IF;',
    [['error', 'EQ 不支持'], ['error', 'NE 不支持'], ['error', 'GT 不支持'], ['error', 'GE 不支持'], ['error', 'LT 不支持'], ['error', 'LE 不支持']]);
  eq('不支持运算子在字符串和注释中不报错',
    '%@MACRO\nMSG("% && || ! += ++ EQ NE GT GE LT LE");\n// % && || ! += ++ EQ\n(* NE GT GE LT LE *)\n#1 := 10 MOD 3;', []);
  eq('命名局部变量 #TEMP 报错',
    '%@MACRO\n#TEMP := 1;',
    [['error', '#TEMP 是不支持的命名变量']]);
  eq('命名公用变量 @TEMP 报错',
    '%@MACRO\n@TEMP := 1;',
    [['error', '@TEMP 是不支持的命名变量']]);
  eq('字符串和注释中的命名变量不报错',
    '%@MACRO\nMSG("#TEMP @TEMP");\n// #TEMP\n(* @TEMP *)\n#1 := 1;', []);
  eq('#0/@0 作为赋值目标 warning',
    '%@MACRO\n#0 := 1;\n@0 := 2;',
    [['warning', '#0 为 VACANT'], ['warning', '@0 为 VACANT']]);
  eq('AR/MAR 直接编号必须为非负整数',
    '%@MACRO\nAR-1 := 1;\nMAR1.1 := 2;',
    [['error', 'AR-1 不是合法 APP 变量编号'], ['error', 'MAR1.1 不是合法 APP 变量编号']]);
  eq('AR/MAR 间接静态编号必须为非负整数',
    '%@MACRO\nAR[-1] := 1;\nMAR[1.1] := 2;',
    [['error', 'AR[-1] 不是合法 APP 变量编号'], ['error', 'MAR[1.1] 不是合法 APP 变量编号']]);
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
// 18. 函数静态诊断
// ============================================================
console.log('\n[18] 函数静态诊断');
{
  eq('数学函数静态域检查',
    '%@MACRO\n#1 := ATAN2(0, 0);\n#2 := POW(-1, 2);\n#3 := LN(0);\n#4 := SQRT(-1);\n#5 := SQRT(0);\n#6 := ACOS(1.1);\n#7 := ASIN(-1.1);\n#8 := ACOS(1);\n#9 := ASIN(-1);',
    [['error', 'ATAN2(0,0)'], ['error', 'POW 基底不可为负值'], ['error', 'LN 引数需为正数'], ['error', 'SQRT 引数需大于或等于 0'], ['error', 'ACOS 引数范围为 -1~1'], ['error', 'ASIN 引数范围为 -1~1']]);
  eq('I/O 函数范围检查',
    '%@MACRO\n#1 := READDI(512);\nSETDO(3, 2);\n#2 := READRREGBIT(70000, 32);',
    [['error', 'READDI 点编号范围为 0~511'], ['error', 'SETDO 写入值应为 0 或 1'], ['error', 'READRREGBIT 的 R 值编号范围为 0~65535'], ['error', 'READRREGBIT 的 bit 范围为 0~31']]);
  eq('ALARM MSG PARAM CHKINF 静态参数检查',
    '%@MACRO\nALARM(70000);\nMSG(70000, "Hi");\n#1 := PARAM(1.2);\n#2 := CHKINF(6, "A");',
    [['error', 'ALARM ID 范围为 0~65535'], ['error', 'MSG ID 范围为 0~65535'], ['error', 'PARAM 引数需为整数'], ['error', 'CHKINF 类别范围为 1~5']]);
  eq('ALARM MSG CHKINF 合法静态参数不报错',
    '%@MACRO\nALARM(0);\nMSG("状态");\nMSG(65535, "Status");\n#1 := CHKINF(1, "A");',
    []);
  eq('PARAM 整数参数形式不报错',
    '%@MACRO\n#1 := PARAM(3204);\n#2 := PARAM(20001, 2);',
    []);
  eq('DRVDATA 静态引数格式检查',
    '%@MACRO\n#1 := DRVDATA(1003, 3366);\n#2 := DRVDATA(1003, "D61h");\n#3 := DRVDATA(#1, #2);\n#4 := DRVDATA("1003", 3425);\n#5 := DRVDATA(1003.0, 3425);\n#6 := DRVDATA(1003, "G21h");\n#7 := DRVDATA(1003, "0D61H");\n#8 := DRVDATA(1003, 1.2);',
    [['error', 'DRVDATA 站号需为整数'], ['error', 'DRVDATA 站号需为整数'], ['error', 'DRVDATA 第二引数需为十进制整数或 "xxxh" 十六进制字符串'], ['error', 'DRVDATA 第二引数需为十进制整数或 "xxxh" 十六进制字符串'], ['error', 'DRVDATA 第二引数需为十进制整数或 "xxxh" 十六进制字符串']]);
  eq('SYSDATA 静态引数需为整数',
    '%@MACRO\n#1 := SYSDATA("77");\n#2 := SYSDATA(77.0);\n#3 := SYSDATA(#4);\nMSG("SYSDATA(77.0)");',
    [['error', 'SYSDATA 引数需为整数'], ['error', 'SYSDATA 引数需为整数']]);
  eq('OPEN COM1 提示普通文件名',
    '%@MACRO\nOPEN("COM1");',
    [['warning', 'OPEN("COM1") 会按普通文件名处理']]);
  eq('AXID 建议使用裸轴名且忽略注释和字串',
    '%@MACRO\n#1 := AXID(Y);\n#2 := AXID("Y");\n#3 := AXID(#4);\n// AXID("Z")\n#4 := "AXID(\\"X\\")";',
    [['warning', 'AXID 建议使用裸轴名，例如 AXID(Y)']]);
}

// ============================================================
// 19. 机器人/坐标系旧语法诊断
// ============================================================
console.log('\n[19] 机器人/坐标系旧语法诊断');
{
  eq('MOVJ-II 不是正式指令写法',
    '%@MACRO\nMOVJ-II X100.;',
    [['error', 'MOVJ-II 不是正式指令写法']]);
  eq('MOVJ 第二语法直接引数不使用 =',
    '%@MACRO\nMOVJ X=100. Y0. FJ=50;',
    [['error', 'MOVJ 直接引数不使用 =']]);
  eq('MOVL 直接引数不使用 =',
    '%@MACRO\nMOVL X=100. FL=80.;',
    [['error', 'MOVL 直接引数不使用 =']]);
  eq('MOVC 直接引数不使用 =',
    '%@MACRO\nMOVC X=100. FL=80.;\nMOVC X100. Y0.;',
    [['error', 'MOVC 直接引数不使用 =']]);
  eq('MOVC 不支持 Xp/Yp/Zp',
    '%@MACRO\nMOVC Xp=100. Yp=0. Zp=0.;\nMOVC X100. Y0.;',
    [['error', 'MOVC 不支持 Xp/Yp/Zp']]);
  eq('INCMOVJ 速度引数不使用 =',
    '%@MACRO\nINCMOVJ C1=10 FJ=30;',
    [['error', 'INCMOVJ 的 Q/FJ/FEJ/PL/ACC/DEC 为直接引数']]);
  eq('INCMOVL 直接引数不使用 =',
    '%@MACRO\nINCMOVL P1 X=50. FL=80.;',
    [['error', 'INCMOVL 直接引数不使用 =']]);
  eq('TOOLCOR 使用 P 而非 T',
    '%@MACRO\nTOOLCOR T1;',
    [['error', 'TOOLCOR/TOOLCORON 使用 P_']]);
  eq('TOOLCORON 建议改用 TOOLCOR',
    '%@MACRO\nTOOLCORON P1;',
    [['warning', 'TOOLCORON 未见官方语法']]);
  eq('TOOLCOR CLEAR 建议改用 TOOLCOR P0',
    '%@MACRO\nTOOLCOR CLEAR;',
    [['warning', 'TOOLCOR CLEAR 未见官方语法']]);
  eq('OBJCORON 直接引数不使用 =',
    '%@MACRO\nOBJCORON X=5. Y0.;',
    [['error', 'OBJCORON 的 X/Y/Z/A/B/C 为直接引数']]);
  eq('G68.18 直接引数不使用 =',
    '%@MACRO\nG68.18 P=1 X=10.;',
    [['error', 'G68.18 的 P/R/X/Y/Z/A/B/C 为直接引数']]);
  eq('G43.16 直接引数不使用 =',
    '%@MACRO\nG43.16 P=1 X=10.;',
    [['error', 'G43.16 的 P/X/Y/Z/A/B/C 为直接引数']]);
  eq('POSEMAP 直接引数不使用 =',
    '%@MACRO\nPOSEMAP X=100. Q=1 R=1;',
    [['error', 'POSEMAP 的 X/Y/Z/A/B/C/Q/R 为直接引数']]);
  eq('SHIFTON 直接引数不使用 =',
    '%@MACRO\nSHIFTON P1 X=20.;',
    [['error', 'SHIFTON 的 P/X/Y/Z/A/B/C 为直接引数']]);
  eq('SKIPCOND 直接引数不使用 =',
    '%@MACRO\nSKIPCOND E=1 Q33 R1 P0;',
    [['error', 'SKIPCOND 的 E/Q/R/P 为直接引数']]);
  eq('SWAITSIG 直接引数不使用 =',
    '%@MACRO\nSWAITSIG P=1 Q33 R1;',
    [['error', 'SWAITSIG 的 P/Q/R/L/T 为直接引数']]);
  eq('STITCHON L/K 只能择一',
    '%@MACRO\nSTITCHON S1 Q1 L500 K5. E10.;',
    [['error', 'STITCHON 的 L/K 只能择一']]);
  eq('WEAVEON P 不可与细节引数混用',
    '%@MACRO\nWEAVEON P3 E5.;',
    [['error', 'WEAVEON 的 P 语法不可与 E/Q/K/L/R/I 混用']]);
  eq('MOVL 平滑引数互斥',
    '%@MACRO\nMOVL X10. PL5 PQ10.;',
    [['error', 'MOVL 单行只能使用 PL/PQ/PR']]);
  eq('MOVJ 不支持 PQ/PR',
    '%@MACRO\nMOVJ C1=10. PQ5;',
    [['error', 'MOVJ 不支持 PQ/PR']]);
  eq('INCMOVL 缺少 P',
    '%@MACRO\nINCMOVL X10. Y0.;',
    [['error', 'INCMOVL 缺少必填 P 引数']]);
  eq('合法路径扩充引数 C/R/A 不报错',
    '%@MACRO\nG01 X100. Y100., C10.;\nG01 X100. Y100., R10.;\nG01 X100. Y100., A45.;', []);
  eq('函数嵌套表达式不识别为路径扩充引数',
    '%@MACRO\n#162 := ATAN2(-#157, SQRT(#151 * #151 + #154 * #154));', []);
  eq('路径扩充引数支援方括号表达式诊断',
    '%@MACRO\nG01 X100. Y100., Z[#1 + 10];',
    [['error', '路径扩充引数 ,Z_ 不存在']]);
  eq('非路径函数的命名参数不识别为路径扩充引数',
    '%@MACRO\n#1 := ANY_FN(1, B=2);', []);
  eq('不支持路径扩充引数 Z 报错',
    '%@MACRO\nG91 G01 X100. Y100, Z100.;',
    [['error', '路径扩充引数 ,Z_ 不存在']]);
}

// ============================================================
// 20. 跨行机器人/应用诊断
// ============================================================
console.log('\n[20] 跨行机器人/应用诊断');
{
  eq('MOVC 必须成对出现',
    '%@MACRO\nMOVC X100. Y0.;\nMOVL X200.;',
    [['error', 'MOVC 必须成对出现']]);
  eq('MOVC 成对正确',
    '%@MACRO\nMOVC X100. Y0.;\nMOVC X200. Y100.;', []);
  eq('条件分支中的 MOVC 不要求静态成对',
    '%@MACRO\nIF #41 <> #0 THEN\n  MOVC LP#41 FL#52 FR#53 FEJ#54 PL#55;\nELSEIF #42 <> #0 THEN\n  MOVC GP#42 FL#52 FR#53 FEJ#54 PL#55;\nELSE\n  MOVC X#1 Y#2 Z#3 A#4 B#5 C#6 A1=#21 A2=#22 A3=#23 A4=#24 A5=#25 A6=#26 P#43 Q#44 FL#52 FR#53 FEJ#54 PL#55;\nEND_IF;', []);
  eq('MOVC 单行新版写法不需要成对',
    '%@MACRO\nMOVC X1=100. Y1=0. Z1=0., X2=200. Y2=100. Z2=0. FL100.;', []);
  eq('运动单节后多个 SWAITSIG 报错',
    '%@MACRO\nMOVL X100.;\nSWAITSIG P1 Q1 R1;\nSWAITSIG P1 Q2 R1;',
    [['error', '运动单节后只能下 1 个 SWAITSIG']]);
  eq('WAIT 切断 SWAITSIG 运动单节关系',
    '%@MACRO\nMOVL X100.;\nSWAITSIG P1 Q1 R1;\nWAIT();\nSWAITSIG P1 Q2 R1;', []);
  eq('同一移动单节超过 10 个 SYNCOUT 报错',
    '%@MACRO\nMOVL X100.;\n' + Array.from({ length: 11 }, (_, idx) => `SYNCOUT S1 Q${idx + 1} P50 R1;`).join('\n'),
    [['error', '同一有移动量移动单节最多允许 10 个 SYNCOUT']]);
  eq('STITCHON 区间禁止 MOVJ',
    '%@MACRO\nSTITCHON S1 Q1 L500 E10.;\nMOVJ C1=0;\nSTITCHOFF;',
    [['error', 'STITCHON 生效范围内不支持此指令']]);
  eq('WEAVEON 区间禁止 STITCHON',
    '%@MACRO\nWEAVEON E5. Q1.0 K30. L200;\nSTITCHON S1 Q1 L500 E10.;\nWEAVEOFF;',
    [['error', 'WEAVEON 生效范围内不支持此指令']]);
  eq('STITCHON 区间禁止 WAITSYNC',
    '%@MACRO\nSTITCHON S1 Q1 K5. E10.;\nWAITSYNC P1;\nSTITCHOFF;',
    [['error', 'STITCHON 生效范围内不支持此指令']]);
  eq('WEAVEON 区间禁止 WAITSYNC',
    '%@MACRO\nWEAVEON E2. Q1.0 K30. L100;\nWAITSYNC P1;\nWEAVEOFF;',
    [['error', 'WEAVEON 生效范围内不支持此指令']]);
  eq('WAITSYNC 区间禁止 MOVJ 与 M码',
    '%@MACRO\nWAITSYNC P1;\nMOVJ C1=0.;\nM10;\nENDSYNC P1;',
    [['error', 'WAITSYNC 生效范围内不支持此指令'], ['error', 'WAITSYNC 生效范围内不支持此指令']]);
  eq('G192.1 区间禁止 MOVJ 与 SYNCOUT',
    '%@MACRO\nG192.1 P1 Q100 R1;\nMOVJ C1=0.;\nSYNCOUT S1 Q1 P50 R1;\nG192.2;',
    [['error', 'G192.1 末端跟踪生效范围内不支持此指令'], ['error', 'G192.1 末端跟踪生效范围内不支持此指令']]);
}

// ============================================================
// 21. 参考范例回归
// ============================================================
console.log('\n[21] 参考范例回归');
{
  eq('综合场景可诊断赋值和 END_WHILE 缺少分号',
    '%@MACRO\nWHILE #203 < 10 DO\n  #203 := #203 + 1\n  SLEEP();\nEND_WHILE\nM99;',
    [['error', '语句应以 ; 结尾'], ['error', '语句应以 ; 结尾']]);
}

// ============================================================
// 结果汇总
// ============================================================
console.log('\n' + '========================================');
console.log('  结果: ' + passed + ' passed, ' + failed + ' failed');
console.log('========================================\n');

if (failed > 0) process.exit(1);
