// Robot/LTP syntax and stateful range validation.

const { DiagnosticCode } = require('./diagnosticCodes');
const { createDiagnostic } = require('./diagnosticFactory');

const DIRECT_ARG_RULES = {
  MOVJ: { args: ['X', 'Y', 'Z', 'A', 'B', 'C', 'P', 'Q', 'FJ', 'FEJ', 'PL', 'ACC', 'DEC'], msg: 'MOVJ 直接引数不使用 =；请使用 X100. / P1 / FJ50 等写法' },
  MOVL: { args: ['X', 'Y', 'Z', 'A', 'B', 'C', 'P', 'Q', 'FL', 'FR', 'FEJ', 'PL', 'PQ', 'PR', 'ACC', 'DEC'], msg: 'MOVL 直接引数不使用 =；请使用 X100. / P1 / FL100. 等写法' },
  MOVC: { args: ['X', 'Y', 'Z', 'A', 'B', 'C', 'FL', 'FR', 'FEJ', 'PL', 'PQ', 'PR', 'ACC', 'DEC'], msg: 'MOVC 直接引数不使用 =；请使用 X100. / FL100. / PL3 等写法' },
  INCMOVJ: { args: ['Q', 'FJ', 'FEJ', 'PL', 'ACC', 'DEC'], msg: 'INCMOVJ 的 Q/FJ/FEJ/PL/ACC/DEC 为直接引数；请使用 Q1 / FJ30 等写法' },
  INCMOVL: { args: ['P', 'X', 'Y', 'Z', 'A', 'B', 'C', 'Q', 'FL', 'FR', 'FEJ', 'PL', 'PQ', 'PR', 'ACC', 'DEC'], msg: 'INCMOVL 直接引数不使用 =；请使用 P1 / X50. / FL80. 等写法' },
  OBJCORON: { args: ['X', 'Y', 'Z', 'A', 'B', 'C'], msg: 'OBJCORON 的 X/Y/Z/A/B/C 为直接引数；请使用 X5. 而非 X=5.' },
  'G68.18': { args: ['P', 'R', 'X', 'Y', 'Z', 'A', 'B', 'C'], msg: 'G68.18 的 P/R/X/Y/Z/A/B/C 为直接引数；请使用 P1 / R0 / X10. 等写法' },
  'G43.16': { args: ['P', 'X', 'Y', 'Z', 'A', 'B', 'C'], msg: 'G43.16 的 P/X/Y/Z/A/B/C 为直接引数；请使用 P1 / X10. 等写法' },
  POSEMAP: { args: ['X', 'Y', 'Z', 'A', 'B', 'C', 'Q', 'R'], msg: 'POSEMAP 的 X/Y/Z/A/B/C/Q/R 为直接引数；请使用 X100. / Q1 / R1 等写法' },
  SHIFTON: { args: ['P', 'X', 'Y', 'Z', 'A', 'B', 'C'], msg: 'SHIFTON 的 P/X/Y/Z/A/B/C 为直接引数；请使用 P1 / X20. 等写法' },
  SKIPCOND: { args: ['E', 'Q', 'R', 'P'], msg: 'SKIPCOND 的 E/Q/R/P 为直接引数；请使用 E1 / Q33 / R1 / P0 等写法' },
  SWAITSIG: { args: ['P', 'Q', 'R', 'L', 'T'], msg: 'SWAITSIG 的 P/Q/R/L/T 为直接引数；请使用 P1 / Q33 / R1 等写法' },
  STITCHON: { args: ['S', 'Q', 'L', 'K', 'E'], msg: 'STITCHON 的 S/Q/L/K/E 为直接引数；请使用 S1 / Q1 / L500 / E10. 等写法' },
  WEAVEON: { args: ['P', 'E', 'Q', 'K', 'L', 'R', 'I'], msg: 'WEAVEON 的 P/E/Q/K/L/R/I 为直接引数；请使用 P3 或 E5. Q1.0 K30. 等写法' }
};

function addRobotDiagnostic(diagnostics, lineNum, col, endCol, msg, severity, code) {
  diagnostics.push(createDiagnostic(lineNum, col, endCol, msg, severity, { code }));
}

function findDirectArgEquals(clean, command) {
  const rule = DIRECT_ARG_RULES[command];
  if (!rule) return null;
  const args = [...rule.args].sort((a, b) => b.length - a.length).map(arg => arg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const re = new RegExp('\\b(' + args + ')\\s*=', 'i');
  const match = clean.match(re);
  if (!match) return null;
  return { col: match.index + match[0].lastIndexOf('='), msg: rule.msg };
}

function validateRobotSyntaxPreferences(_raw, lineNum, _lineStartInBlock, cleanLine) {
  const clean = cleanLine === undefined ? '' : cleanLine;
  if (!clean.trim()) return [];

  const diagnostics = [];
  const command = getCommand(clean);

  const movj2 = clean.match(/\bMOVJ-II\b/i);
  if (movj2) {
    addRobotDiagnostic(diagnostics, lineNum, movj2.index, movj2.index + movj2[0].length,
      'MOVJ-II 不是正式指令写法；请使用 MOVJ 第二语法', 'error', DiagnosticCode.ROBOT_DEPRECATED_MOVJ_II);
  }

  const movcPoint = command === 'MOVC' ? clean.match(/\b(?:Xp|Yp|Zp)\s*=/i) : null;
  if (movcPoint) {
    addRobotDiagnostic(diagnostics, lineNum, movcPoint.index, movcPoint.index + movcPoint[0].replace(/\s*=\s*$/, '').length,
      'MOVC 不支持 Xp/Yp/Zp 通过点写法；请使用成对 MOVC 的 X/Y/Z/A/B/C 直接引数', 'error', DiagnosticCode.ROBOT_UNSUPPORTED_MOVC_POINT_ARG);
    return diagnostics;
  }

  const directArg = findDirectArgEquals(clean, command);
  if (directArg) {
    addRobotDiagnostic(diagnostics, lineNum, directArg.col, directArg.col + 1,
      directArg.msg, 'error', DiagnosticCode.ROBOT_DIRECT_ARG_EQUALS);
  }

  const toolArg = clean.match(/\b(?:TOOLCOR|TOOLCORON)\s+(T)(?=\d|#|@|\[|=)/i);
  if (toolArg) {
    const col = toolArg.index + toolArg[0].lastIndexOf('T');
    addRobotDiagnostic(diagnostics, lineNum, col, col + 1,
      'TOOLCOR/TOOLCORON 使用 P_ 指定工具编号；请勿使用 T_', 'error', DiagnosticCode.ROBOT_TOOLCOR_T_ARG);
  }

  const toolcoron = clean.match(/\bTOOLCORON\b/i);
  if (toolcoron) {
    addRobotDiagnostic(diagnostics, lineNum, toolcoron.index, toolcoron.index + toolcoron[0].length,
      'TOOLCORON 未见官方语法；建议改用 TOOLCOR P_', 'warning', DiagnosticCode.ROBOT_TOOLCORON_DEPRECATED);
  }

  const toolcorClear = clean.match(/\bTOOLCOR\s+CLEAR\b/i);
  if (toolcorClear) {
    addRobotDiagnostic(diagnostics, lineNum, toolcorClear.index, toolcorClear.index + toolcorClear[0].length,
      'TOOLCOR CLEAR 未见官方语法；建议改用 TOOLCOR P0', 'warning', DiagnosticCode.ROBOT_TOOLCOR_CLEAR);
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
    addRobotDiagnostic(diagnostics, lineNum, clean.search(/\b(?:PL|PQ|PR)/i), clean.length,
      `${command} 单行只能使用 PL/PQ/PR 其中一个平滑引数`, 'error', DiagnosticCode.ROBOT_SMOOTH_ARG_CONFLICT);
  }

  if (['MOVJ', 'INCMOVJ'].includes(command) && (hasDirectArg(clean, 'PQ') || hasDirectArg(clean, 'PR'))) {
    addRobotDiagnostic(diagnostics, lineNum, clean.search(/\b(?:PQ|PR)/i), clean.length,
      `${command} 不支持 PQ/PR；请使用 PL`, 'error', DiagnosticCode.ROBOT_UNSUPPORTED_SMOOTH_ARG);
  }

  if (command === 'MOVJ' && hasDirectArg(clean, 'P') && !hasDirectArg(clean, 'X')) {
    addRobotDiagnostic(diagnostics, lineNum, clean.search(/\bP/i), clean.length,
      'MOVJ 第一语法不支持 P 引数', 'error', DiagnosticCode.ROBOT_UNSUPPORTED_MOVJ_P_ARG);
  }

  if (command === 'INCMOVL' && !hasDirectArg(clean, 'P')) {
    const col = clean.search(/\bINCMOVL\b/i);
    addRobotDiagnostic(diagnostics, lineNum, col, col + 'INCMOVL'.length,
      'INCMOVL 缺少必填 P 引数', 'error', DiagnosticCode.ROBOT_MISSING_REQUIRED_ARG);
  }

  if (command === 'STITCHON') {
    const hasL = hasDirectArg(clean, 'L');
    const hasK = hasDirectArg(clean, 'K');
    if (hasL && hasK) {
      addRobotDiagnostic(diagnostics, lineNum, clean.search(/\b(?:L|K)/i), clean.length,
        'STITCHON 的 L/K 只能择一输入', 'error', DiagnosticCode.ROBOT_STITCH_ARG_CONFLICT);
    } else if (!hasL && !hasK) {
      addRobotDiagnostic(diagnostics, lineNum, clean.search(/\bSTITCHON\b/i), clean.length,
        'STITCHON 需指定 L 或 K 其中一个', 'warning', DiagnosticCode.ROBOT_STITCH_MISSING_ARG);
    }
    const lValue = getStaticDirectArgNumber(clean, 'L');
    if (lValue !== null && !Number.isInteger(lValue)) {
      addRobotDiagnostic(diagnostics, lineNum, clean.search(/\bL/i), clean.length,
        'STITCHON 的 L 引数不可带小数点', 'error', DiagnosticCode.ROBOT_STITCH_L_INTEGER);
    }
  }

  if (command === 'WEAVEON') {
    const hasP = hasDirectArg(clean, 'P');
    const detailArgs = ['E', 'Q', 'K', 'L', 'R', 'I'].filter(arg => hasDirectArg(clean, arg));
    if (hasP && detailArgs.length > 0) {
      addRobotDiagnostic(diagnostics, lineNum, clean.search(/\bWEAVEON\b/i), clean.length,
        'WEAVEON 的 P 语法不可与 E/Q/K/L/R/I 混用', 'error', DiagnosticCode.ROBOT_WEAVEON_MIXED_ARGS);
    }
    const qMatch = clean.match(/\bQ([+-]?\d+)(?!\.)/i);
    if (!hasP && qMatch) {
      addRobotDiagnostic(diagnostics, lineNum, qMatch.index, qMatch.index + qMatch[0].length,
        'WEAVEON 的 Q 频率建议使用小数形式，例如 Q1.0', 'warning', DiagnosticCode.ROBOT_WEAVEON_Q_DECIMAL);
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
  addRobotDiagnostic(diagnostics, lineNum, 0, 0,
    'MOVC 必须成对出现：第一行为中间点，第二行为结束点', 'error', DiagnosticCode.ROBOT_MOVC_PAIR_REQUIRED);
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
      addRobotDiagnostic(diagnostics, lineNum, clean.search(/\bSWAITSIG\b/i), clean.length,
        '运动单节后只能下 1 个 SWAITSIG；多个条件请用 WAIT() 隔开或改用 G4.16', 'error', DiagnosticCode.ROBOT_SWAITSIG_LIMIT);
    }
  }

  if (command === 'SYNCOUT' && state.currentMovementLine > 0) {
    state.syncoutCount++;
    if (state.syncoutCount > 10) {
      addRobotDiagnostic(diagnostics, lineNum, clean.search(/\bSYNCOUT\b/i), clean.length,
        '同一有移动量移动单节最多允许 10 个 SYNCOUT', 'error', DiagnosticCode.ROBOT_SYNCOUT_LIMIT);
    }
  }

  if (state.inStitchOn && command !== 'STITCHOFF') {
    const stitchForbidden = ['MOVJ', 'USERCOR', 'SHIFTON', 'SHIFTOFF', 'OBJCORON', 'OBJCOROFF', 'OBJCORCLEAR', 'SYNCOUT', 'WEAVEON', 'WEAVEOFF', 'WAITSYNC', 'ENDSYNC'];
    if (stitchForbidden.includes(command) || (['MOVL', 'MOVC', 'INCMOVL'].includes(command) && /\bSKIP\b/i.test(clean))) {
      addRobotDiagnostic(diagnostics, lineNum, clean.search(new RegExp('\\b' + command.replace('.', '\\.') + '\\b', 'i')), clean.length,
        'STITCHON 生效范围内不支持此指令', 'error', DiagnosticCode.ROBOT_RANGE_FORBIDDEN_COMMAND);
    } else if (command === 'M96') {
      addRobotDiagnostic(diagnostics, lineNum, clean.search(/\bM96\b/i), clean.length,
        'STITCHON 生效范围内 M96 中断型副程序触发无效', 'warning', DiagnosticCode.ROBOT_RANGE_FORBIDDEN_COMMAND);
    }
  }

  if (state.inWeaveOn && command !== 'WEAVEOFF') {
    if (['MOVJ', 'STITCHON', 'STITCHOFF', 'WAITSYNC', 'ENDSYNC'].includes(command)) {
      addRobotDiagnostic(diagnostics, lineNum, clean.search(new RegExp('\\b' + command + '\\b', 'i')), clean.length,
        'WEAVEON 生效范围内不支持此指令', 'error', DiagnosticCode.ROBOT_RANGE_FORBIDDEN_COMMAND);
    } else if (command === 'M96') {
      addRobotDiagnostic(diagnostics, lineNum, clean.search(/\bM96\b/i), clean.length,
        'WEAVEON 生效范围内 M96 中断型副程序触发无效', 'warning', DiagnosticCode.ROBOT_RANGE_FORBIDDEN_COMMAND);
    }
  }

  if (state.inWaitSync && command !== 'ENDSYNC') {
    const waitSyncForbidden = ['MOVJ', 'USERCOR', 'G04.1', 'SHIFTON'];
    if (waitSyncForbidden.includes(command) || /^M\d+$/i.test(command)) {
      addRobotDiagnostic(diagnostics, lineNum, clean.search(new RegExp('\\b' + command.replace('.', '\\.') + '\\b', 'i')), clean.length,
        'WAITSYNC 生效范围内不支持此指令', 'error', DiagnosticCode.ROBOT_RANGE_FORBIDDEN_COMMAND);
    }
  }

  if (state.inG192 && command !== 'G192.2') {
    const g192Forbidden = ['MOVJ', 'INCMOVJ', 'MOVC', 'SWAITSIG', 'SYNCOUT', 'WEAVEON', 'WEAVEOFF', 'WAITSYNC', 'ENDSYNC'];
    if (g192Forbidden.includes(command)) {
      addRobotDiagnostic(diagnostics, lineNum, clean.search(new RegExp('\\b' + command.replace('.', '\\.') + '\\b', 'i')), clean.length,
        'G192.1 末端跟踪生效范围内不支持此指令', 'error', DiagnosticCode.ROBOT_RANGE_FORBIDDEN_COMMAND);
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
