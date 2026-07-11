// validator.js
// 语法诊断：括号匹配、IF/END_IF配对、控制流检查、中文字符检测
// ============================================================
// 块关键字定义
// ============================================================

const { validateStaticFunctionArguments } = require('./functionArgumentValidator');
const {
  validateRobotSyntaxPreferences,
  validateConfirmedSingleLineSyntax,
  getCommand,
  createRobotState,
  validateRobotLineState,
  finalizeRobotState
} = require('./robotValidator');
const {
  createControlFlowState,
  validateCaseLineStyle,
  validateControlFlowLine,
  validateUnclosedBlocks
} = require('./controlFlowValidator');
const { DiagnosticCode } = require('./diagnosticCodes');
const { createError, createWarning, normalizeDiagnostics } = require('./diagnosticFactory');
const { createLineRule, getRuleIds, runLineRules } = require('./diagnosticRules');
const {
  classifyStatement,
  getStatementTerminatorInfo,
  isMacroHeaderLine
} = require('./statementClassifier');

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

function createLineContext(raw, lineStartInBlock) {
  const stripped = stripCommentsAndStringsWithState(raw, lineStartInBlock);
  const clean = stripped.text;
  return {
    raw,
    clean,
    trimmed: clean.trim(),
    statementKind: classifyStatement(clean),
    terminator: getStatementTerminatorInfo(clean),
    positions: getKeywordPositions(clean, true).sort((a, b) => a.col - b.col),
    command: getCommand(clean),
    inBlockComment: stripped.inBlockComment
  };
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
    diagnostics.push(createWarning(firstNonCommentIdx + 1, 0, first.length, '此文件缺少 %@MACRO 文件头，将被视为 ISO 格式文件'));
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
    diagnostics.push(createError(lineNum, firstCJK, firstCJK + 1, '中文字符：宏程序只允许使用英文字符'));
  }
  for (const p of puncts) {
    diagnostics.push(createError(lineNum, p.col, p.col + 1, `中文标点 "${p.ch}"：宏程序应使用英文字符`));
  }
  return normalizeDiagnostics(diagnostics);
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
        diagnostics.push(createWarning(lineNum, ci, ci + 1, '括号不匹配：多余的右括号'));
      } else { parenStack.pop(); }
    }
  }
  if (parenStack.length > 0) {
    diagnostics.push(createWarning(lineNum, parenStack[0], parenStack[0] + 1, `括号不匹配：缺少 ${parenStack.length} 个右括号`));
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
    diagnostics.push(createError(lineNum, col, col + variable.length, `${variable} 是不支持的命名变量；请使用数字变量编号`, {
      code: variable.startsWith('#') ? DiagnosticCode.NAMED_LOCAL_VARIABLE : DiagnosticCode.NAMED_GLOBAL_VARIABLE
    }));
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
    diagnostics.push(createWarning(lineNum, col, col + match[2].length, `${match[2]} 为 VACANT，只读，不建议作为赋值目标`, {
      code: DiagnosticCode.VACANT_ASSIGNMENT
    }));
  }

  const directBadAppVarRe = /\b(?:AR|MAR)(?:-\d+(?:\.\d*)?|\d+\.\d+)\b/ig;
  while ((match = directBadAppVarRe.exec(clean)) !== null) {
    diagnostics.push(createError(lineNum, match.index, match.index + match[0].length, `${match[0].toUpperCase()} 不是合法 APP 变量编号；AR/MAR 直接编号必须为非负整数`, {
      code: DiagnosticCode.INVALID_APP_VARIABLE_NUMBER
    }));
  }

  const indirectBadAppVarRe = /\b(?:AR|MAR)\[\s*(-\d+(?:\.\d*)?|\d+\.\d+)\s*\]/ig;
  while ((match = indirectBadAppVarRe.exec(clean)) !== null) {
    diagnostics.push(createError(lineNum, match.index, match.index + match[0].length, `${match[0].toUpperCase()} 不是合法 APP 变量编号；AR/MAR 间接静态编号必须为非负整数`, {
      code: DiagnosticCode.INVALID_APP_VARIABLE_NUMBER
    }));
  }

  return diagnostics;
}

// 风格建议：保留兼容语法，但推荐生成更一致的标准写法
function validateStylePreferences(_raw, lineNum, _lineStartInBlock, cleanLine) {
  const clean = cleanLine === undefined ? '' : cleanLine;
  if (!clean.trim()) return [];

  const diagnostics = [];

  const assignmentRe = /^\s*(?:[#@](?:\d+|\[[^\]]+\])|(?:AR|MAR)(?:\d+|\[[^\]]+\]))\s*=(?!=)/;
  const assignmentMatch = clean.match(assignmentRe);
  if (assignmentMatch) {
    const col = clean.indexOf('=', assignmentMatch[0].lastIndexOf('='));
    diagnostics.push(createWarning(lineNum, col, col + 1, '赋值使用 = 支援但不推荐；建议使用 :=', {
      code: DiagnosticCode.ASSIGNMENT_STYLE_EQUALS
    }));
  }

  return diagnostics;
}

function validateUnsupportedOperators(_raw, lineNum, _lineStartInBlock, cleanLine) {
  const clean = cleanLine === undefined ? '' : cleanLine;
  if (!clean.trim() || isMacroHeaderLine(clean.trim())) return [];

  const diagnostics = [];
  let match;
  const equalityRe = /==/g;
  while ((match = equalityRe.exec(clean)) !== null) {
    diagnostics.push(createError(lineNum, match.index, match.index + 2, '== 不支持；等于比较请使用单独的 =', {
      code: DiagnosticCode.UNSUPPORTED_EQUALITY_OPERATOR
    }));
  }

  const inequalityRe = /!=/g;
  while ((match = inequalityRe.exec(clean)) !== null) {
    diagnostics.push(createError(lineNum, match.index, match.index + 2, '!= 不支持；不等于比较请使用 <>', {
      code: DiagnosticCode.UNSUPPORTED_INEQUALITY_OPERATOR
    }));
  }

  const unsupportedOperators = [
    { re: /&&/g, msg: '&& 不支持；逻辑且请使用 AND 或 &', code: DiagnosticCode.UNSUPPORTED_LOGICAL_AND_OPERATOR },
    { re: /\|\|/g, msg: '|| 不支持；逻辑或请使用 OR', code: DiagnosticCode.UNSUPPORTED_LOGICAL_OR_OPERATOR },
    { re: /\+=/g, msg: '+= 不支持；请写成 #1 := #1 + 1 这类完整赋值', code: DiagnosticCode.UNSUPPORTED_COMPOUND_ASSIGNMENT },
    { re: /\+\+/g, msg: '++ 不支持；请写成 #1 := #1 + 1 这类完整赋值', code: DiagnosticCode.UNSUPPORTED_INCREMENT },
    { re: /(?<=\S)\s*%(?!=)\s*(?=\S)/g, msg: '% 不支持；取模请使用 MOD，且仅适用于 Long 型态', code: DiagnosticCode.UNSUPPORTED_PERCENT_OPERATOR },
    { re: /!(?!=)/g, msg: '! 不支持；NOT 是补数运算，逻辑条件请写成明确比较', code: DiagnosticCode.UNSUPPORTED_LOGICAL_NOT_OPERATOR }
  ];
  for (const rule of unsupportedOperators) {
    while ((match = rule.re.exec(clean)) !== null) {
      diagnostics.push(createError(lineNum, match.index, match.index + match[0].length, rule.msg, {
        code: rule.code
      }));
    }
  }

  const staticModRe = /((?:\d+\.\d*|\.\d+)|\d+)\s+MOD\s+((?:\d+\.\d*|\.\d+)|\d+)/ig;
  while ((match = staticModRe.exec(clean)) !== null) {
    if (match[1].includes('.') || match[2].includes('.')) {
      diagnostics.push(createError(lineNum, match.index, match.index + match[0].length, 'MOD 仅适用于 Long 型态；静态数字操作数不可带小数点'));
    }
  }

  const fanucComparisonRe = /\b(EQ|NE|GT|GE|LT|LE)\b/g;
  const fanucReplacement = {
    EQ: '=',
    NE: '<>',
    GT: '>',
    GE: '>=',
    LT: '<',
    LE: '<='
  };
  while ((match = fanucComparisonRe.exec(clean)) !== null) {
    const keyword = match[1];
    diagnostics.push(createError(lineNum, match.index, match.index + keyword.length, `${keyword} 不支持；请使用 ${fanucReplacement[keyword]}`, {
      code: DiagnosticCode.UNSUPPORTED_FANUC_COMPARISON
    }));
  }

  return diagnostics;
}

function validateDanglingComparisonExpression(_raw, lineNum, _lineStartInBlock, cleanLine) {
  const clean = cleanLine === undefined ? '' : cleanLine;
  const trimmed = clean.trim();
  if (!trimmed || isMacroHeaderLine(trimmed)) return [];

  const diagnostics = [];
  const statement = trimmed.replace(/;\s*$/, '').trim();
  if (/^(?:IF|ELSEIF|WHILE|UNTIL)\b/i.test(statement)) return [];
  if (/(?::=|==|!=|&&|\|\|)/.test(statement)) return [];

  if (/^[#@\[(+\-.\d]/.test(statement) && /(?:<>|<=|>=|<|>)/.test(statement)) {
    const col = clean.search(/\S/);
    diagnostics.push(createError(lineNum, col, col + statement.length, '比较表达式不能单独成行；请放在 IF/ELSEIF/WHILE/UNTIL 条件中，或写成赋值/完整语句'));
  }

  return diagnostics;
}

function validateStatementTerminator(_raw, lineNum, _lineStartInBlock, cleanLine) {
  const clean = cleanLine === undefined ? '' : cleanLine;
  const trimmed = clean.trim();
  if (!trimmed || isMacroHeaderLine(trimmed)) return [];

  const diagnostics = [];
  if (/^%$/.test(trimmed) || /[；：，。！？【】《》（）""''、]/.test(trimmed)) return diagnostics;
  const terminator = getStatementTerminatorInfo(clean);
  const kind = classifyStatement(clean);
  if (terminator.hasSemicolon && ['blockHeader', 'branch', 'caseLabel'].includes(kind)) {
    const semicolonCol = terminator.semicolonCol >= 0 ? terminator.semicolonCol : terminator.endCol;
    diagnostics.push(createError(lineNum, Math.max(0, semicolonCol), Math.max(0, semicolonCol + 1), '控制结构行不应以 ; 结尾', {
      code: DiagnosticCode.CONTROL_STRUCTURE_TRAILING_SEMICOLON
    }));
    return diagnostics;
  }
  if (terminator.hasSemicolon) return diagnostics;

  if (['blockHeader', 'branch', 'caseLabel', 'danglingComparison'].includes(kind)) return diagnostics;

  if (/\S/.test(clean)) {
    diagnostics.push(createError(lineNum, Math.max(0, terminator.endCol), Math.max(0, terminator.endCol + 1), '语句应以 ; 结尾', {
      code: DiagnosticCode.MISSING_SEMICOLON
    }));
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
      diagnostics.push(createError(lineNum, match.index, match.index + match[0].length, `路径扩充引数 ,${arg}_ 不存在；仅确认支持 ,C_ / ,R_ / ,A_`));
    }
  }

  return diagnostics;
}

// GOTO 标签引用验证
function validateGotoReferences(gotoRefs, nLabels) {
  const diagnostics = [];
  for (const ref of gotoRefs) {
    if (!nLabels.has(ref.target)) {
      diagnostics.push(createWarning(ref.line, 0, 0, `GOTO 目标 ${ref.target} 不存在`));
    }
  }
  return diagnostics;
}

// ============================================================
// 主验证函数
// ============================================================

// 行级验证规则集合（按从左到右顺序执行）
const LINE_VALIDATOR_RULES = [
  createLineRule('chinese-characters', validateChineseCharacters),
  createLineRule('parentheses', validateParentheses),
  createLineRule('named-variables', validateNamedVariables),
  createLineRule('variable-access', validateVariableAccess),
  createLineRule('unsupported-operators', validateUnsupportedOperators),
  createLineRule('dangling-comparison-expression', validateDanglingComparisonExpression),
  createLineRule('statement-terminator', validateStatementTerminator),
  createLineRule('robot-syntax-preferences', validateRobotSyntaxPreferences),
  createLineRule('confirmed-single-line-syntax', validateConfirmedSingleLineSyntax),
  createLineRule('path-extension-args', validatePathExtensionArgs),
  createLineRule('static-function-arguments', validateStaticFunctionArguments),
  createLineRule('style-preferences', validateStylePreferences)
];

function validateDocument(content) {
  const lines = content.split(/\r?\n/);
  const diagnostics = [];
  const controlFlowState = createControlFlowState();
  const gotoRefs = []; // GOTO 引用 [{line, target}]
  const robotState = createRobotState();
  let inBlockComment = false; // 跨行块注释状态追踪

  // === 第一遍：收集 N标签 + 检查 %@MACRO ===
  const { nLabels, diagnostics: metaDiagnostics } = collectMetadata(lines);
  diagnostics.push(...metaDiagnostics);

  // === 主循环：逐行处理关键字 ===
  for (let i = 0; i < lines.length; i++) {
    const lineNum = i + 1;
    const lineStartInBlock = inBlockComment;
    const line = createLineContext(lines[i], lineStartInBlock);
    inBlockComment = line.inBlockComment;

    const inConditionalBranch = controlFlowState.stack.some(block =>
      block.keyword === 'IF' || block.keyword === 'CASE'
    );
    diagnostics.push(...validateRobotLineState(robotState, line.clean, line.command, lineNum, inConditionalBranch));

    // GOTO 目标引用
    const gotoTarget = extractGotoTarget(line.clean, true);
    if (gotoTarget) gotoRefs.push({ line: lineNum, target: gotoTarget });

    diagnostics.push(...runLineRules(LINE_VALIDATOR_RULES, line, lineNum, lineStartInBlock));

    diagnostics.push(...validateCaseLineStyle(line.clean, lineNum, controlFlowState.stack));

    validateControlFlowLine(line, lineNum, controlFlowState, diagnostics);
  }

  // === 文件结束时未关闭的块 ===
  diagnostics.push(...validateUnclosedBlocks(controlFlowState.stack));

  diagnostics.push(...finalizeRobotState(robotState));

  // === GOTO 标签引用验证 ===
  diagnostics.push(...validateGotoReferences(gotoRefs, nLabels));

  return diagnostics;
}

exports.validateDocument = validateDocument;
exports.stripCommentsAndStrings = stripCommentsAndStrings;
exports.getKeywordPositions = getKeywordPositions;
exports.isNLabelLine = isNLabelLine;
exports.getLineValidatorRuleIds = () => getRuleIds(LINE_VALIDATOR_RULES);
