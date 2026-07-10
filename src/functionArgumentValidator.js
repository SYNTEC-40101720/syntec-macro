// Static validation for built-in function arguments.

const { DiagnosticCode } = require('./diagnosticCodes');
const { createError, createWarning } = require('./diagnosticFactory');

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

function validateStaticFunctionArguments(raw, lineNum, lineStartInBlock, cleanLine) {
  const clean = cleanLine === undefined ? '' : cleanLine;
  if (!clean.trim()) return [];

  const diagnostics = [];

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

  const ioSingleRanges = [
    ['READDI', 0, 511], ['READDO', 0, 511], ['READABIT', 0, 511],
    ['SETDO', 0, 511], ['SETABIT', 0, 511]
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
      if (value !== null && ![0, 1].includes(value)) addRangeDiagnostic(diagnostics, call, lineNum, `${fn} 写入值应为 0 或 1`, DiagnosticCode.FUNCTION_IO_VALUE_RANGE);
    }
  }

  for (const fn of ['READRREGBIT', 'SETRREGBIT']) {
    for (const call of getStaticFunctionCalls(clean, fn)) {
      const reg = parseStaticNumber(call.args[0] || '');
      const bit = parseStaticNumber(call.args[1] || '');
      if (reg !== null && (!Number.isInteger(reg) || reg < 0 || reg > 65535)) {
        addRangeDiagnostic(diagnostics, call, lineNum, `${fn} 的 R 值编号范围为 0~65535`, DiagnosticCode.FUNCTION_R_REGISTER_RANGE);
      }
      if (bit !== null && (!Number.isInteger(bit) || bit < 0 || bit > 31)) {
        addRangeDiagnostic(diagnostics, call, lineNum, `${fn} 的 bit 范围为 0~31`, DiagnosticCode.FUNCTION_R_BIT_RANGE);
      }
    }
  }

  for (const fn of ['ALARM', 'MSG']) {
    for (const call of getStaticFunctionCalls(clean, fn)) {
      const id = parseStaticNumber(call.args[0] || '');
      if (id !== null && (!Number.isInteger(id) || id < 0 || id > 65535)) addRangeDiagnostic(diagnostics, call, lineNum, `${fn} ID 范围为 0~65535`, DiagnosticCode.FUNCTION_ID_RANGE);
    }
  }

  for (const call of getStaticFunctionCalls(clean, 'PARAM')) {
    for (const arg of call.args.slice(0, 2)) {
      const value = parseStaticNumber(arg);
      if (value !== null && !Number.isInteger(value)) addRangeDiagnostic(diagnostics, call, lineNum, 'PARAM 引数需为整数', DiagnosticCode.FUNCTION_INTEGER_ARGUMENT);
    }
  }

  for (const call of getStaticFunctionCalls(clean, 'CHKINF')) {
    const category = parseStaticNumber(call.args[0] || '');
    if (category !== null && (!Number.isInteger(category) || category < 1 || category > 5)) addRangeDiagnostic(diagnostics, call, lineNum, 'CHKINF 类别范围为 1~5', DiagnosticCode.FUNCTION_CHKINF_CATEGORY_RANGE);
  }

  const commentStripped = stripCommentsKeepStringsWithState(raw || '', lineStartInBlock).text;
  const openComMatch = commentStripped.match(/\bOPEN\s*\(\s*"COM\d+"\s*\)/i);
  if (openComMatch) {
    diagnostics.push(createWarning(lineNum, openComMatch.index, openComMatch.index + openComMatch[0].length, '串口传输埠仅支持 OPEN("COM")；OPEN("COM1") 会按普通文件名处理', {
      code: DiagnosticCode.FUNCTION_OPEN_COM_PORT
    }));
  }

  return diagnostics;
}

module.exports = {
  validateStaticFunctionArguments
};
