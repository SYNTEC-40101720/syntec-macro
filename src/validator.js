// validator.js
// 语法诊断：括号匹配、IF/END_IF配对、控制流检查、中文字符检测
// ============================================================
// 块关键字定义
// ============================================================

// 块开启关键字
const OPENER_KEYWORDS = new Set(['IF', 'FOR', 'WHILE', 'CASE', 'REPEAT']);

// 块关闭关键字映射（标准+替代形式）
const CLOSER_TO_OPENER = {
  'END_IF':     'IF',    'END_FOR':    'FOR',    'END_WHILE':  'WHILE',
  'END_CASE':   'CASE',  'END_REPEAT': 'REPEAT',
  'ENDIF':      'IF',    'ENDFOR':     'FOR',    'ENDWHILE':   'WHILE',
  'ENDCASE':    'CASE',  'ENDREPEAT':  'REPEAT'
};

// 支援但不推荐的替代结束关键字
const PREFERRED_CLOSERS = {
  'ENDIF': 'END_IF',
  'ENDFOR': 'END_FOR',
  'ENDWHILE': 'END_WHILE',
  'ENDCASE': 'END_CASE',
  'ENDREPEAT': 'END_REPEAT'
};

// 循环类开启关键字（EXIT 专用）
const LOOP_OPENERS = new Set(['FOR', 'WHILE', 'REPEAT']);

// ============================================================
// 工具函数
// ============================================================

// 去除字符串和注释，保留代码逻辑
// 字符串和注释内容用空格替换，保留列宽
function stripCommentsAndStringsWithState(line, lineStartInBlock = false) {
  let result = '';
  let inString = false;
  let inBlockComment = lineStartInBlock;
  let i = 0;
  while (i < line.length) {
    if (inBlockComment) {
      if (line.substring(i, i + 2) === '*)') {
        result += '  ';
        inBlockComment = false;
        i += 2;
        continue;
      }
      result += ' ';
      i++;
      continue;
    }

    // 行注释 //
    if (!inString && line.substring(i, i + 2) === '//') {
      result += ' '.repeat(line.length - i);
      break;
    }
    // 块注释 (* *)
    if (!inString && line.substring(i, i + 2) === '(*') {
      result += '  ';
      inBlockComment = true;
      i += 2;
      continue;
    }
    // 字符串（双引号）
    if (line[i] === '"') {
      // 检查是否被转义（前面有奇数个反斜杠）
      let bs = 0;
      let j = i - 1;
      while (j >= 0 && line[j] === '\\') { bs++; j--; }
      if (bs % 2 === 0) {
        // 未被转义，正常切换 inString
        inString = !inString;
      }
      result += ' ';
    } else {
      result += inString ? ' ' : line[i];
    }
    i++;
  }
  return { text: result, inBlockComment };
}

function stripCommentsAndStrings(line) {
  return stripCommentsAndStringsWithState(line).text;
}

// 获取关键字在行中的位置（防止 ENDREPEAT/REPEAT 等子串冲突）
// 策略：用下划线占位法，先把长替代关键字替换成等长占位符，再匹配
function getKeywordPositions(line, isClean = false) {
  const clean = isClean ? line : stripCommentsAndStrings(line);

  // 第一步：把长替代关键字替换成等长占位符（防止 ENDREPEAT 内的 REPEAT 被误匹配）
  // 顺序：越长越先替换（ENDREPEAT > ENDFOR > ... > REPEAT > UNTIL）
  const subs = [
    'ENDREPEAT', 'ENDFOR', 'ENDWHILE', 'ENDCASE', 'ENDIF',
    'END_REPEAT', 'END_FOR', 'END_WHILE', 'END_CASE', 'END_IF'
  ];
  let s = clean;
  const offsetMap = []; // [{origKw, pos}] 记录占位后的位置映射
  for (const kw of subs) {
    const re = new RegExp('\\b' + kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'g');
    let m;
    while ((m = re.exec(s)) !== null) {
      const placeholder = '_'.repeat(kw.length);
      s = s.substring(0, m.index) + placeholder + s.substring(m.index + kw.length);
      offsetMap.push({ kw, col: m.index });
      re.lastIndex = m.index + kw.length; // 重新定位到替换后的位置
    }
  }

  // 第二步：在替换后的字符串中匹配剩余关键字
  const positions = [];
  const shortKws = [
    'REPEAT', 'FOR', 'WHILE', 'CASE', 'IF',
    'ELSEIF', 'ELSE',
    'UNTIL', 'EXIT',
    'TO', 'BY', 'DO', 'OF',
    'GOTO'
  ];
  // 检测不支持的语法
  const unsupportedKws = ['ELSIF', 'DEFAULT', 'DIV'];
  for (const kw of unsupportedKws) {
    const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp('\\b' + escaped + '\\b', 'g');
    let m;
    while ((m = re.exec(s)) !== null) {
      positions.push({ keyword: kw, col: m.index, endCol: m.index + kw.length, unsupported: true });
    }
  }
  for (const kw of shortKws) {
    const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp('\\b' + escaped + '\\b', 'g');
    let m;
    while ((m = re.exec(s)) !== null) {
      positions.push({ keyword: kw, col: m.index, endCol: m.index + kw.length });
    }
  }

  // 第三步：把占位符记录也转成 positions（用原始关键字名）
  for (const { kw, col } of offsetMap) {
    positions.push({ keyword: kw, col, endCol: col + kw.length });
  }

  return positions;
}

// 检查是否 %@MACRO 文件头行
function isMacroHeaderLine(line) {
  return /^%@MACRO$/i.test(line.trim());
}

// 检查一行是否 N标签（行首单独出现 N+数字，且以分号结尾）
// 实测：N100; 才合法，N100: 和裸 N100 都报错
function isNLabelLine(line) {
  const t = line.trim();
  // 行首 N + 数字 + 分号，排除 GOTO/IF/FOR 等复合行
  return /^N(\d+)\s*;/.test(t) &&
    !/^(IF|FOR|WHILE|CASE|REPEAT|ELSEIF|ELSE|GOTO)/i.test(t);
}

// 提取静态 GOTO 目标：GOTO 100
// GOTO #变量 是运行期跳转，无法静态验证目标标签是否存在
function extractGotoTarget(line, isClean = false) {
  const clean = isClean ? line : stripCommentsAndStrings(line);
  const m = clean.match(/\bGOTO\s+(\d+)(?!\w)/i);
  if (m) return m[1] || null;
  return null;
}

// ============================================================
// 独立验证器函数
// ============================================================

// 第一遍：收集 N标签 + 检查 %@MACRO 文件头
function collectMetadata(lines) {
  const nLabels = new Set();
  let firstNonCommentIdx = -1;
  let hasMacroHeader = false;
  let firstNonCommentIsBarePercent = false; // % 后面不是 @ 或者只有 %
  let inBlockComment = false;

  for (let i = 0; i < lines.length; i++) {
    const stripped = stripCommentsAndStringsWithState(lines[i], inBlockComment);
    inBlockComment = stripped.inBlockComment;
    const trimmed = stripped.text.trim();

    // 找第一个非空非注释行
    if (firstNonCommentIdx < 0 && trimmed !== '' && !trimmed.startsWith('//') && !trimmed.startsWith('(*')) {
      firstNonCommentIdx = i;
      // 若 %，后面不是 @，或者只有 % 本身
      if (/^%(?!@)/.test(trimmed)) firstNonCommentIsBarePercent = true;
    }

    // N标签：行首单独出现 N数字（支持 N10; 和 N10: 形式）
    if (isNLabelLine(trimmed)) {
      const nm = trimmed.match(/^N(\d+)/);
      if (nm) { nLabels.add(nm[1]); }
    }

    // 检查 %@MACRO
    if (!trimmed.startsWith('//') && !trimmed.startsWith('(*')) {
      if (isMacroHeaderLine(trimmed)) hasMacroHeader = true;
    }
  }

  const diagnostics = [];
  // 第一行以 % 且无 %@MACRO → 警告
  if (firstNonCommentIsBarePercent && !hasMacroHeader) {
    const first = lines[firstNonCommentIdx].trim();
    diagnostics.push({
      line: firstNonCommentIdx + 1, col: 0, endCol: first.length,
      msg: '此文件缺少 %@MACRO 文件头，将被视为 ISO 格式文件',
      severity: 'warning'
    });
  }

  return { nLabels, diagnostics };
}

// 中文字符验证器：检测代码中的中文汉字和中文标点
function validateChineseCharacters(raw, lineNum, lineStartInBlock) {
  const diagnostics = [];
  const CJK_PUNCT = /[；：，。！？【】《》（）""''、]/;
  const CJK_CHAR  = /[\u4e00-\u9fff\u3400-\u4dbf]/;
  let inStr = false, inBC = lineStartInBlock;
  let hasCJK = false, firstCJK = -1;
  const puncts = [];

  for (let ci = 0; ci < raw.length; ci++) {
    if (!inStr && !inBC && raw.substring(ci, ci + 2) === '//') break;
    if (!inStr && raw.substring(ci, ci + 2) === '(*') {
      inBC = true; ci++; continue;
    }
    if (inBC) {
      if (raw.substring(ci, ci + 2) === '*)') {
        inBC = false; ci++;
      }
      continue;
    }
    if (raw[ci] === '"') { inStr = !inStr; continue; }
    if (inStr || inBC) continue;
    if (CJK_CHAR.test(raw[ci]) && !hasCJK) { hasCJK = true; firstCJK = ci; }
    if (CJK_PUNCT.test(raw[ci])) puncts.push({ col: ci, ch: raw[ci] });
  }
  if (hasCJK) {
    diagnostics.push({
      line: lineNum, col: firstCJK, endCol: firstCJK + 1,
      msg: '中文字符：宏程序只允许使用英文字符', severity: 'error'
    });
  }
  for (const p of puncts) {
    diagnostics.push({
      line: lineNum, col: p.col, endCol: p.col + 1,
      msg: `中文标点 "${p.ch}"：宏程序应使用英文字符`, severity: 'error'
    });
  }
  return diagnostics;
}

// 括号匹配验证器：检测多余的右括号或缺少的右括号
function validateParentheses(line, lineNum, _lineStartInBlock, cleanLine) {
  const clean = cleanLine === undefined ? stripCommentsAndStrings(line) : cleanLine;
  if (!clean.trim()) return [];

  const diagnostics = [];
  const parenStack = [];
  let inStr = false;
  for (let ci = 0; ci < clean.length; ci++) {
    if (clean[ci] === '"') inStr = !inStr;
    if (inStr) continue;
    if (clean[ci] === '(') parenStack.push(ci);
    else if (clean[ci] === ')') {
      if (parenStack.length === 0) {
        diagnostics.push({
          line: lineNum, col: ci, endCol: ci + 1,
          msg: '括号不匹配：多余的右括号', severity: 'warning'
        });
      } else { parenStack.pop(); }
    }
  }
  if (parenStack.length > 0) {
    diagnostics.push({
      line: lineNum, col: parenStack[0], endCol: parenStack[0] + 1,
      msg: `括号不匹配：缺少 ${parenStack.length} 个右括号`, severity: 'warning'
    });
  }
  return diagnostics;
}

// 命名变量验证器：新代宏程序变量使用数字编号，不支持 #TEMP / @TEMP 形式
function validateNamedVariables(_raw, lineNum, _lineStartInBlock, cleanLine) {
  const clean = cleanLine === undefined ? '' : cleanLine;
  if (!clean.trim() || isMacroHeaderLine(clean.trim())) return [];

  const diagnostics = [];
  const re = /(^|[^A-Za-z0-9_])([#@][A-Za-z_][A-Za-z0-9_]*)/g;
  let match;
  while ((match = re.exec(clean)) !== null) {
    const variable = match[2];
    const col = match.index + match[1].length;
    diagnostics.push({
      line: lineNum, col, endCol: col + variable.length,
      msg: `${variable} 是不支持的命名变量；请使用数字变量编号`,
      severity: 'error'
    });
  }
  return diagnostics;
}

function validateVariableAccess(_raw, lineNum, _lineStartInBlock, cleanLine) {
  const clean = cleanLine === undefined ? '' : cleanLine;
  if (!clean.trim()) return [];

  const diagnostics = [];

  const vacantAssignRe = /(^|[^\w])([#@]0)\s*(?::=|=(?!=))/g;
  let match;
  while ((match = vacantAssignRe.exec(clean)) !== null) {
    const col = match.index + match[1].length;
    diagnostics.push({
      line: lineNum,
      col,
      endCol: col + match[2].length,
      msg: `${match[2]} 为 VACANT，只读，不建议作为赋值目标`,
      severity: 'warning'
    });
  }

  const directBadAppVarRe = /\b(?:AR|MAR)(?:-\d+(?:\.\d*)?|\d+\.\d+)\b/ig;
  while ((match = directBadAppVarRe.exec(clean)) !== null) {
    diagnostics.push({
      line: lineNum,
      col: match.index,
      endCol: match.index + match[0].length,
      msg: `${match[0].toUpperCase()} 不是合法 APP 变量编号；AR/MAR 直接编号必须为非负整数`,
      severity: 'error'
    });
  }

  const indirectBadAppVarRe = /\b(?:AR|MAR)\[\s*(-\d+(?:\.\d*)?|\d+\.\d+)\s*\]/ig;
  while ((match = indirectBadAppVarRe.exec(clean)) !== null) {
    diagnostics.push({
      line: lineNum,
      col: match.index,
      endCol: match.index + match[0].length,
      msg: `${match[0].toUpperCase()} 不是合法 APP 变量编号；AR/MAR 间接静态编号必须为非负整数`,
      severity: 'error'
    });
  }

  return diagnostics;
}

// 风格建议：保留兼容语法，但推荐生成更一致的标准写法
function validateStylePreferences(_raw, lineNum, _lineStartInBlock, cleanLine) {
  const clean = cleanLine === undefined ? '' : cleanLine;
  if (!clean.trim()) return [];

  const diagnostics = [];

  const closerRe = /\b(ENDIF|ENDFOR|ENDWHILE|ENDCASE|ENDREPEAT)\b/g;
  let match;
  while ((match = closerRe.exec(clean)) !== null) {
    const keyword = match[1];
    const preferred = PREFERRED_CLOSERS[keyword];
    diagnostics.push({
      line: lineNum, col: match.index, endCol: match.index + keyword.length,
      msg: `${keyword} 支援但不推荐；建议使用 ${preferred}`,
      severity: 'warning'
    });
  }

  const assignmentRe = /^\s*(?:[#@](?:\d+|\[[^\]]+\])|(?:AR|MAR)(?:\d+|\[[^\]]+\]))\s*=(?!=)/;
  const assignmentMatch = clean.match(assignmentRe);
  if (assignmentMatch) {
    const col = clean.indexOf('=', assignmentMatch[0].lastIndexOf('='));
    diagnostics.push({
      line: lineNum, col, endCol: col + 1,
      msg: '赋值使用 = 支援但不推荐；建议使用 :=',
      severity: 'warning'
    });
  }

  return diagnostics;
}

function validateUnsupportedOperators(_raw, lineNum, _lineStartInBlock, cleanLine) {
  const clean = cleanLine === undefined ? '' : cleanLine;
  if (!clean.trim()) return [];

  const diagnostics = [];
  let match;
  const equalityRe = /==/g;
  while ((match = equalityRe.exec(clean)) !== null) {
    diagnostics.push({
      line: lineNum,
      col: match.index,
      endCol: match.index + 2,
      msg: '== 不支持；等于比较请使用单独的 =',
      severity: 'error'
    });
  }

  return diagnostics;
}

function validateRobotSyntaxPreferences(_raw, lineNum, _lineStartInBlock, cleanLine) {
  const clean = cleanLine === undefined ? '' : cleanLine;
  if (!clean.trim()) return [];

  const diagnostics = [];
  const rules = [
    {
      re: /\bMOVJ-II\b/,
      msg: 'MOVJ-II 不是正式指令写法；请使用 MOVJ 第二语法'
    },
    {
      re: /\bMOVJ\b(?=[^;]*\b(?:X|Y|Z|A|B|C|P|Q|FJ|FEJ|PL|ACC|DEC)\s*=)/,
      msg: 'MOVJ 直接引数不使用 =；请使用 X100. / P1 / FJ50 等写法'
    },
    {
      re: /\bMOVL\b(?=[^;]*\b(?:X|Y|Z|A|B|C|P|Q|FL|FR|FEJ|PL|PQ|PR|ACC|DEC)\s*=)/,
      msg: 'MOVL 直接引数不使用 =；请使用 X100. / P1 / FL100. 等写法'
    },
    {
      re: /\bMOVC\b(?=[^;]*\b(?:X|Y|Z|A|B|C|FL|FR|FEJ|PL|PQ|PR|ACC|DEC)\s*=)/,
      msg: 'MOVC 直接引数不使用 =；请使用 X100. / FL100. / PL3 等写法'
    },
    {
      re: /\bMOVC\b(?=[^;]*\b(?:Xp|Yp|Zp)\s*=)/,
      msg: 'MOVC 不支持 Xp/Yp/Zp 通过点写法；请使用成对 MOVC 的 X/Y/Z/A/B/C 直接引数'
    },
    {
      re: /\bINCMOVJ\b(?=[^;]*\b(?:Q|FJ|FEJ|PL|ACC|DEC)\s*=)/,
      msg: 'INCMOVJ 的 Q/FJ/FEJ/PL/ACC/DEC 为直接引数；请使用 Q1 / FJ30 等写法'
    },
    {
      re: /\bINCMOVL\b(?=[^;]*\b(?:P|X|Y|Z|A|B|C|Q|FL|FR|FEJ|PL|PQ|PR|ACC|DEC)\s*=)/,
      msg: 'INCMOVL 直接引数不使用 =；请使用 P1 / X50. / FL80. 等写法'
    },
    {
      re: /\b(?:TOOLCOR|TOOLCORON)\s+T(?=\d|#|@|\[|=)/,
      msg: 'TOOLCOR/TOOLCORON 使用 P_ 指定工具编号；请勿使用 T_'
    },
    {
      re: /\bTOOLCORON\b/,
      msg: 'TOOLCORON 未见官方语法；建议改用 TOOLCOR P_'
    },
    {
      re: /\bTOOLCOR\s+CLEAR\b/,
      msg: 'TOOLCOR CLEAR 未见官方语法；建议改用 TOOLCOR P0'
    },
    {
      re: /\bOBJCORON\b(?=[^;]*\b(?:X|Y|Z|A|B|C)\s*=)/,
      msg: 'OBJCORON 的 X/Y/Z/A/B/C 为直接引数；请使用 X5. 而非 X=5.'
    },
    {
      re: /\bG68\.18\b(?=[^;]*\b(?:P|R|X|Y|Z|A|B|C)\s*=)/,
      msg: 'G68.18 的 P/R/X/Y/Z/A/B/C 为直接引数；请使用 P1 / R0 / X10. 等写法'
    },
    {
      re: /\bG43\.16\b(?=[^;]*\b(?:P|X|Y|Z|A|B|C)\s*=)/,
      msg: 'G43.16 的 P/X/Y/Z/A/B/C 为直接引数；请使用 P1 / X10. 等写法'
    },
    {
      re: /\bPOSEMAP\b(?=[^;]*\b(?:X|Y|Z|A|B|C|Q|R)\s*=)/,
      msg: 'POSEMAP 的 X/Y/Z/A/B/C/Q/R 为直接引数；请使用 X100. / Q1 / R1 等写法'
    },
    {
      re: /\bSHIFTON\b(?=[^;]*\b(?:P|X|Y|Z|A|B|C)\s*=)/,
      msg: 'SHIFTON 的 P/X/Y/Z/A/B/C 为直接引数；请使用 P1 / X20. 等写法'
    },
    {
      re: /\bSKIPCOND\b(?=[^;]*\b(?:E|Q|R|P)\s*=)/,
      msg: 'SKIPCOND 的 E/Q/R/P 为直接引数；请使用 E1 / Q33 / R1 / P0 等写法'
    },
    {
      re: /\bSWAITSIG\b(?=[^;]*\b(?:P|Q|R|L|T)\s*=)/,
      msg: 'SWAITSIG 的 P/Q/R/L/T 为直接引数；请使用 P1 / Q33 / R1 等写法'
    },
    {
      re: /\bSTITCHON\b(?=[^;]*\b(?:S|Q|L|K|E)\s*=)/,
      msg: 'STITCHON 的 S/Q/L/K/E 为直接引数；请使用 S1 / Q1 / L500 / E10. 等写法'
    },
    {
      re: /\bWEAVEON\b(?=[^;]*\b(?:P|E|Q|K|L|R|I)\s*=)/,
      msg: 'WEAVEON 的 P/E/Q/K/L/R/I 为直接引数；请使用 P3 或 E5. Q1.0 K30. 等写法'
    }
  ];

  for (const rule of rules) {
    const match = clean.match(rule.re);
    if (match) {
      diagnostics.push({
        line: lineNum,
        col: match.index,
        endCol: match.index + match[0].length,
        msg: rule.msg,
        severity: rule.msg.includes('建议改用') ? 'warning' : 'error'
      });
    }
  }

  return diagnostics;
}

function getCommand(cleanLine) {
  const trimmed = cleanLine.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/^(G\d+(?:\.\d+)?|M\d+|[A-Z][A-Z0-9_.-]*)\b/i);
  return match ? match[1].toUpperCase() : null;
}

function hasDirectArg(cleanLine, argName) {
  return new RegExp('\\b' + argName + '(?=[#@+\\-]?(?:\\d|\\.|\\(|#|@))', 'i').test(cleanLine);
}

function getStaticDirectArgNumber(cleanLine, argName) {
  const match = cleanLine.match(new RegExp('\\b' + argName + '([+-]?\\d+(?:\\.\\d*)?)', 'i'));
  if (!match) return null;
  return Number(match[1]);
}

function countSmoothArgs(cleanLine) {
  return ['PL', 'PQ', 'PR'].filter(arg => hasDirectArg(cleanLine, arg)).length;
}

function isMovementCommand(command) {
  return ['MOVJ', 'MOVL', 'MOVC', 'INCMOVJ', 'INCMOVL'].includes(command);
}

function isSingleLineMovc(cleanLine) {
  return /\bMOVC\b/i.test(cleanLine) && /\bX1\s*=/i.test(cleanLine) && /\bX2\s*=/i.test(cleanLine);
}

function validateConfirmedSingleLineSyntax(_raw, lineNum, _lineStartInBlock, cleanLine) {
  const clean = cleanLine === undefined ? '' : cleanLine;
  if (!clean.trim()) return [];

  const diagnostics = [];
  const command = getCommand(clean);

  if (['MOVL', 'MOVC', 'INCMOVL'].includes(command) && countSmoothArgs(clean) > 1) {
    diagnostics.push({
      line: lineNum, col: clean.search(/\b(?:PL|PQ|PR)/i), endCol: clean.length,
      msg: `${command} 单行只能使用 PL/PQ/PR 其中一个平滑引数`,
      severity: 'error'
    });
  }

  if (['MOVJ', 'INCMOVJ'].includes(command) && (hasDirectArg(clean, 'PQ') || hasDirectArg(clean, 'PR'))) {
    diagnostics.push({
      line: lineNum, col: clean.search(/\b(?:PQ|PR)/i), endCol: clean.length,
      msg: `${command} 不支持 PQ/PR；请使用 PL`,
      severity: 'error'
    });
  }

  if (command === 'MOVJ' && hasDirectArg(clean, 'P') && !hasDirectArg(clean, 'X')) {
    diagnostics.push({
      line: lineNum, col: clean.search(/\bP/i), endCol: clean.length,
      msg: 'MOVJ 第一语法不支持 P 引数',
      severity: 'error'
    });
  }

  if (command === 'INCMOVL' && !hasDirectArg(clean, 'P')) {
    diagnostics.push({
      line: lineNum, col: clean.search(/\bINCMOVL\b/i), endCol: clean.search(/\bINCMOVL\b/i) + 'INCMOVL'.length,
      msg: 'INCMOVL 缺少必填 P 引数',
      severity: 'error'
    });
  }

  if (command === 'STITCHON') {
    const hasL = hasDirectArg(clean, 'L');
    const hasK = hasDirectArg(clean, 'K');
    if (hasL && hasK) {
      diagnostics.push({ line: lineNum, col: clean.search(/\b(?:L|K)/i), endCol: clean.length, msg: 'STITCHON 的 L/K 只能择一输入', severity: 'error' });
    } else if (!hasL && !hasK) {
      diagnostics.push({ line: lineNum, col: clean.search(/\bSTITCHON\b/i), endCol: clean.length, msg: 'STITCHON 需指定 L 或 K 其中一个', severity: 'warning' });
    }
    const lValue = getStaticDirectArgNumber(clean, 'L');
    if (lValue !== null && !Number.isInteger(lValue)) {
      diagnostics.push({ line: lineNum, col: clean.search(/\bL/i), endCol: clean.length, msg: 'STITCHON 的 L 引数不可带小数点', severity: 'error' });
    }
  }

  if (command === 'WEAVEON') {
    const hasP = hasDirectArg(clean, 'P');
    const detailArgs = ['E', 'Q', 'K', 'L', 'R', 'I'].filter(arg => hasDirectArg(clean, arg));
    if (hasP && detailArgs.length > 0) {
      diagnostics.push({ line: lineNum, col: clean.search(/\bWEAVEON\b/i), endCol: clean.length, msg: 'WEAVEON 的 P 语法不可与 E/Q/K/L/R/I 混用', severity: 'error' });
    }
    const qMatch = clean.match(/\bQ([+-]?\d+)(?!\.)/i);
    if (!hasP && qMatch) {
      diagnostics.push({ line: lineNum, col: qMatch.index, endCol: qMatch.index + qMatch[0].length, msg: 'WEAVEON 的 Q 频率建议使用小数形式，例如 Q1.0', severity: 'warning' });
    }
  }

  return diagnostics;
}

function validatePathExtensionArgs(_raw, lineNum, _lineStartInBlock, cleanLine) {
  const clean = cleanLine === undefined ? '' : cleanLine;
  if (!clean.trim()) return [];

  const diagnostics = [];
  const allowed = new Set(['C', 'R', 'A']);
  const pathExtensionRe = /,\s*([A-Z][0-9](?=\s*=)|[A-Z]+)(?=\s*=|[#@+\-]?(?:\d|\.|\(|#|@))/ig;
  let match;
  while ((match = pathExtensionRe.exec(clean)) !== null) {
    const arg = match[1].toUpperCase();
    if (/^[XYZABC][12]$/.test(arg)) continue;
    if (!allowed.has(arg)) {
      diagnostics.push({
        line: lineNum,
        col: match.index,
        endCol: match.index + match[0].length,
        msg: `路径扩充引数 ,${arg}_ 不存在；仅确认支持 ,C_ / ,R_ / ,A_`,
        severity: 'error'
      });
    }
  }

  return diagnostics;
}

function getStaticFunctionCalls(cleanLine, functionName) {
  const escaped = functionName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp('\\b' + escaped + '\\s*\\(([^()]*)\\)', 'ig');
  const calls = [];
  let match;
  while ((match = re.exec(cleanLine)) !== null) {
    calls.push({ col: match.index, endCol: match.index + match[0].length, args: match[1].split(',').map(arg => arg.trim()) });
  }
  return calls;
}

function parseStaticNumber(value) {
  if (!/^[+-]?\d+(?:\.\d*)?$/.test(value)) return null;
  return Number(value);
}

function addRangeDiagnostic(diagnostics, call, lineNum, message) {
  diagnostics.push({
    line: lineNum,
    col: call.col,
    endCol: call.endCol,
    msg: message,
    severity: 'error'
  });
}

function stripCommentsKeepStringsWithState(line, lineStartInBlock = false) {
  let result = '';
  let inString = false;
  let inBlockComment = lineStartInBlock;
  let i = 0;
  while (i < line.length) {
    if (inBlockComment) {
      if (line.substring(i, i + 2) === '*)') {
        result += '  ';
        inBlockComment = false;
        i += 2;
        continue;
      }
      result += ' ';
      i++;
      continue;
    }
    if (!inString && line.substring(i, i + 2) === '//') {
      result += ' '.repeat(line.length - i);
      break;
    }
    if (!inString && line.substring(i, i + 2) === '(*') {
      result += '  ';
      inBlockComment = true;
      i += 2;
      continue;
    }
    if (line[i] === '"') {
      let bs = 0;
      let j = i - 1;
      while (j >= 0 && line[j] === '\\') { bs++; j--; }
      if (bs % 2 === 0) inString = !inString;
    }
    result += line[i];
    i++;
  }
  return { text: result, inBlockComment };
}

function validateStaticFunctionArguments(raw, lineNum, lineStartInBlock, cleanLine) {
  const clean = cleanLine === undefined ? '' : cleanLine;
  if (!clean.trim()) return [];

  const diagnostics = [];

  for (const call of getStaticFunctionCalls(clean, 'ATAN2')) {
    const y = parseStaticNumber(call.args[0] || '');
    const x = parseStaticNumber(call.args[1] || '');
    if (x === 0 && y === 0) addRangeDiagnostic(diagnostics, call, lineNum, 'ATAN2(0,0) 会触发 COR-004 运算域错误');
  }

  for (const call of getStaticFunctionCalls(clean, 'POW')) {
    const base = parseStaticNumber(call.args[0] || '');
    if (base !== null && base < 0) addRangeDiagnostic(diagnostics, call, lineNum, 'POW 基底不可为负值，否则触发 COR-122');
  }

  for (const call of getStaticFunctionCalls(clean, 'LN')) {
    const value = parseStaticNumber(call.args[0] || '');
    if (value !== null && value <= 0) addRangeDiagnostic(diagnostics, call, lineNum, 'LN 引数需为正数');
  }

  const ioSingleRanges = [
    ['READDI', 0, 511], ['READDO', 0, 511], ['READABIT', 0, 511],
    ['SETDO', 0, 511], ['SETABIT', 0, 511]
  ];
  for (const [fn, min, max] of ioSingleRanges) {
    for (const call of getStaticFunctionCalls(clean, fn)) {
      const value = parseStaticNumber(call.args[0] || '');
      if (value !== null && (!Number.isInteger(value) || value < min || value > max)) {
        addRangeDiagnostic(diagnostics, call, lineNum, `${fn} 点编号范围为 ${min}~${max}`);
      }
    }
  }

  const ioValueFns = ['SETDO', 'SETABIT', 'SETRREGBIT'];
  for (const fn of ioValueFns) {
    for (const call of getStaticFunctionCalls(clean, fn)) {
      const value = parseStaticNumber(call.args[fn === 'SETRREGBIT' ? 2 : 1] || '');
      if (value !== null && ![0, 1].includes(value)) addRangeDiagnostic(diagnostics, call, lineNum, `${fn} 写入值应为 0 或 1`);
    }
  }

  for (const fn of ['READRREGBIT', 'SETRREGBIT']) {
    for (const call of getStaticFunctionCalls(clean, fn)) {
      const reg = parseStaticNumber(call.args[0] || '');
      const bit = parseStaticNumber(call.args[1] || '');
      if (reg !== null && (!Number.isInteger(reg) || reg < 0 || reg > 65535)) {
        addRangeDiagnostic(diagnostics, call, lineNum, `${fn} 的 R 值编号范围为 0~65535`);
      }
      if (bit !== null && (!Number.isInteger(bit) || bit < 0 || bit > 31)) {
        addRangeDiagnostic(diagnostics, call, lineNum, `${fn} 的 bit 范围为 0~31`);
      }
    }
  }

  for (const fn of ['ALARM', 'MSG']) {
    for (const call of getStaticFunctionCalls(clean, fn)) {
      const id = parseStaticNumber(call.args[0] || '');
      if (id !== null && (!Number.isInteger(id) || id < 0 || id > 65535)) addRangeDiagnostic(diagnostics, call, lineNum, `${fn} ID 范围为 0~65535`);
    }
  }

  for (const call of getStaticFunctionCalls(clean, 'PARAM')) {
    for (const arg of call.args.slice(0, 2)) {
      const value = parseStaticNumber(arg);
      if (value !== null && !Number.isInteger(value)) addRangeDiagnostic(diagnostics, call, lineNum, 'PARAM 引数需为整数');
    }
  }

  for (const call of getStaticFunctionCalls(clean, 'CHKINF')) {
    const category = parseStaticNumber(call.args[0] || '');
    if (category !== null && (!Number.isInteger(category) || category < 1 || category > 5)) addRangeDiagnostic(diagnostics, call, lineNum, 'CHKINF 类别范围为 1~5');
  }

  const commentStripped = stripCommentsKeepStringsWithState(raw || '', lineStartInBlock).text;
  const openComMatch = commentStripped.match(/\bOPEN\s*\(\s*"COM\d+"\s*\)/i);
  if (openComMatch) {
    diagnostics.push({
      line: lineNum,
      col: openComMatch.index,
      endCol: openComMatch.index + openComMatch[0].length,
      msg: '串口传输埠仅支持 OPEN("COM")；OPEN("COM1") 会按普通文件名处理',
      severity: 'warning'
    });
  }

  return diagnostics;
}

function validateCaseLineStyle(cleanLine, lineNum, stack) {
  const diagnostics = [];
  const top = stack[stack.length - 1];
  if (!top || top.keyword !== 'CASE') return diagnostics;

  if (/^\s*DEFAULT\s*:/i.test(cleanLine)) return diagnostics;

  const branchMatch = cleanLine.match(/^\s*(?:[#@]?(?:\d+|\[[^\]]+\])|[A-Za-z][A-Za-z0-9_]*)(?:\s*,\s*(?:[#@]?(?:\d+|\[[^\]]+\])|[A-Za-z][A-Za-z0-9_]*))*\s*:(?!=)\s*(\S.*)$/);
  if (branchMatch) {
    diagnostics.push({
      line: lineNum,
      col: cleanLine.indexOf(branchMatch[1]),
      endCol: cleanLine.length,
      msg: 'CASE 分支标签后同行陈述支援但不推荐；建议换行缩排陈述列表',
      severity: 'warning'
    });
  }

  const elseMatch = cleanLine.match(/^\s*ELSE\s+(\S.*)$/);
  if (elseMatch) {
    diagnostics.push({
      line: lineNum,
      col: cleanLine.indexOf(elseMatch[1]),
      endCol: cleanLine.length,
      msg: 'CASE ELSE 后同行陈述支援但不推荐；建议换行缩排陈述列表',
      severity: 'warning'
    });
  }

  return diagnostics;
}

// 控制流关键字验证：处理单个关键字的栈操作和错误报告
function validateControlFlowKeyword(pos, lineNum, positions, stack, untiledRepeats, diagnostics) {
  const kw = pos.keyword;

  // --- 不支持的语法 ---
  if (pos.unsupported) {
    let msg = '';
    if (kw === 'ELSIF') msg = 'ELSIF 不支持，请使用 ELSEIF';
    else if (kw === 'DEFAULT') msg = 'DEFAULT 不支持，请使用 ELSE';
    else if (kw === 'DIV') msg = 'DIV 不支持；整数除法请使用 /，分子与分母皆为整数时结果仍为整数';
    else msg = `${kw} 是不支持的语法`;
    diagnostics.push({
      line: lineNum, col: pos.col, endCol: pos.endCol,
      msg, severity: 'error'
    });
    return;
  }

  // --- 开启关键字 ---
  if (OPENER_KEYWORDS.has(kw)) {
    stack.push({ line: lineNum, keyword: kw, hasElse: false });
    return;
  }

  // --- 关闭关键字 ---
  if (kw in CLOSER_TO_OPENER) {
    // END_REPEAT/ENDREPEAT 是 UNTIL 的语法跟随符：
    // 1) 同行有 UNTIL：UNTIL 已关闭 REPEAT，END_REPEAT 只是语法结束符
    // 2) 不同行：UNTIL 已在前面关闭了 REPEAT，END_REPEAT 应跳过已被 UNTIL 关闭的 REPEAT
    let skipThisKw = false;
    if (kw === 'END_REPEAT' || kw === 'ENDREPEAT') {
      if (positions.some(p => p.keyword === 'UNTIL')) {
        skipThisKw = true; // 同行，UNTIL 已处理
      } else {
        // 不同行：消费一个 untiled REPEAT
        if (untiledRepeats.length > 0) {
          untiledRepeats.pop();
          skipThisKw = true;
        }
      }
    }
    if (skipThisKw) return;

    const opener = CLOSER_TO_OPENER[kw];
    const top = stack[stack.length - 1];
    if (top && top.keyword === opener) {
      stack.pop();
    } else if (top) {
      diagnostics.push({
        line: lineNum, col: pos.col, endCol: pos.endCol,
        msg: `${kw} 嵌套顺序错误：当前未闭合的是 ${top.keyword}`,
        severity: 'error'
      });
      let matchIdx = -1;
      for (let j = stack.length - 2; j >= 0; j--) {
        if (stack[j].keyword === opener) { matchIdx = j; break; }
      }
      if (matchIdx >= 0) stack.splice(matchIdx);
    } else {
      diagnostics.push({
        line: lineNum, col: pos.col, endCol: pos.endCol,
        msg: `${kw} 没有匹配的 ${opener}`,
        severity: 'error'
      });
    }
    return;
  }

  // --- ELSE ---
  if (kw === 'ELSE') {
    const valid = ['IF', 'CASE'];
    let ni = -1;
    for (let j = stack.length - 1; j >= 0; j--) {
      if (valid.includes(stack[j].keyword)) { ni = j; break; }
    }
    if (ni < 0) {
      diagnostics.push({
        line: lineNum, col: pos.col, endCol: pos.endCol,
        msg: 'ELSE 没有匹配的 IF 或 CASE', severity: 'error'
      });
    } else {
      for (let j = ni; j >= 0; j--) {
        if (stack[j].keyword === 'IF') { stack[j].hasElse = true; break; }
      }
    }
    return;
  }

  // --- ELSEIF ---
  if (kw === 'ELSEIF') {
    let ni = -1;
    for (let j = stack.length - 1; j >= 0; j--) {
      if (stack[j].keyword === 'IF') { ni = j; break; }
    }
    if (ni < 0) {
      diagnostics.push({
        line: lineNum, col: pos.col, endCol: pos.endCol,
        msg: 'ELSEIF 没有匹配的 IF', severity: 'error'
      });
    } else if (stack[ni].hasElse) {
      diagnostics.push({
        line: lineNum, col: pos.col, endCol: pos.endCol,
        msg: 'IF 块已有 ELSE，再次遇到 ELSEIF', severity: 'error'
      });
    }
    return;
  }

  // --- UNTIL：REPEAT/UNTIL 循环终止 ---
  // 手册规范：REPEAT 块必须以 UNTIL 条件 + END_REPEAT 结尾
  // 同行的 END_REPEAT 紧随 UNTIL 是合法用法（在 END_REPEAT 分支中跳过报错）
  if (kw === 'UNTIL') {
    let ni = -1;
    for (let j = stack.length - 1; j >= 0; j--) {
      if (stack[j].keyword === 'REPEAT') { ni = j; break; }
    }
    if (ni < 0) {
      diagnostics.push({
        line: lineNum, col: pos.col, endCol: pos.endCol,
        msg: 'UNTIL 没有匹配的 REPEAT', severity: 'error'
      });
    } else {
      // 如果同行没有 END_REPEAT/ENDREPEAT，说明 END_REPEAT 会在下一行，需要记录
      // 如果同行有 END_REPEAT/ENDREPEAT，它们在同一行已形成完整配对，无需记录
      const hasEndRepeatOnSameLine = positions.some(p =>
        p.keyword === 'END_REPEAT' || p.keyword === 'ENDREPEAT'
      );
      if (!hasEndRepeatOnSameLine) {
        untiledRepeats.push(stack[ni].line);
      }
      stack.splice(ni, 1);
    }
    return;
  }

  // --- EXIT：标记循环块为已退出，但不弹出；嵌套条件块标记 exited=true（不报 unclosed warning）--
  if (kw === 'EXIT') {
    let loopIdx = -1;
    for (let j = stack.length - 1; j >= 0; j--) {
      if (LOOP_OPENERS.has(stack[j].keyword)) { loopIdx = j; break; }
    }
    if (loopIdx >= 0) {
      // 标记循环块为已退出，但不移除
      stack[loopIdx].exited = true;
      // 其上方的嵌套块标记 exited=true
      for (let j = loopIdx - 1; j >= 0; j--) {
        if (stack[j].keyword === 'IF') stack[j].exited = true;
      }
    }
    // EXIT 不入栈；无循环块时不报错
    return;
  }
}

// 文件结束时未关闭的块检查
function validateUnclosedBlocks(stack) {
  const diagnostics = [];
  for (const block of stack) {
    if (block.exited) continue; // EXIT 已跳出，跳过此块
    diagnostics.push({
      line: block.line, col: 0, endCol: 0,
      msg: `${block.keyword} 块缺少对应的 END_（文件结束）`,
      severity: 'warning'
    });
  }
  return diagnostics;
}

// GOTO 标签引用验证
function validateGotoReferences(gotoRefs, nLabels) {
  const diagnostics = [];
  for (const ref of gotoRefs) {
    if (!nLabels.has(ref.target)) {
      diagnostics.push({
        line: ref.line, col: 0, endCol: 0,
        msg: `GOTO 目标 ${ref.target} 不存在`, severity: 'warning'
      });
    }
  }
  return diagnostics;
}

// ============================================================
// 主验证函数
// ============================================================

// 行级验证策略集合（按从左到右顺序执行）
const LINE_VALIDATORS = [
  validateChineseCharacters,
  validateParentheses,
  validateNamedVariables,
  validateVariableAccess,
  validateUnsupportedOperators,
  validateRobotSyntaxPreferences,
  validateConfirmedSingleLineSyntax,
  validatePathExtensionArgs,
  validateStaticFunctionArguments,
  validateStylePreferences
];

function validateDocument(content) {
  const lines = content.split(/\r?\n/);
  const diagnostics = [];
  const stack = []; // 控制流块栈 [{line, keyword, hasElse}]
  const untiledRepeats = []; // 栈：记录已被 UNTIL 关闭但尚未遇到 END_REPEAT 的 REPEAT 行号
  const gotoRefs = []; // GOTO 引用 [{line, target}]
  let pendingMovcLine = 0;
  let currentMovementLine = 0;
  let swaitsigCount = 0;
  let syncoutCount = 0;
  let inStitchOn = false;
  let inWeaveOn = false;
  let inWaitSync = false;
  let inG192 = false;
  let inBlockComment = false; // 跨行块注释状态追踪

  // === 第一遍：收集 N标签 + 检查 %@MACRO ===
  const { nLabels, diagnostics: metaDiagnostics } = collectMetadata(lines);
  diagnostics.push(...metaDiagnostics);

  // === 主循环：逐行处理关键字 ===
  for (let i = 0; i < lines.length; i++) {
    const lineNum = i + 1;
    const raw = lines[i];
    const lineStartInBlock = inBlockComment;
    const stripped = stripCommentsAndStringsWithState(raw, lineStartInBlock);
    const clean = stripped.text;
    inBlockComment = stripped.inBlockComment;
    const positions = getKeywordPositions(clean, true);
    const command = getCommand(clean);

    if (command) {
      if (pendingMovcLine > 0 && command !== 'MOVC' && isMovementCommand(command)) {
        diagnostics.push({
          line: pendingMovcLine, col: 0, endCol: 0,
          msg: 'MOVC 必须成对出现：第一行为中间点，第二行为结束点',
          severity: 'error'
        });
        pendingMovcLine = 0;
      }

      if (command === 'MOVC' && !isSingleLineMovc(clean)) {
        pendingMovcLine = pendingMovcLine > 0 ? 0 : lineNum;
      }

      if (isMovementCommand(command)) {
        currentMovementLine = lineNum;
        swaitsigCount = 0;
        syncoutCount = 0;
      }

      if (command === 'WAIT') {
        currentMovementLine = 0;
        swaitsigCount = 0;
        syncoutCount = 0;
      }

      if (command === 'SWAITSIG' && currentMovementLine > 0) {
        swaitsigCount++;
        if (swaitsigCount > 1) {
          diagnostics.push({
            line: lineNum, col: clean.search(/\bSWAITSIG\b/i), endCol: clean.length,
            msg: '运动单节后只能下 1 个 SWAITSIG；多个条件请用 WAIT() 隔开或改用 G4.16',
            severity: 'error'
          });
        }
      }

      if (command === 'SYNCOUT' && currentMovementLine > 0) {
        syncoutCount++;
        if (syncoutCount > 10) {
          diagnostics.push({
            line: lineNum, col: clean.search(/\bSYNCOUT\b/i), endCol: clean.length,
            msg: '同一有移动量移动单节最多允许 10 个 SYNCOUT',
            severity: 'error'
          });
        }
      }

      if (inStitchOn && command !== 'STITCHOFF') {
        const stitchForbidden = ['MOVJ', 'USERCOR', 'SHIFTON', 'SHIFTOFF', 'OBJCORON', 'OBJCOROFF', 'OBJCORCLEAR', 'SYNCOUT', 'WEAVEON', 'WEAVEOFF', 'WAITSYNC', 'ENDSYNC'];
        if (stitchForbidden.includes(command) || (['MOVL', 'MOVC', 'INCMOVL'].includes(command) && /\bSKIP\b/i.test(clean))) {
          diagnostics.push({
            line: lineNum, col: clean.search(new RegExp('\\b' + command.replace('.', '\\.') + '\\b', 'i')), endCol: clean.length,
            msg: 'STITCHON 生效范围内不支持此指令',
            severity: 'error'
          });
        } else if (command === 'M96') {
          diagnostics.push({
            line: lineNum, col: clean.search(/\bM96\b/i), endCol: clean.length,
            msg: 'STITCHON 生效范围内 M96 中断型副程序触发无效',
            severity: 'warning'
          });
        }
      }

      if (inWeaveOn && command !== 'WEAVEOFF') {
        if (['MOVJ', 'STITCHON', 'STITCHOFF', 'WAITSYNC', 'ENDSYNC'].includes(command)) {
          diagnostics.push({
            line: lineNum, col: clean.search(new RegExp('\\b' + command + '\\b', 'i')), endCol: clean.length,
            msg: 'WEAVEON 生效范围内不支持此指令',
            severity: 'error'
          });
        } else if (command === 'M96') {
          diagnostics.push({
            line: lineNum, col: clean.search(/\bM96\b/i), endCol: clean.length,
            msg: 'WEAVEON 生效范围内 M96 中断型副程序触发无效',
            severity: 'warning'
          });
        }
      }

      if (inWaitSync && command !== 'ENDSYNC') {
        const waitSyncForbidden = ['MOVJ', 'USERCOR', 'G04.1', 'SHIFTON'];
        if (waitSyncForbidden.includes(command) || /^M\d+$/i.test(command)) {
          diagnostics.push({
            line: lineNum, col: clean.search(new RegExp('\\b' + command.replace('.', '\\.') + '\\b', 'i')), endCol: clean.length,
            msg: 'WAITSYNC 生效范围内不支持此指令',
            severity: 'error'
          });
        }
      }

      if (inG192 && command !== 'G192.2') {
        const g192Forbidden = ['MOVJ', 'INCMOVJ', 'MOVC', 'SWAITSIG', 'SYNCOUT', 'WEAVEON', 'WEAVEOFF', 'WAITSYNC', 'ENDSYNC'];
        if (g192Forbidden.includes(command)) {
          diagnostics.push({
            line: lineNum, col: clean.search(new RegExp('\\b' + command.replace('.', '\\.') + '\\b', 'i')), endCol: clean.length,
            msg: 'G192.1 末端跟踪生效范围内不支持此指令',
            severity: 'error'
          });
        }
      }

      if (command === 'STITCHON' && !inWeaveOn) inStitchOn = true;
      else if (command === 'STITCHOFF') inStitchOn = false;

      if (command === 'WEAVEON' && !inStitchOn) inWeaveOn = true;
      else if (command === 'WEAVEOFF') inWeaveOn = false;

      if (command === 'WAITSYNC') inWaitSync = true;
      else if (command === 'ENDSYNC') inWaitSync = false;

      if (command === 'G192.1') inG192 = true;
      else if (command === 'G192.2') inG192 = false;
    }

    // GOTO 目标引用
    const gotoTarget = extractGotoTarget(clean, true);
    if (gotoTarget) gotoRefs.push({ line: lineNum, target: gotoTarget });

    // 按字符位置排序（同行中按从左到右顺序处理关键字）
    positions.sort((a, b) => a.col - b.col);

    // 执行行级验证策略
    for (const validator of LINE_VALIDATORS) {
      const results = validator(raw, lineNum, lineStartInBlock, clean);
      diagnostics.push(...results);
    }

    diagnostics.push(...validateCaseLineStyle(clean, lineNum, stack));

    // 控制流验证：逐个处理关键字
    for (const pos of positions) {
      validateControlFlowKeyword(pos, lineNum, positions, stack, untiledRepeats, diagnostics);
    }
  }

  // === 文件结束时未关闭的块 ===
  diagnostics.push(...validateUnclosedBlocks(stack));

  if (pendingMovcLine > 0) {
    diagnostics.push({
      line: pendingMovcLine, col: 0, endCol: 0,
      msg: 'MOVC 必须成对出现：第一行为中间点，第二行为结束点',
      severity: 'error'
    });
  }

  // === GOTO 标签引用验证 ===
  diagnostics.push(...validateGotoReferences(gotoRefs, nLabels));

  return diagnostics;
}

exports.validateDocument = validateDocument;
exports.stripCommentsAndStrings = stripCommentsAndStrings;
exports.getKeywordPositions = getKeywordPositions;
exports.isNLabelLine = isNLabelLine;
