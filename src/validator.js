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
  const unsupportedKws = ['ELSIF'];
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

// 控制流关键字验证：处理单个关键字的栈操作和错误报告
function validateControlFlowKeyword(pos, lineNum, positions, stack, untiledRepeats, diagnostics) {
  const kw = pos.keyword;

  // --- 不支持的语法 ---
  if (pos.unsupported) {
    let msg = '';
    if (kw === 'ELSIF') msg = 'ELSIF 不支持，请使用 ELSEIF';
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
  validateParentheses
];

function validateDocument(content) {
  const lines = content.split(/\r?\n/);
  const diagnostics = [];
  const stack = []; // 控制流块栈 [{line, keyword, hasElse}]
  const untiledRepeats = []; // 栈：记录已被 UNTIL 关闭但尚未遇到 END_REPEAT 的 REPEAT 行号
  const gotoRefs = []; // GOTO 引用 [{line, target}]
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

    // 控制流验证：逐个处理关键字
    for (const pos of positions) {
      validateControlFlowKeyword(pos, lineNum, positions, stack, untiledRepeats, diagnostics);
    }
  }

  // === 文件结束时未关闭的块 ===
  diagnostics.push(...validateUnclosedBlocks(stack));

  // === GOTO 标签引用验证 ===
  diagnostics.push(...validateGotoReferences(gotoRefs, nLabels));

  return diagnostics;
}

exports.validateDocument = validateDocument;
exports.stripCommentsAndStrings = stripCommentsAndStrings;
exports.getKeywordPositions = getKeywordPositions;
exports.isNLabelLine = isNLabelLine;
