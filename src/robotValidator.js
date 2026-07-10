// Robot/LTP syntax and stateful range validation.

const ROBOT_SYNTAX_PREFERENCE_RULES = [
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

function getPreferenceRuleSeverity(rule) {
  return rule.msg.includes('建议改用') ? 'warning' : 'error';
}

function validateRobotSyntaxPreferences(_raw, lineNum, _lineStartInBlock, cleanLine) {
  const clean = cleanLine === undefined ? '' : cleanLine;
  if (!clean.trim()) return [];

  const diagnostics = [];
  for (const rule of ROBOT_SYNTAX_PREFERENCE_RULES) {
    const match = clean.match(rule.re);
    if (match) {
      diagnostics.push({
        line: lineNum,
        col: match.index,
        endCol: match.index + match[0].length,
        msg: rule.msg,
        severity: getPreferenceRuleSeverity(rule)
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

function createRobotState() {
  return {
    pendingMovcLine: 0,
    currentMovementLine: 0,
    swaitsigCount: 0,
    syncoutCount: 0,
    inStitchOn: false,
    inWeaveOn: false,
    inWaitSync: false,
    inG192: false
  };
}

function addPendingMovcDiagnostic(diagnostics, lineNum) {
  diagnostics.push({
    line: lineNum, col: 0, endCol: 0,
    msg: 'MOVC 必须成对出现：第一行为中间点，第二行为结束点',
    severity: 'error'
  });
}

function validateRobotLineState(state, clean, command, lineNum) {
  const diagnostics = [];
  if (!command) return diagnostics;

  if (state.pendingMovcLine > 0 && command !== 'MOVC' && isMovementCommand(command)) {
    addPendingMovcDiagnostic(diagnostics, state.pendingMovcLine);
    state.pendingMovcLine = 0;
  }

  if (command === 'MOVC' && !isSingleLineMovc(clean)) {
    state.pendingMovcLine = state.pendingMovcLine > 0 ? 0 : lineNum;
  }

  if (isMovementCommand(command)) {
    state.currentMovementLine = lineNum;
    state.swaitsigCount = 0;
    state.syncoutCount = 0;
  }

  if (command === 'WAIT') {
    state.currentMovementLine = 0;
    state.swaitsigCount = 0;
    state.syncoutCount = 0;
  }

  if (command === 'SWAITSIG' && state.currentMovementLine > 0) {
    state.swaitsigCount++;
    if (state.swaitsigCount > 1) {
      diagnostics.push({
        line: lineNum, col: clean.search(/\bSWAITSIG\b/i), endCol: clean.length,
        msg: '运动单节后只能下 1 个 SWAITSIG；多个条件请用 WAIT() 隔开或改用 G4.16',
        severity: 'error'
      });
    }
  }

  if (command === 'SYNCOUT' && state.currentMovementLine > 0) {
    state.syncoutCount++;
    if (state.syncoutCount > 10) {
      diagnostics.push({
        line: lineNum, col: clean.search(/\bSYNCOUT\b/i), endCol: clean.length,
        msg: '同一有移动量移动单节最多允许 10 个 SYNCOUT',
        severity: 'error'
      });
    }
  }

  if (state.inStitchOn && command !== 'STITCHOFF') {
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

  if (state.inWeaveOn && command !== 'WEAVEOFF') {
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

  if (state.inWaitSync && command !== 'ENDSYNC') {
    const waitSyncForbidden = ['MOVJ', 'USERCOR', 'G04.1', 'SHIFTON'];
    if (waitSyncForbidden.includes(command) || /^M\d+$/i.test(command)) {
      diagnostics.push({
        line: lineNum, col: clean.search(new RegExp('\\b' + command.replace('.', '\\.') + '\\b', 'i')), endCol: clean.length,
        msg: 'WAITSYNC 生效范围内不支持此指令',
        severity: 'error'
      });
    }
  }

  if (state.inG192 && command !== 'G192.2') {
    const g192Forbidden = ['MOVJ', 'INCMOVJ', 'MOVC', 'SWAITSIG', 'SYNCOUT', 'WEAVEON', 'WEAVEOFF', 'WAITSYNC', 'ENDSYNC'];
    if (g192Forbidden.includes(command)) {
      diagnostics.push({
        line: lineNum, col: clean.search(new RegExp('\\b' + command.replace('.', '\\.') + '\\b', 'i')), endCol: clean.length,
        msg: 'G192.1 末端跟踪生效范围内不支持此指令',
        severity: 'error'
      });
    }
  }

  if (command === 'STITCHON' && !state.inWeaveOn) state.inStitchOn = true;
  else if (command === 'STITCHOFF') state.inStitchOn = false;

  if (command === 'WEAVEON' && !state.inStitchOn) state.inWeaveOn = true;
  else if (command === 'WEAVEOFF') state.inWeaveOn = false;

  if (command === 'WAITSYNC') state.inWaitSync = true;
  else if (command === 'ENDSYNC') state.inWaitSync = false;

  if (command === 'G192.1') state.inG192 = true;
  else if (command === 'G192.2') state.inG192 = false;

  return diagnostics;
}

function finalizeRobotState(state) {
  const diagnostics = [];
  if (state.pendingMovcLine > 0) addPendingMovcDiagnostic(diagnostics, state.pendingMovcLine);
  return diagnostics;
}

module.exports = {
  validateRobotSyntaxPreferences,
  validateConfirmedSingleLineSyntax,
  getCommand,
  createRobotState,
  validateRobotLineState,
  finalizeRobotState
};
