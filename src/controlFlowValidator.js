// Control-flow stack validation for Syntec macro blocks.

const { DiagnosticCode } = require('./diagnosticCodes');
const { createError, createWarning } = require('./diagnosticFactory');

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
    untilClosedRepeats: []
  };
}

function getControlFlowLineFacts(lineContext) {
  return {
    hasUntil: lineContext.positions.some(p => p.keyword === 'UNTIL'),
    hasEndRepeat: lineContext.positions.some(p =>
      p.keyword === 'END_REPEAT' || p.keyword === 'ENDREPEAT'
    )
  };
}

function validateCaseLineStyle(cleanLine, lineNum, stack) {
  const diagnostics = [];
  const top = stack[stack.length - 1];
  if (!top || top.keyword !== 'CASE') return diagnostics;

  // DEFAULT 支援但不推荐
  const defaultMatch = cleanLine.match(/\bDEFAULT\b\s*:/i);
  if (defaultMatch) {
    diagnostics.push(createWarning(lineNum, defaultMatch.index, defaultMatch[0].length, 'DEFAULT 支援但不推荐；建议使用 ELSE'));
    return diagnostics;
  }

  if (/^\s*(?:[#@]?(?:\d+|\[[^\]]+\])|[A-Za-z][A-Za-z0-9_]*)(?:\s*,\s*(?:[#@]?(?:\d+|\[[^\]]+\])|[A-Za-z][A-Za-z0-9_]*))*\s*:\s*;\s*$/i.test(cleanLine)) return diagnostics;

  const branchMatch = cleanLine.match(/^\s*(?:[#@]?(?:\d+|\[[^\]]+\])|[A-Za-z][A-Za-z0-9_]*)(?:\s*,\s*(?:[#@]?(?:\d+|\[[^\]]+\])|[A-Za-z][A-Za-z0-9_]*))*\s*:(?!=)\s*(\S.*)$/);
  if (branchMatch) {
    diagnostics.push(createWarning(lineNum, cleanLine.indexOf(branchMatch[1]), cleanLine.length, 'CASE 分支标签后同行陈述支援但不推荐；建议换行缩排陈述列表'));
  }

  const elseMatch = cleanLine.match(/^\s*ELSE\s+(\S.*)$/);
  if (elseMatch) {
    diagnostics.push(createWarning(lineNum, cleanLine.indexOf(elseMatch[1]), cleanLine.length, 'CASE ELSE 后同行陈述支援但不推荐；建议换行缩排陈述列表'));
  }

  return diagnostics;
}

function validateControlFlowKeyword(pos, lineNum, lineFacts, state, diagnostics) {
  const kw = pos.keyword;
  const stack = state.stack;
  const untilClosedRepeats = state.untilClosedRepeats;

  if (pos.unsupported) {
    let msg = '';
    let code;
    if (kw === 'ELSIF') {
      msg = 'ELSIF 不支持，请使用 ELSEIF';
      code = DiagnosticCode.UNSUPPORTED_ELSIF;
    } else if (kw === 'DIV') {
      msg = 'DIV 不支持；整数除法请使用 /，分子与分母皆为整数时结果仍为整数';
      code = DiagnosticCode.UNSUPPORTED_DIV;
    } else msg = `${kw} 是不支持的语法`;
    diagnostics.push(createError(lineNum, pos.col, pos.endCol, msg, { code }));
    return;
  }

  if (OPENER_KEYWORDS.has(kw)) {
    stack.push({ line: lineNum, keyword: kw, hasElse: false });
    return;
  }

  if (kw in CLOSER_TO_OPENER) {
    let skipThisKw = false;
    if (kw === 'END_REPEAT' || kw === 'ENDREPEAT') {
      if (lineFacts.hasUntil) {
        skipThisKw = true;
      } else if (untilClosedRepeats.length > 0) {
        untilClosedRepeats.pop();
        skipThisKw = true;
      }
    }
    if (skipThisKw) return;

    const opener = CLOSER_TO_OPENER[kw];
    const top = stack[stack.length - 1];
    if (top && top.keyword === opener) {
      stack.pop();
    } else if (top) {
      diagnostics.push(createError(lineNum, pos.col, pos.endCol, `${kw} 嵌套顺序错误：当前未闭合的是 ${top.keyword}`, {
        code: DiagnosticCode.CONTROL_NESTING_ORDER
      }));
      let matchIdx = -1;
      for (let j = stack.length - 2; j >= 0; j--) {
        if (stack[j].keyword === opener) { matchIdx = j; break; }
      }
      if (matchIdx >= 0) stack.splice(matchIdx);
    } else {
      diagnostics.push(createError(lineNum, pos.col, pos.endCol, `${kw} 没有匹配的 ${opener}`, {
        code: DiagnosticCode.CONTROL_UNMATCHED_END
      }));
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
      diagnostics.push(createError(lineNum, pos.col, pos.endCol, 'ELSE 没有匹配的 IF 或 CASE', {
        code: DiagnosticCode.CONTROL_UNMATCHED_ELSE
      }));
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
      diagnostics.push(createError(lineNum, pos.col, pos.endCol, 'ELSEIF 没有匹配的 IF', {
        code: DiagnosticCode.CONTROL_UNMATCHED_ELSEIF
      }));
    } else if (stack[ni].hasElse) {
      diagnostics.push(createError(lineNum, pos.col, pos.endCol, 'IF 块已有 ELSE，再次遇到 ELSEIF', {
        code: DiagnosticCode.CONTROL_ELSEIF_AFTER_ELSE
      }));
    }
    return;
  }

  if (kw === 'UNTIL') {
    let ni = -1;
    for (let j = stack.length - 1; j >= 0; j--) {
      if (stack[j].keyword === 'REPEAT') { ni = j; break; }
    }
    if (ni < 0) {
      diagnostics.push(createError(lineNum, pos.col, pos.endCol, 'UNTIL 没有匹配的 REPEAT', {
        code: DiagnosticCode.CONTROL_UNMATCHED_UNTIL
      }));
    } else {
      if (!lineFacts.hasEndRepeat) {
        untilClosedRepeats.push(stack[ni].line);
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

function validateControlFlowLine(lineContext, lineNum, state, diagnostics) {
  const lineFacts = getControlFlowLineFacts(lineContext);
  for (const pos of lineContext.positions) {
    validateControlFlowKeyword(pos, lineNum, lineFacts, state, diagnostics);
  }
}

function validateUnclosedBlocks(stack) {
  const diagnostics = [];
  for (const block of stack) {
    if (block.exited) continue;
    diagnostics.push(createWarning(block.line, 0, 0, `${block.keyword} 块缺少对应的 END_（文件结束）`, {
      code: DiagnosticCode.CONTROL_UNCLOSED_BLOCK,
      keyword: block.keyword
    }));
  }
  return diagnostics;
}

module.exports = {
  createControlFlowState,
  validateCaseLineStyle,
  validateControlFlowKeyword,
  validateControlFlowLine,
  validateUnclosedBlocks
};
