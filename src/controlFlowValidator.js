// Control-flow stack validation for Syntec macro blocks.

const OPENER_KEYWORDS = new Set(['IF', 'FOR', 'WHILE', 'CASE', 'REPEAT']);

const CLOSER_TO_OPENER = {
  'END_IF':     'IF',    'END_FOR':    'FOR',    'END_WHILE':  'WHILE',
  'END_CASE':   'CASE',  'END_REPEAT': 'REPEAT',
  'ENDIF':      'IF',    'ENDFOR':     'FOR',    'ENDWHILE':   'WHILE',
  'ENDCASE':    'CASE',  'ENDREPEAT':  'REPEAT'
};

const LOOP_OPENERS = new Set(['FOR', 'WHILE', 'REPEAT']);

function createControlFlowState() {
  return {
    stack: [],
    untiledRepeats: []
  };
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

function validateControlFlowKeyword(pos, lineNum, positions, state, diagnostics) {
  const kw = pos.keyword;
  const stack = state.stack;
  const untiledRepeats = state.untiledRepeats;

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

  if (OPENER_KEYWORDS.has(kw)) {
    stack.push({ line: lineNum, keyword: kw, hasElse: false });
    return;
  }

  if (kw in CLOSER_TO_OPENER) {
    let skipThisKw = false;
    if (kw === 'END_REPEAT' || kw === 'ENDREPEAT') {
      if (positions.some(p => p.keyword === 'UNTIL')) {
        skipThisKw = true;
      } else if (untiledRepeats.length > 0) {
        untiledRepeats.pop();
        skipThisKw = true;
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

  if (kw === 'EXIT') {
    let loopIdx = -1;
    for (let j = stack.length - 1; j >= 0; j--) {
      if (LOOP_OPENERS.has(stack[j].keyword)) { loopIdx = j; break; }
    }
    if (loopIdx >= 0) {
      stack[loopIdx].exited = true;
      for (let j = loopIdx - 1; j >= 0; j--) {
        if (stack[j].keyword === 'IF') stack[j].exited = true;
      }
    }
  }
}

function validateUnclosedBlocks(stack) {
  const diagnostics = [];
  for (const block of stack) {
    if (block.exited) continue;
    diagnostics.push({
      line: block.line, col: 0, endCol: 0,
      msg: `${block.keyword} 块缺少对应的 END_（文件结束）`,
      severity: 'warning'
    });
  }
  return diagnostics;
}

module.exports = {
  createControlFlowState,
  validateCaseLineStyle,
  validateControlFlowKeyword,
  validateUnclosedBlocks
};
