// Robot/LTP syntax and stateful range validation.

const { DiagnosticCode } = require('./diagnosticCodes');
const { createDiagnostic } = require('./diagnosticFactory');

const MODBUS_R_MIN = 0;
const MODBUS_R_MAX = 65535;
const MODBUS_WRITE_VALUE_MAX = 65535;
const MODBUS_CUSTOM_DATA_MAX = 254;

const DIRECT_ARG_RULES = {
  MOVJ: { args: ['X', 'Y', 'Z', 'A', 'B', 'C', 'P', 'Q', 'FJ', 'FEJ', 'PL', 'ACC', 'DEC'], msg: 'MOVJ 直接引数不使用 =；请使用 X100. / P1 / FJ50 等写法' },
  MOVL: { args: ['X', 'Y', 'Z', 'A', 'B', 'C', 'P', 'Q', 'FL', 'FR', 'FEJ', 'PL', 'PQ', 'PR', 'ACC', 'DEC'], msg: 'MOVL 直接引数不使用 =；请使用 X100. / P1 / FL100. 等写法' },
  MOVC: { args: ['X', 'Y', 'Z', 'A', 'B', 'C', 'FL', 'FR', 'FEJ', 'PL', 'PQ', 'PR', 'ACC', 'DEC'], msg: 'MOVC 直接引数不使用 =；请使用 X100. / FL100. / PL3 等写法' },
  INCMOVJ: { args: ['Q', 'FJ', 'FEJ', 'PL', 'ACC', 'DEC'], msg: 'INCMOVJ 的 Q/FJ/FEJ/PL/ACC/DEC 为直接引数；请使用 Q1 / FJ30 等写法' },
  INCMOVL: { args: ['P', 'X', 'Y', 'Z', 'A', 'B', 'C', 'Q', 'FL', 'FR', 'FEJ', 'PL', 'PQ', 'PR', 'ACC', 'DEC'], msg: 'INCMOVL 直接引数不使用 =；请使用 P1 / X50. / FL80. 等写法' },
  USERCOR: { args: ['P'], msg: 'USERCOR 的 P 为直接引数；请使用 P1 等写法' },
  OBJCORON: { args: ['X', 'Y', 'Z', 'A', 'B', 'C'], msg: 'OBJCORON 的 X/Y/Z/A/B/C 为直接引数；请使用 X5. 而非 X=5.' },
  TOOLCOR: { args: ['P'], msg: 'TOOLCOR 的 P 为直接引数；请使用 P1 等写法' },
  'G68.18': { args: ['P', 'R', 'X', 'Y', 'Z', 'A', 'B', 'C'], msg: 'G68.18 的 P/R/X/Y/Z/A/B/C 为直接引数；请使用 P1 / R0 / X10. 等写法' },
  'G192.1': { args: ['P', 'Q', 'R', 'E'], msg: 'G192.1 的 P/Q/R/E 为直接引数；请使用 P1 / Q20001 / R1 等写法' },
  CIRMODE: { args: ['P'], msg: 'CIRMODE 的 P 为直接引数；请使用 P0 / P1 / P2 等写法' },
  'G43.16': { args: ['P', 'X', 'Y', 'Z', 'A', 'B', 'C'], msg: 'G43.16 的 P/X/Y/Z/A/B/C 为直接引数；请使用 P1 / X10. 等写法' },
  POSEMAP: { args: ['X', 'Y', 'Z', 'A', 'B', 'C', 'Q', 'R'], msg: 'POSEMAP 的 X/Y/Z/A/B/C/Q/R 为直接引数；请使用 X100. / Q1 / R1 等写法' },
  SHIFTON: { args: ['P', 'X', 'Y', 'Z', 'A', 'B', 'C'], msg: 'SHIFTON 的 P/X/Y/Z/A/B/C 为直接引数；请使用 P1 / X20. 等写法' },
  SKIPCOND: { args: ['E', 'Q', 'R', 'P'], msg: 'SKIPCOND 的 E/Q/R/P 为直接引数；请使用 E1 / Q33 / R1 / P0 等写法' },
  SWAITSIG: { args: ['P', 'Q', 'R', 'L', 'T'], msg: 'SWAITSIG 的 P/Q/R/L/T 为直接引数；请使用 P1 / Q33 / R1 等写法' },
  SYNCOUT: { args: ['S', 'Q', 'P', 'R', 'L', 'K'], msg: 'SYNCOUT 的 S/Q/P/R/L/K 为直接引数；请使用 S1 / Q1 / P50 / R1 等写法' },
  STITCHON: { args: ['S', 'Q', 'L', 'K', 'E'], msg: 'STITCHON 的 S/Q/L/K/E 为直接引数；请使用 S1 / Q1 / L500 / E10. 等写法' },
  WAITSYNC: { args: ['P', 'L'], msg: 'WAITSYNC 的 P/L 为直接引数；请使用 P1 / L100. 等写法' },
  ENDSYNC: { args: ['P'], msg: 'ENDSYNC 的 P 为直接引数；请使用 P1 等写法' },
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
    const col = toolArg.index + toolArg[0].lastIndexOf(toolArg[1]);
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

  const coordinateCommands = ['USERCOR', 'TOOLCOR', 'G68.18'];
  if (coordinateCommands.includes(command)) {
    const remainder = clean.trim().replace(/^\S+\s*/, '');
    const forbiddenFeed = remainder.match(/\bF(?:J|L)?\s*(?=[#@+\-]?(?:\d|\.|\(|#|@))/i);
    const forbiddenGCode = remainder.match(/\bG\d+(?:\.\d+)?\b/i);
    const forbiddenAxis = remainder.match(/\b(?:A|B|C)\d+\s*=/i);
    const forbiddenRobotCommand = remainder.match(/\b(?:MOVJ|MOVL|MOVC|INCMOVJ|INCMOVL)\b/i);
    const forbidden = forbiddenFeed || forbiddenGCode || forbiddenAxis || forbiddenRobotCommand;
    if (forbidden) {
      const message = forbiddenFeed
        ? `${command} 不可使用 CNC 或机器人进给引数 F/FJ/FL`
        : forbiddenGCode
          ? `${command} 不可在语法中插入 G 码`
          : forbiddenAxis
            ? `${command} 不接受轴向命令`
            : `${command} 不可与机器人移动语言混用`;
      const col = clean.indexOf(forbidden[0]);
      addRobotDiagnostic(
        diagnostics,
        lineNum,
        col,
        col + forbidden[0].length,
        message,
        'error',
        DiagnosticCode.ROBOT_UNSUPPORTED_COORDINATE_SYNTAX
      );
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
  const match = getStaticDirectArg(cleanLine, argName);
  return match ? match.value : null;
}

function getStaticDirectArg(cleanLine, argName) {
  const match = cleanLine.match(new RegExp('\\b' + argName + '([+-]?\\d+(?:\\.\\d*)?)', 'i'));
  if (!match) return null;
  return {
    value: Number(match[1]),
    literal: match[1],
    col: match.index,
    endCol: match.index + match[0].length
  };
}

function addStaticArgRangeDiagnostic(diagnostics, lineNum, cleanLine, argName, min, max, message) {
  const match = getStaticDirectArg(cleanLine, argName);
  if (!match) return;
  if (Number.isInteger(match.value) && match.value >= min && match.value <= max) return;
  addRobotDiagnostic(
    diagnostics,
    lineNum,
    match.col,
    match.endCol,
    message,
    'error',
    DiagnosticCode.ROBOT_STATIC_ARG_RANGE
  );
}

function addStaticSignalQRangeDiagnostic(diagnostics, lineNum, cleanLine, command, sourceArg, rBitSourceValue = 2) {
  const source = getStaticDirectArg(cleanLine, sourceArg);
  const signal = getStaticDirectArg(cleanLine, 'Q');
  if (!source || !signal || !Number.isInteger(source.value)) return;

  const sourceValue = source.value;
  const signalValue = signal.value;
  if (![1, 2, 3].includes(sourceValue)) return;
  let valid = Number.isInteger(signalValue) && signalValue >= 0;
  if (sourceValue !== rBitSourceValue) {
    valid = valid && signalValue <= 511;
  } else {
    const register = Math.floor(signalValue / 100);
    const bit = signalValue % 100;
    valid = valid && register <= 65535 && bit <= 15;
  }

  if (valid) return;
  const range = sourceValue === rBitSourceValue
    ? 'Q 按 R 编号×100+bit 编码；R 编号范围为 0~65535，末两位 bit 为 00~15'
    : 'Q 引数范围为 0~511';
  addRobotDiagnostic(
    diagnostics,
    lineNum,
    signal.col,
    signal.endCol,
    `${command} 的 ${range}，且必须为整数`,
    'error',
    DiagnosticCode.ROBOT_STATIC_ARG_RANGE
  );
}

function validateStaticArgumentRanges(cleanLine, lineNum, command) {
  const diagnostics = [];

  if (['MOVL', 'MOVC'].includes(command)) {
    addStaticArgRangeDiagnostic(
      diagnostics,
      lineNum,
      cleanLine,
      'P',
      0,
      20,
      `${command} 的 P 引数范围为 0~20，且必须为整数`
    );
    addStaticArgRangeDiagnostic(
      diagnostics,
      lineNum,
      cleanLine,
      'Q',
      0,
      20,
      `${command} 的 Q 引数范围为 0~20，且必须为整数`
    );
  } else if (command === 'INCMOVJ') {
    addStaticArgRangeDiagnostic(
      diagnostics,
      lineNum,
      cleanLine,
      'Q',
      0,
      20,
      'INCMOVJ 的 Q 引数范围为 0~20，且必须为整数'
    );
  } else if (command === 'INCMOVL') {
    addStaticArgRangeDiagnostic(
      diagnostics,
      lineNum,
      cleanLine,
      'P',
      1,
      2,
      'INCMOVL 的 P 引数范围为 1~2，且必须为整数'
    );
  } else if (command === 'WEAVEON') {
    const hasP = hasDirectArg(cleanLine, 'P');
    const detailArgs = ['E', 'Q', 'K', 'L', 'R', 'I'].filter(arg => hasDirectArg(cleanLine, arg));
    if (hasP && detailArgs.length === 0) {
      addStaticArgRangeDiagnostic(
        diagnostics,
        lineNum,
        cleanLine,
        'P',
        1,
        50,
        'WEAVEON 的 P 引数范围为 1~50，且必须为整数'
      );
    } else if (!hasP) {
      addStaticArgRangeDiagnostic(
        diagnostics,
        lineNum,
        cleanLine,
        'L',
        0,
        1000000,
        'WEAVEON 的 L 引数范围为 0~1000000，且必须为整数'
      );
      addStaticArgRangeDiagnostic(
        diagnostics,
        lineNum,
        cleanLine,
        'R',
        0,
        1,
        'WEAVEON 的 R 引数只能为 0 或 1，且必须为整数'
      );
    }
  }

  const directRanges = {
    USERCOR: [['P', 0, 20, 'USERCOR 的 P 引数范围为 0~20，且必须为整数']],
    TOOLCOR: [['P', 0, 20, 'TOOLCOR 的 P 引数范围为 0~20，且必须为整数']],
    SHIFTON: [['P', 1, 2, 'SHIFTON 的 P 引数范围为 1~2，且必须为整数']],
    'G68.18': [
      ['P', 1, 20, 'G68.18 的 P 引数范围为 1~20，且必须为整数'],
      ['R', 0, 3, 'G68.18 的 R 引数范围为 0~3，且必须为整数']
    ],
    'G43.16': [['P', 1, 20, 'G43.16 的 P 引数范围为 1~20，且必须为整数']],
    POSEMAP: [
      ['Q', 0, 20, 'POSEMAP 的 Q 引数范围为 0~20，且必须为整数'],
      ['R', 1, 2, 'POSEMAP 的 R 引数范围为 1~2，且必须为整数']
    ],
    SKIPCOND: [
      ['E', 1, 3, 'SKIPCOND 的 E 引数范围为 1~3，且必须为整数'],
      ['R', 0, 1, 'SKIPCOND 的 R 引数范围为 0~1，且必须为整数'],
      ['P', 0, 1, 'SKIPCOND 的 P 引数范围为 0~1，且必须为整数']
    ],
    SWAITSIG: [
      ['P', 1, 3, 'SWAITSIG 的 P 引数范围为 1~3，且必须为整数'],
      ['R', 0, 1, 'SWAITSIG 的 R 引数范围为 0~1，且必须为整数'],
      ['L', 0, 2 ** 31, 'SWAITSIG 的 L 引数范围为 0~2147483648，且必须为整数'],
      ['T', 0, 2 ** 31, 'SWAITSIG 的 T 引数范围为 0~2147483648，且必须为整数']
    ],
    SYNCOUT: [
      ['S', 1, 3, 'SYNCOUT 的 S 引数范围为 1~3，且必须为整数'],
      ['P', 0, 100, 'SYNCOUT 的 P 引数范围为 0~100，且必须为整数'],
      ['R', 0, 1, 'SYNCOUT 的 R 引数范围为 0~1，且必须为整数'],
      ['L', 0, 10000, 'SYNCOUT 的 L 引数范围为 0~10000，且必须为整数'],
      ['K', -10000, 10000, 'SYNCOUT 的 K 引数范围为 -10000~10000，且必须为整数']
    ],
    'G192.1': [
      ['P', 0, 20, 'G192.1 的 P 引数范围为 0~20，且必须为整数'],
      ['Q', 0, 65530, 'G192.1 的 Q 引数范围为 0~65530，且必须为整数'],
      ['R', 1, 2, 'G192.1 的 R 引数范围为 1~2，且必须为整数'],
      ['E', -10, 10, 'G192.1 的 E 引数范围为 -10~10，且必须为整数']
    ],
    CIRMODE: [['P', 0, 2, 'CIRMODE 的 P 引数范围为 0~2，且必须为整数']],
    WAITSYNC: [['P', 1, 4, 'WAITSYNC 的 P 引数范围为 1~4，且必须为整数']],
    ENDSYNC: [['P', 1, 4, 'ENDSYNC 的 P 引数范围为 1~4，且必须为整数']]
  };
  for (const [argName, min, max, message] of directRanges[command] || []) {
    addStaticArgRangeDiagnostic(diagnostics, lineNum, cleanLine, argName, min, max, message);
  }

  if (command === 'SKIPCOND') addStaticSignalQRangeDiagnostic(diagnostics, lineNum, cleanLine, command, 'E', 3);
  if (command === 'SWAITSIG') addStaticSignalQRangeDiagnostic(diagnostics, lineNum, cleanLine, command, 'P');
  if (command === 'SYNCOUT') addStaticSignalQRangeDiagnostic(diagnostics, lineNum, cleanLine, command, 'S');

  return diagnostics;
}

function getModbusLine(cleanLine) {
  const match = cleanLine.match(/^\s*G10\s+(L1900|L1901)\b/i);
  if (!match) return null;
  return {
    code: match[1].toUpperCase(),
    col: match.index,
    endCol: match.index + match[0].length
  };
}

function validateG10ModbusArguments(cleanLine, lineNum) {
  const modbusLine = getModbusLine(cleanLine);
  if (!modbusLine) return [];

  const diagnostics = [];
  const args = new Map();
  for (const argName of ['C', 'I', 'A', 'Q', 'K', 'X', 'P', 'R']) {
    const arg = getStaticDirectArg(cleanLine, argName);
    if (arg) args.set(argName, arg);
  }
  const hasArg = argName => hasDirectArg(cleanLine, argName);
  const addFormat = message => addRobotDiagnostic(
    diagnostics, lineNum, modbusLine.col, cleanLine.length, message,
    'error', DiagnosticCode.ROBOT_G10_MODBUS_FORMAT
  );
  const addArgDiagnostic = (argName, message, code) => {
    const arg = args.get(argName);
    const col = arg ? arg.col : modbusLine.col;
    const endCol = arg ? arg.endCol : cleanLine.length;
    addRobotDiagnostic(diagnostics, lineNum, col, endCol, message, 'error', code);
  };

  for (const [argName, arg] of args) {
    if (arg.literal.includes('.') || !Number.isSafeInteger(arg.value)) {
      addArgDiagnostic(argName,
        `G10 ${modbusLine.code} 的 ${argName} 引数必须为十进制整数`,
        DiagnosticCode.ROBOT_G10_MODBUS_INTEGER);
    }
  }

  if (modbusLine.code === 'L1900') {
    const cArg = args.get('C');
    if (!hasArg('C')) {
      addFormat('G10 L1900 缺少 C 引数；读取使用 C3，写入使用 C6。');
    } else if (cArg && Number.isSafeInteger(cArg.value) && ![3, 6].includes(cArg.value)) {
      addArgDiagnostic('C', 'G10 L1900 的 C 引数只能为 3（读取）或 6（写入）', DiagnosticCode.ROBOT_G10_MODBUS_FORMAT);
    }

    if (cArg && Number.isSafeInteger(cArg.value) && cArg.value === 3) {
      const missing = ['I', 'A', 'Q', 'K'].filter(argName => !hasArg(argName));
      if (missing.length > 0) addFormat(`G10 L1900 C3 缺少引数：${missing.join('/')}`);
      if (hasArg('X')) addFormat('G10 L1900 C3 读取语法不支持 X 引数');
    } else if (cArg && Number.isSafeInteger(cArg.value) && cArg.value === 6) {
      const missing = ['I', 'A', 'X'].filter(argName => !hasArg(argName));
      if (missing.length > 0) addFormat(`G10 L1900 C6 缺少引数：${missing.join('/')}`);
      const unsupported = ['Q', 'K'].filter(argName => hasArg(argName));
      if (unsupported.length > 0) addFormat(`G10 L1900 C6 写入语法不支持 ${unsupported.join('/')} 引数`);
    }
  } else {
    const missing = ['P', 'R', 'Q'].filter(argName => !hasArg(argName));
    if (missing.length > 0) addFormat(`G10 L1901 缺少引数：${missing.join('/')}`);
    const unsupported = ['C', 'I', 'A', 'X'].filter(argName => hasArg(argName));
    if (unsupported.length > 0) addFormat(`G10 L1901 自定义封包语法不支持 ${unsupported.join('/')} 引数`);
  }

  for (const [argName, arg] of args) {
    if (arg.value < 0) {
      addArgDiagnostic(argName,
        `G10 ${modbusLine.code} 的 ${argName} 引数不可为负数`,
        DiagnosticCode.ROBOT_G10_MODBUS_RANGE);
    }
  }

  const xArg = args.get('X');
  if (xArg && Number.isSafeInteger(xArg.value) &&
      (xArg.value < 0 || xArg.value > MODBUS_WRITE_VALUE_MAX)) {
    addArgDiagnostic('X', `G10 ${modbusLine.code} 的 X 写入值范围为 0~${MODBUS_WRITE_VALUE_MAX}`, DiagnosticCode.ROBOT_G10_MODBUS_RANGE);
  }

  for (const argName of ['P', 'Q']) {
    const arg = args.get(argName);
    if (arg && Number.isSafeInteger(arg.value) &&
        (arg.value < MODBUS_R_MIN || arg.value > MODBUS_R_MAX)) {
      addArgDiagnostic(argName, `G10 ${modbusLine.code} 的 ${argName} R 值编号范围为 ${MODBUS_R_MIN}~${MODBUS_R_MAX}`, DiagnosticCode.ROBOT_G10_MODBUS_RANGE);
    }
  }

  const customCount = args.get('R');
  if (customCount && Number.isSafeInteger(customCount.value) &&
      (customCount.value < 0 || customCount.value > MODBUS_CUSTOM_DATA_MAX)) {
    addArgDiagnostic('R', `G10 ${modbusLine.code} 的 R 自定义资料数量范围为 0~${MODBUS_CUSTOM_DATA_MAX}`, DiagnosticCode.ROBOT_G10_MODBUS_RANGE);
  }

  return diagnostics;
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

  diagnostics.push(...validateStaticArgumentRanges(clean, lineNum, command));
  if (command === 'G10') {
    diagnostics.push(...validateG10ModbusArguments(clean, lineNum));
  }

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

function validateRobotLineState(state, clean, command, lineNum, inConditionalBranch = false) {
  const diagnostics = [];
  if (!command) return diagnostics;

  if (state.pendingMovcLine > 0 && command !== 'MOVC' && isMovementCommand(command)) {
    addPendingMovcDiagnostic(diagnostics, state.pendingMovcLine);
    state.pendingMovcLine = 0;
  }

  if (command === 'MOVC' && !inConditionalBranch && !isSingleLineMovc(clean)) {
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

  // STITCHON/WEAVEON 互斥：在对方生效范围内静默忽略开启指令
  // （前述禁忌检查已覆盖报错场景，此处仅维护状态一致性）
  if (command === 'STITCHON') {
    if (!state.inWeaveOn) state.inStitchOn = true;
  } else if (command === 'STITCHOFF') {
    state.inStitchOn = false;
  }

  if (command === 'WEAVEON') {
    if (!state.inStitchOn) state.inWeaveOn = true;
  } else if (command === 'WEAVEOFF') {
    state.inWeaveOn = false;
  }

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
