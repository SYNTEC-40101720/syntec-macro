// Static validation for built-in function arguments.

const { DiagnosticCode } = require('./diagnosticCodes');
const { createError, createWarning } = require('./diagnosticFactory');

// ============================================================
// 控制器范围常量（源自《新代控制器技术参考手册》）
// 集中定义以便与手册对照，避免散落在校验逻辑中
// ============================================================
const IO_POINT_MIN = 0;          // DI/DO/A 点编号下限
const IO_POINT_MAX = 511;        // DI/DO/A 点编号上限
const IO_WRITE_VALUES = [0, 1];  // DO/A 点 / R-bit 写入值
const R_REGISTER_MIN = 0;        // R 值编号下限
const R_REGISTER_MAX = 65535;    // R 值编号上限
const R_BIT_MIN = 0;             // R 值 Bit 下限
const R_BIT_MAX = 31;            // R 值 Bit 上限
const ALARM_MSG_ID_MIN = 0;      // ALARM/MSG ID 下限
const ALARM_MSG_ID_MAX = 65535;  // ALARM/MSG ID 上限
const CHKINF_CATEGORY_MIN = 1;   // CHKINF 类别下限
const CHKINF_CATEGORY_MAX = 5;   // CHKINF 类别上限

function splitFunctionArgs(s) {
  // 按逗号分割函数参数，跳过字符串内的逗号和嵌套括号内的逗号
  const args = [];
  let current = '';
  let depth = 0;
  let inStr = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '"') {
      let bs = 0;
      for (let j = i - 1; j >= 0 && s[j] === '\\'; j--) bs++;
      if (bs % 2 === 0) inStr = !inStr;
      current += ch;
    } else if (inStr) {
      current += ch;
    } else if (ch === '(') {
      depth++;
      current += ch;
    } else if (ch === ')') {
      depth--;
      current += ch;
    } else if (ch === ',' && depth === 0) {
      args.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim() !== '' || args.length > 0) {
    args.push(current.trim());
  }
  return args;
}

function getStaticFunctionCalls(cleanLine, functionName) {
  const escaped = functionName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const headerRe = new RegExp('\\b' + escaped + '\\s*\\(', 'ig');
  const calls = [];
  let headerMatch;
  while ((headerMatch = headerRe.exec(cleanLine)) !== null) {
    const callStart = headerMatch.index;
    const argsStart = headerMatch.index + headerMatch[0].length;
    // 平衡括号扫描，支持嵌套括号
    let depth = 1;
    let i = argsStart;
    let inStr = false;
    while (i < cleanLine.length && depth > 0) {
      const ch = cleanLine[i];
      if (ch === '"') {
        let bs = 0;
        for (let j = i - 1; j >= 0 && cleanLine[j] === '\\'; j--) bs++;
        if (bs % 2 === 0) inStr = !inStr;
      } else if (!inStr) {
        if (ch === '(') depth++;
        else if (ch === ')') { depth--; if (depth === 0) break; }
      }
      i++;
    }
    if (depth !== 0) continue; // 未闭合，跳过
    const argsEnd = i;
    const argsStr = cleanLine.slice(argsStart, argsEnd);
    calls.push({ col: callStart, endCol: argsEnd + 1, args: splitFunctionArgs(argsStr) });
    headerRe.lastIndex = argsEnd + 1;
  }
  return calls;
}

function parseStaticNumber(value) {
  if (!/^[+-]?\d+(?:\.\d*)?$/.test(value)) return null;
  return Number(value);
}

function addRangeDiagnostic(diagnostics, call, lineNum, message, code) {
  diagnostics.push(createError(lineNum, call.col, call.endCol, message, { code }));
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

function isInsideString(text, targetIndex) {
  let inString = false;
  for (let index = 0; index < targetIndex; index++) {
    if (text[index] !== '"') continue;
    let backslashCount = 0;
    for (let cursor = index - 1; cursor >= 0 && text[cursor] === '\\'; cursor--) backslashCount++;
    if (backslashCount % 2 === 0) inString = !inString;
  }
  return inString;
}

function validateStaticFunctionArguments(raw, lineNum, lineStartInBlock, cleanLine) {
  const clean = cleanLine === undefined ? '' : cleanLine;
  if (!clean.trim()) return [];

  const diagnostics = [];
  const commentStripped = stripCommentsKeepStringsWithState(raw || '', lineStartInBlock).text;

  for (const call of getStaticFunctionCalls(clean, 'ATAN2')) {
    const y = parseStaticNumber(call.args[0] || '');
    const x = parseStaticNumber(call.args[1] || '');
    if (x === 0 && y === 0) addRangeDiagnostic(diagnostics, call, lineNum, 'ATAN2(0,0) 会触发 COR-004 运算域错误', DiagnosticCode.FUNCTION_MATH_DOMAIN);
  }

  for (const call of getStaticFunctionCalls(clean, 'POW')) {
    const base = parseStaticNumber(call.args[0] || '');
    if (base !== null && base < 0) addRangeDiagnostic(diagnostics, call, lineNum, 'POW 基底不可为负值，否则触发 COR-122', DiagnosticCode.FUNCTION_MATH_DOMAIN);
  }

  for (const call of getStaticFunctionCalls(clean, 'LN')) {
    const value = parseStaticNumber(call.args[0] || '');
    if (value !== null && value <= 0) addRangeDiagnostic(diagnostics, call, lineNum, 'LN 引数需为正数', DiagnosticCode.FUNCTION_MATH_DOMAIN);
  }

  for (const call of getStaticFunctionCalls(clean, 'SQRT')) {
    const value = parseStaticNumber(call.args[0] || '');
    if (value !== null && value < 0) addRangeDiagnostic(diagnostics, call, lineNum, 'SQRT 引数需大于或等于 0', DiagnosticCode.FUNCTION_MATH_DOMAIN);
  }

  for (const fn of ['ACOS', 'ASIN']) {
    for (const call of getStaticFunctionCalls(clean, fn)) {
      const value = parseStaticNumber(call.args[0] || '');
      if (value !== null && (value < -1 || value > 1)) {
        addRangeDiagnostic(diagnostics, call, lineNum, `${fn} 引数范围为 -1~1`, DiagnosticCode.FUNCTION_MATH_DOMAIN);
      }
    }
  }

  const ioSingleRanges = [
    ['READDI', IO_POINT_MIN, IO_POINT_MAX], ['READDO', IO_POINT_MIN, IO_POINT_MAX], ['READABIT', IO_POINT_MIN, IO_POINT_MAX],
    ['SETDO', IO_POINT_MIN, IO_POINT_MAX], ['SETABIT', IO_POINT_MIN, IO_POINT_MAX]
  ];
  for (const [fn, min, max] of ioSingleRanges) {
    for (const call of getStaticFunctionCalls(clean, fn)) {
      const value = parseStaticNumber(call.args[0] || '');
      if (value !== null && (!Number.isInteger(value) || value < min || value > max)) {
        addRangeDiagnostic(diagnostics, call, lineNum, `${fn} 点编号范围为 ${min}~${max}`, DiagnosticCode.FUNCTION_IO_POINT_RANGE);
      }
    }
  }

  const ioValueFns = ['SETDO', 'SETABIT', 'SETRREGBIT'];
  for (const fn of ioValueFns) {
    for (const call of getStaticFunctionCalls(clean, fn)) {
      const value = parseStaticNumber(call.args[fn === 'SETRREGBIT' ? 2 : 1] || '');
      if (value !== null && !IO_WRITE_VALUES.includes(value)) addRangeDiagnostic(diagnostics, call, lineNum, `${fn} 写入值应为 0 或 1`, DiagnosticCode.FUNCTION_IO_VALUE_RANGE);
    }
  }

  for (const fn of ['READRREGBIT', 'SETRREGBIT']) {
    for (const call of getStaticFunctionCalls(clean, fn)) {
      const reg = parseStaticNumber(call.args[0] || '');
      const bit = parseStaticNumber(call.args[1] || '');
      if (reg !== null && (!Number.isInteger(reg) || reg < R_REGISTER_MIN || reg > R_REGISTER_MAX)) {
        addRangeDiagnostic(diagnostics, call, lineNum, `${fn} 的 R 值编号范围为 ${R_REGISTER_MIN}~${R_REGISTER_MAX}`, DiagnosticCode.FUNCTION_R_REGISTER_RANGE);
      }
      if (bit !== null && (!Number.isInteger(bit) || bit < R_BIT_MIN || bit > R_BIT_MAX)) {
        addRangeDiagnostic(diagnostics, call, lineNum, `${fn} 的 bit 范围为 ${R_BIT_MIN}~${R_BIT_MAX}`, DiagnosticCode.FUNCTION_R_BIT_RANGE);
      }
    }
  }

  for (const fn of ['ALARM', 'MSG']) {
    for (const call of getStaticFunctionCalls(clean, fn)) {
      const id = parseStaticNumber(call.args[0] || '');
      if (id !== null && (!Number.isInteger(id) || id < ALARM_MSG_ID_MIN || id > ALARM_MSG_ID_MAX)) addRangeDiagnostic(diagnostics, call, lineNum, `${fn} ID 范围为 ${ALARM_MSG_ID_MIN}~${ALARM_MSG_ID_MAX}`, DiagnosticCode.FUNCTION_ID_RANGE);
    }
  }

  for (const call of getStaticFunctionCalls(clean, 'PARAM')) {
    for (const arg of call.args.slice(0, 2)) {
      const value = parseStaticNumber(arg);
      if (value !== null && !Number.isInteger(value)) addRangeDiagnostic(diagnostics, call, lineNum, 'PARAM 引数需为整数', DiagnosticCode.FUNCTION_INTEGER_ARGUMENT);
    }
  }

  for (const call of getStaticFunctionCalls(commentStripped, 'SYSDATA')) {
    if (isInsideString(commentStripped, call.col)) continue;
    const arg = call.args[0] || '';
    const isString = /^"(?:[^"\\]|\\.)*"$/.test(arg);
    const isDecimalLiteral = /^[+-]?\d+\.\d*$/.test(arg);
    if (isString || isDecimalLiteral) {
      addRangeDiagnostic(diagnostics, call, lineNum, 'SYSDATA 引数需为整数', DiagnosticCode.FUNCTION_INTEGER_ARGUMENT);
    }
  }

  for (const call of getStaticFunctionCalls(commentStripped, 'DRVDATA')) {
    if (isInsideString(commentStripped, call.col)) continue;
    const station = call.args[0] || '';
    const variable = call.args[1] || '';
    const stationIsString = /^"(?:[^"\\]|\\.)*"$/.test(station);
    const stationIsDecimalLiteral = /^[+-]?\d+\.\d*$/.test(station);
    if (stationIsString || stationIsDecimalLiteral) {
      addRangeDiagnostic(diagnostics, call, lineNum, 'DRVDATA 站号需为整数', DiagnosticCode.FUNCTION_INTEGER_ARGUMENT);
    }
    const isDecimalInteger = /^[+-]?\d+$/.test(variable);
    const isHexString = /^"[0-9A-Fa-f]+h"$/.test(variable);
    if (variable && !isDecimalInteger && !isHexString && !/^#[\d\[]/.test(variable)) {
      addRangeDiagnostic(diagnostics, call, lineNum, 'DRVDATA 第二引数需为十进制整数或 "xxxh" 十六进制字符串', DiagnosticCode.FUNCTION_DRVDATA_ARGUMENT_FORMAT);
    }
  }

  for (const call of getStaticFunctionCalls(clean, 'CHKINF')) {
    const category = parseStaticNumber(call.args[0] || '');
    if (category !== null && (!Number.isInteger(category) || category < CHKINF_CATEGORY_MIN || category > CHKINF_CATEGORY_MAX)) addRangeDiagnostic(diagnostics, call, lineNum, `CHKINF 类别范围为 ${CHKINF_CATEGORY_MIN}~${CHKINF_CATEGORY_MAX}`, DiagnosticCode.FUNCTION_CHKINF_CATEGORY_RANGE);
  }

  const openComMatch = commentStripped.match(/\bOPEN\s*\(\s*"COM\d+"\s*\)/i);
  if (openComMatch) {
    diagnostics.push(createWarning(lineNum, openComMatch.index, openComMatch.index + openComMatch[0].length, '串口传输埠仅支持 OPEN("COM")；OPEN("COM1") 会按普通文件名处理', {
      code: DiagnosticCode.FUNCTION_OPEN_COM_PORT
    }));
  }

  for (const call of getStaticFunctionCalls(commentStripped, 'AXID')) {
    if (isInsideString(commentStripped, call.col)) continue;
    if (/^"(?:[^"\\]|\\.)*"$/.test(call.args[0] || '')) {
      diagnostics.push(createWarning(lineNum, call.col, call.endCol, 'AXID 建议使用裸轴名，例如 AXID(Y)', {
        code: DiagnosticCode.FUNCTION_AXID_QUOTED_AXIS
      }));
    }
  }

  return diagnostics;
}

module.exports = {
  validateStaticFunctionArguments
};
