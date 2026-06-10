// syntec-macro v2.0.1 - validator.js
// 语法诊断：括号匹配、IF/END_IF配对、控制流检查、中文字符检测
// v1.3.6: 修复 GOTO 语法（GOTO 100 而非 GOTO N100），移除 INT 函数，修正 N 标签格式
// v1.3.6: 修复所有中文乱码
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
  'ENDCASE':    'CASE',  'ENDREPEAT':  'REPEAT',
};

// 循环类开启关键字（EXIT 专用）
const LOOP_OPENERS = new Set(['FOR', 'WHILE', 'REPEAT']);

// ============================================================
// 工具函数
// ============================================================

// 去除字符串和注释，保留代码逻辑
// 字符串内容用空格替换，边界引号也去除
function stripCommentsAndStrings(line) {
  let result = '';
  let inString = false;
  let i = 0;
  while (i < line.length) {
    // 行注释 //
    if (!inString && line.substring(i, i + 2) === '//') {
      result += ' '.repeat(line.length - i);
      break;
    }
    // 块注释 (* *)
    if (!inString && line.substring(i, i + 2) === '(*') {
      const end = line.indexOf('*)', i + 2);
      const endIdx = end >= 0 ? end + 2 : line.length;
      result += ' '.repeat(endIdx - i);
      i = endIdx;
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
      } else {
        // 被转义，" 是字符串内容，不切换 inString
        // 在结果中保留一个空格占位
        if (inString) result += ' ';
      }
    } else {
      result += inString ? ' ' : line[i];
    }
    i++;
  }
  return result;
}

// 获取关键字在行中的位置（防止 ENDREPEAT/REPEAT 等子串冲突）
// 策略：用下划线占位法，先把长替代关键字替换成等长占位符，再匹配
function getKeywordPositions(line) {
  const clean = stripCommentsAndStrings(line);

  // 第一步：把长替代关键字替换成等长占位符（防止 ENDREPEAT 内的 REPEAT 被误匹配）
  // 顺序：越长越先替换（ENDREPEAT > ENDFOR > ... > REPEAT > UNTIL）
  const subs = [
    'ENDREPEAT', 'ENDFOR', 'ENDWHILE', 'ENDCASE', 'ENDIF',
    'END_REPEAT', 'END_FOR', 'END_WHILE', 'END_CASE', 'END_IF',
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
    'GOTO',
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
function extractGotoTarget(line) {
  const clean = stripCommentsAndStrings(line);
  const m = clean.match(/\bGOTO\s+(\d+)(?!\w)/i);
  if (m) return m[1] || null;
  return null;
}

// ============================================================
// 主验证函数
// ============================================================
function validateDocument(content) {
  const lines = content.split(/\r?\n/);
  const diagnostics = [];
  const stack = []; // 控制流块栈 [{line, keyword, hasElse}]
  const untiledRepeats = []; // 栈：记录已被 UNTIL 关闭但尚未遇到 END_REPEAT 的 REPEAT 行号

  // === 第一遍：收集 N标签 + 检查 %@MACRO ===
  const nLabels = new Set();
  let firstNonCommentIdx = -1;
  let hasMacroHeader = false;
  let firstNonCommentIsBarePercent = false; // % 后面不是 @ 或者只有 %

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();

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

  // 第一行以 % 且无 %@MACRO → 警告
  if (firstNonCommentIsBarePercent && !hasMacroHeader) {
    const first = lines[firstNonCommentIdx].trim();
    diagnostics.push({
      line: firstNonCommentIdx + 1, col: 0, endCol: first.length,
      msg: '此文件缺少 %@MACRO 文件头，将被视为 ISO 格式文件',
      severity: 'warning',
    });
  }

  // === 主循环：逐行处理关键字 ===
  const gotoRefs = []; // GOTO 引用 [{line, target}]

  for (let i = 0; i < lines.length; i++) {
    const lineNum = i + 1;
    const raw = lines[i];
    const positions = getKeywordPositions(raw);

    // GOTO 目标引用
    const gotoTarget = extractGotoTarget(raw);
    if (gotoTarget) gotoRefs.push({ line: lineNum, target: gotoTarget });

    // 按字符位置排序（同行中按从左到右顺序处理关键字）
    positions.sort((a, b) => a.col - b.col);

    // --- 中文字符检查 ---
    (() => {
      const CJK_PUNCT = /[；：，。！？【】《》（）""''、]/;
      const CJK_CHAR  = /[\u4e00-\u9fff\u3400-\u4dbf]/;
      let inStr = false, inBC = false;
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
      if (hasCJK) diagnostics.push({ line: lineNum, col: firstCJK, endCol: firstCJK + 1,
        msg: '中文字符：宏程序只允许使用英文字符', severity: 'error' });
      for (const p of puncts) diagnostics.push({ line: lineNum, col: p.col, endCol: p.col + 1,
        msg: `中文标点 "${p.ch}"：宏程序应使用英文字符`, severity: 'error' });
    })();

    // --- 括号匹配 ---
    (() => {
      const clean = stripCommentsAndStrings(lines[i]);
      if (!clean.trim()) return;
      const parenStack = [];
      let inStr = false;
      for (let ci = 0; ci < clean.length; ci++) {
        if (clean[ci] === '"') inStr = !inStr;
        if (inStr) continue;
        if (clean[ci] === '(') parenStack.push(ci);
        else if (clean[ci] === ')') {
          if (parenStack.length === 0) {
            diagnostics.push({ line: lineNum, col: ci, endCol: ci + 1,
              msg: '括号不匹配：多余的右括号', severity: 'warning' });
          } else { parenStack.pop(); }
        }
      }
      if (parenStack.length > 0) {
        diagnostics.push({ line: lineNum, col: parenStack[0], endCol: parenStack[0] + 1,
          msg: `括号不匹配：缺少 ${parenStack.length} 个右括号`, severity: 'warning' });
      }
    })();

    for (const pos of positions) {
      const kw = pos.keyword;

      // --- 不支持的语法 ---
      if (pos.unsupported) {
        let msg = '';
        if (kw === 'ELSIF') msg = 'ELSIF 不支持，请使用 ELSEIF';
        else msg = `${kw} 是不支持的语法`;
        diagnostics.push({
          line: lineNum, col: pos.col, endCol: pos.endCol,
          msg, severity: 'error',
        });
        continue;
      }

      // --- 开启关键字 ---
      if (OPENER_KEYWORDS.has(kw)) {
        stack.push({ line: lineNum, keyword: kw, hasElse: false });
      }

      // --- 关闭关键字 ---
      else if (kw in CLOSER_TO_OPENER) {
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
        if (skipThisKw) continue;

        const opener = CLOSER_TO_OPENER[kw];
        let matchIdx = -1;
        for (let j = stack.length - 1; j >= 0; j--) {
          if (stack[j].keyword === opener) { matchIdx = j; break; }
        }
        if (matchIdx >= 0) {
          stack.splice(matchIdx, 1);
        } else {
          diagnostics.push({
            line: lineNum, col: pos.col, endCol: pos.endCol,
            msg: `${kw} 没有匹配的 ${opener}`,
            severity: 'error',
          });
        }
      }

      // --- ELSE ---
      else if (kw === 'ELSE') {
        const valid = ['IF', 'CASE'];
        let ni = -1;
        for (let j = stack.length - 1; j >= 0; j--) {
          if (valid.includes(stack[j].keyword)) { ni = j; break; }
        }
        if (ni < 0) {
          diagnostics.push({
            line: lineNum, col: pos.col, endCol: pos.endCol,
            msg: 'ELSE 没有匹配的 IF 或 CASE', severity: 'error',
          });
        } else {
          for (let j = ni; j >= 0; j--) {
            if (stack[j].keyword === 'IF') { stack[j].hasElse = true; break; }
          }
        }
      }

      // --- ELSEIF ---
      else if (kw === 'ELSEIF') {
        let ni = -1;
        for (let j = stack.length - 1; j >= 0; j--) {
          if (stack[j].keyword === 'IF') { ni = j; break; }
        }
        if (ni < 0) {
          diagnostics.push({
            line: lineNum, col: pos.col, endCol: pos.endCol,
            msg: 'ELSEIF 没有匹配的 IF', severity: 'error',
          });
        } else if (stack[ni].hasElse) {
          diagnostics.push({
            line: lineNum, col: pos.col, endCol: pos.endCol,
            msg: 'IF 块已有 ELSE，再次遇到 ELSEIF', severity: 'error',
          });
        }
      }

      // --- UNTIL：REPEAT/UNTIL 循环终止 ---
      // 手册规范：REPEAT 块必须以 UNTIL 条件 + END_REPEAT 结尾
      // 同行的 END_REPEAT 紧随 UNTIL 是合法用法（在 END_REPEAT 分支中跳过报错）
      else if (kw === 'UNTIL') {
        let ni = -1;
        for (let j = stack.length - 1; j >= 0; j--) {
          if (stack[j].keyword === 'REPEAT') { ni = j; break; }
        }
        if (ni < 0) {
          diagnostics.push({
            line: lineNum, col: pos.col, endCol: pos.endCol,
            msg: 'UNTIL 没有匹配的 REPEAT', severity: 'error',
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
      }

      // --- EXIT：弹出最近的循环块；嵌套条件块标记 exited=true（不报 unclosed warning）--
      else if (kw === 'EXIT') {
        let loopIdx = -1;
        for (let j = stack.length - 1; j >= 0; j--) {
          if (LOOP_OPENERS.has(stack[j].keyword)) { loopIdx = j; break; }
        }
        if (loopIdx >= 0) {
          // 移除循环块；其上方的嵌套块标记 exited=true
          for (let j = loopIdx - 1; j >= 0; j--) {
            if (stack[j].keyword === 'IF') stack[j].exited = true;
          }
          stack.splice(loopIdx, 1);
        }
        // EXIT 不入栈；无循环块时不报错
      }
    }
  }

  // === 文件结束时未关闭的块 ===
  for (const block of stack) {
    if (block.exited) continue; // EXIT 已跳出，跳过此块
    diagnostics.push({
      line: block.line, col: 0, endCol: 0,
      msg: `${block.keyword} 块缺少对应的 END_（文件结束）`,
      severity: 'warning',
    });
  }

  // === GOTO 标签引用验证 ===
  for (const ref of gotoRefs) {
    if (!nLabels.has(ref.target)) {
      diagnostics.push({
        line: ref.line, col: 0, endCol: 0,
        msg: `GOTO 目标 ${ref.target} 不存在`, severity: 'warning',
      });
    }
  }

  return diagnostics;
}

exports.validateDocument = validateDocument;
exports.stripCommentsAndStrings = stripCommentsAndStrings;
exports.getKeywordPositions = getKeywordPositions;
exports.isNLabelLine = isNLabelLine;
