// extension.js
// VSCode 扩展主入口：提供 IntelliSense / Hover / 诊断

const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const { functions, buildFunctionIndex } = require('./functions');
const { keywords, getAllKeywords, getMCodeDesc, getKeywordDoc } = require('./keywords');
const { validateDocument } = require('./validator');
const { DiagnosticCode } = require('./diagnosticCodes');
const { normalizeProgramName, normalizeSubprogramName, buildFileCandidates } = require('./fileResolver');
const { buildFunctionSnippet } = require('./completionSnippets');
const { formatSyntecMacroDocument } = require('./formatter');
const { getCodeDoc, getG10LCodeDoc } = require('./codeDocs');
const packageJson = require('../package.json');

const LANG_ID = 'syntec-macro';
const RECURSIVE_SEARCH_DEPTH = 5;
const VARIABLE_COMPLETION_COUNT = 20;
const DIAGNOSTIC_DEBOUNCE_MS = 300;
const BIG_VARIABLES = [100, 500, 1000, 2000, 9901, 9902, 9903, 9904, 9905, 9906];
const SYMBOL_OPERATORS = [':=', '<>', '<=', '>=', '&', '=', '<', '>', '+', '-', '*', '/'];

const functionIndex = buildFunctionIndex();

function getConfig(resource) {
  return vscode.workspace.getConfiguration('syntecMacro', resource);
}

function isFeatureEnabled(resource, key) {
  return getConfig(resource).get(key, true);
}

function createNLabelRegex(labelNo) {
  if (labelNo) return new RegExp('^N' + labelNo + '\\s*;', 'i');
  return /^N(\d+)\s*;/i;
}

function getRegexRangeAtPosition(document, position, regex) {
  const line = document.lineAt(position.line).text;
  let match;
  regex.lastIndex = 0;
  while ((match = regex.exec(line)) !== null) {
    const start = match.index;
    const end = start + match[0].length;
    if (position.character >= start && position.character <= end) {
      return new vscode.Range(position.line, start, position.line, end);
    }
  }
  return null;
}

function getSymbolOperatorRangeAtPosition(document, position) {
  const line = document.lineAt(position.line).text;
  for (const operator of SYMBOL_OPERATORS) {
    let index = line.indexOf(operator);
    while (index >= 0) {
      const end = index + operator.length;
      if (operator === '=' && (line[index - 1] === ':' || line[index - 1] === '=' || line[end] === '=')) {
        index = line.indexOf(operator, index + 1);
        continue;
      }
      if (operator === '/' && (line[index - 1] === '/' || line[end] === '/')) {
        index = line.indexOf(operator, index + 1);
        continue;
      }
      if (position.character >= index && position.character <= end) {
        return { operator, range: new vscode.Range(position.line, index, position.line, end) };
      }
      index = line.indexOf(operator, index + 1);
    }
  }
  return null;
}

function createKeywordHover(keyword, range) {
  const kwDoc = getKeywordDoc(keyword);
  if (!kwDoc) return null;
  const md = new vscode.MarkdownString();
  md.appendCodeblock(kwDoc.sig, 'syntec-macro');
  md.appendMarkdown('\n' + kwDoc.doc);
  return new vscode.Hover(md, range);
}

function createCodeHover(code, range) {
  const codeDoc = getCodeDoc(code);
  if (!codeDoc) {
    return new vscode.Hover(new vscode.MarkdownString(code.startsWith('G') ? '**G代码**: ' + code : '**M代码**: ' + code), range);
  }

  const md = new vscode.MarkdownString();
  md.appendCodeblock(codeDoc.sig, 'syntec-macro');
  md.appendMarkdown('\n' + codeDoc.doc);
  return new vscode.Hover(md, range);
}

function getG10LCodeRangeAtPosition(document, position) {
  const line = document.lineAt(position.line).text;
  const regex = /\bG10\s+(L1000|L1021|L1022|L1803|L1805|L1810|L1820|L1900|L1901|L1910|L1911)\b/ig;
  let match;
  while ((match = regex.exec(line)) !== null) {
    const start = match.index;
    const end = start + match[0].length;
    if (position.character >= start && position.character <= end) {
      return {
        lCode: match[1].toUpperCase(),
        range: new vscode.Range(position.line, start, position.line, end)
      };
    }
  }
  return null;
}

function createG10LCodeHover(lCode, range) {
  const doc = getG10LCodeDoc(lCode);
  if (!doc) return null;
  const md = new vscode.MarkdownString();
  md.appendCodeblock(doc.sig, 'syntec-macro');
  md.appendMarkdown('\n' + doc.doc.replace(/\n/g, '\n\n'));
  return new vscode.Hover(md, range);
}

// =====================
// 1. Completion Provider
// =====================

function provideFunctionCompletions(prefix, items) {
  for (const fn of functions) {
    if (fn.name.startsWith(prefix)) {
      const item = new vscode.CompletionItem(fn.name, vscode.CompletionItemKind.Function);
      item.detail = fn.sig;
      item.documentation = new vscode.MarkdownString('`syntec-macro\n' + fn.sig + '\n`\n\n' + fn.doc);
      item.insertText = new vscode.SnippetString(buildFunctionSnippet(fn));
      items.push(item);
    }
  }
}

function provideKeywordCompletions(prefix, items) {
  const allKeywords = getAllKeywords();
  for (const kw of allKeywords) {
    if (kw.startsWith(prefix) && kw !== 'GOTO') {
      const item = new vscode.CompletionItem(kw, vscode.CompletionItemKind.Keyword);
      const kwDoc = getKeywordDoc(kw);
      if (kwDoc) {
        item.detail = kwDoc.sig;
        item.documentation = new vscode.MarkdownString(kwDoc.doc);
      }
      items.push(item);
    }
  }
}

function provideGCodeCompletions(prefix, items) {
  if (!prefix.startsWith('G')) return;
  for (const g of keywords.gcodes) {
    if (!g.startsWith(prefix)) continue;
    const item = new vscode.CompletionItem(g, vscode.CompletionItemKind.EnumMember);
    item.detail = 'G代码';
    items.push(item);
  }
}

function provideMCodeCompletions(prefix, items) {
  if (!prefix.startsWith('M')) return;
  for (const m of keywords.mcodes) {
    if (!m.startsWith(prefix)) continue;
    const item = new vscode.CompletionItem(m, vscode.CompletionItemKind.EnumMember);
    item.detail = getMCodeDesc(m);
    items.push(item);
  }
}

function provideVariableCompletions() {
  const items = [];
  for (let i = 1; i <= VARIABLE_COMPLETION_COUNT; i++) {
    const item = new vscode.CompletionItem('#' + i, vscode.CompletionItemKind.Variable);
    item.detail = '局部变量 #' + i;
    item.insertText = String(i);
    items.push(item);
  }
  for (const v of BIG_VARIABLES) {
    const item = new vscode.CompletionItem('#' + v, vscode.CompletionItemKind.Variable);
    item.detail = '局部变量 #' + v;
    item.insertText = String(v);
    items.push(item);
  }
  return items;
}

function provideCompletionItems(document, position) {
  if (!isFeatureEnabled(document.uri, 'enableCompletions')) return [];

  const line = document.lineAt(position).text;
  const textBefore = line.substring(0, position.character);

  if (textBefore.endsWith('#')) {
    return provideVariableCompletions();
  }

  const items = [];
  const wordMatch = textBefore.match(/[A-Za-z_][A-Za-z0-9_]*$/);
  if (!wordMatch) return items;

  const prefix = wordMatch[0].toUpperCase();

  provideFunctionCompletions(prefix, items);
  provideKeywordCompletions(prefix, items);
  provideGCodeCompletions(prefix, items);
  provideMCodeCompletions(prefix, items);

  return items;
}

// =====================
// 2. Hover Provider
// =====================
function provideHover(document, position) {
  if (!isFeatureEnabled(document.uri, 'enableHover')) return null;

  const dynamicMCodeRange = getRegexRangeAtPosition(document, position, /\bM#\d+\b/g);
  if (dynamicMCodeRange) {
    const code = document.getText(dynamicMCodeRange).toUpperCase();
    return new vscode.Hover(new vscode.MarkdownString('**动态 M 代码**: ' + code), dynamicMCodeRange);
  }

  const appVariableRange = getRegexRangeAtPosition(document, position, /\b(?:AR|MAR)(?:\d+|\[[^\]]+\])/g);
  if (appVariableRange) {
    const variable = document.getText(appVariableRange).toUpperCase();
    return new vscode.Hover(new vscode.MarkdownString('**应用变量**: ' + variable), appVariableRange);
  }

  const axisGroupRange = getRegexRangeAtPosition(document, position, /\$[1-4]\b/g);
  if (axisGroupRange) {
    const axisGroup = document.getText(axisGroupRange).toUpperCase();
    return new vscode.Hover(new vscode.MarkdownString('**轴群识别**: ' + axisGroup), axisGroupRange);
  }

  const g10LCode = getG10LCodeRangeAtPosition(document, position);
  if (g10LCode) {
    return createG10LCodeHover(g10LCode.lCode, g10LCode.range);
  }

  const variableRange = getRegexRangeAtPosition(document, position, /#\[[^\]]+\]|#[1-9]\d*|@\[[^\]]+\]|@\d+/g);
  if (variableRange) {
    const variable = document.getText(variableRange).toUpperCase();
    return new vscode.Hover(new vscode.MarkdownString('**变量**: ' + variable), variableRange);
  }

  const codeRange = getRegexRangeAtPosition(document, position, /\b[GM]\d+(?:\.\d+)?\b/g);
  if (codeRange) {
    const code = document.getText(codeRange).toUpperCase();
    return createCodeHover(code, codeRange);
  }

  const symbolOperator = getSymbolOperatorRangeAtPosition(document, position);
  if (symbolOperator) {
    const hover = createKeywordHover(symbolOperator.operator, symbolOperator.range);
    if (hover) return hover;
  }

  const range = document.getWordRangeAtPosition(position, /[A-Za-z_][A-Za-z0-9_]*/);
  if (!range) return null;

  const word = document.getText(range).toUpperCase();

  // 查找函数
  const fn = functionIndex.get(word);
  if (fn) {
    const md = new vscode.MarkdownString();
    md.appendCodeblock(fn.sig, 'syntec-macro');
    md.appendMarkdown('\n' + fn.doc.replace(/\n/g, '\n\n'));
    return new vscode.Hover(md, range);
  }

  // 查找关键字
  const allKw = getAllKeywords();
  if (allKw.includes(word)) {
    const kwDoc = getKeywordDoc(word);
    if (kwDoc) {
      return createKeywordHover(word, range);
    }
    const md = new vscode.MarkdownString('**关键字**: ' + word);
    return new vscode.Hover(md, range);
  }

  return null;
}

// =====================
// 3. Go-to Definition
// =====================
function getTargetMatchAtPosition(document, position, regex, targetGroupIndex = 2) {
  const line = document.lineAt(position).text;
  let match;
  regex.lastIndex = 0;
  while ((match = regex.exec(line)) !== null) {
    const prefix = match.slice(1, targetGroupIndex).join('');
    const target = match[targetGroupIndex];
    const targetStart = match.index + prefix.length;
    const targetEnd = targetStart + target.length;
    if (position.character >= targetStart && position.character <= targetEnd) {
      return {
        text: target,
        range: new vscode.Range(position.line, targetStart, position.line, targetEnd)
      };
    }
  }
  return null;
}

function provideDefinition(document, position) {
  // GOTO 数字 → 跳转到 N 标签
  // 实测语法：GOTO 100;（不带N），目标为 N100;
  const gotoTarget = getTargetMatchAtPosition(document, position, /\b(GOTO\s+)(\d+)(?!\w)/ig);
  if (gotoTarget) {
    const targetLabel = 'N' + gotoTarget.text;
    const labelRegex = createNLabelRegex(gotoTarget.text);
    const targets = [];
    for (let i = 0; i < document.lineCount; i++) {
      const rawLine = document.lineAt(i).text;
      const l = rawLine.trim();
      if (labelRegex.test(l)) {
        const start = rawLine.search(/\S/);
        const labelRange = new vscode.Range(i, start, i, start + targetLabel.length);
        targets.push(new vscode.Location(document.uri, labelRange));
      }
    }
    return targets;
  }

  // G65/G66/G66.1 Pxxx → 跳转到宏程序（文件名约定 G0xxx）
  const macroCallTarget = getTargetMatchAtPosition(document, position, /\b(G6[56](?:\.1)?\s+)(P\w+)/ig);
  if (macroCallTarget) {
    const progNo = macroCallTarget.text.substring(1).toUpperCase();
    // 尝试在当前工作区找同名文件
    const targetFile = findMacroFile(document, progNo, normalizeProgramName);
    if (targetFile) {
      return [new vscode.Location(vscode.Uri.file(targetFile), new vscode.Position(0, 0))];
    }
  }

  // G65/G66/G66.1 P"Name" → 跳转到同名宏程序文件（静态字符串字面量）
  const stringMacroCallTarget = getTargetMatchAtPosition(document, position, /\b(G6[56](?:\.1)?\s+)(P")([^"]+)(")/ig, 3);
  if (stringMacroCallTarget) {
    const targetFile = findMacroFile(document, stringMacroCallTarget.text, name => name);
    if (targetFile) {
      return [new vscode.Location(vscode.Uri.file(targetFile), new vscode.Position(0, 0))];
    }
  }

  // M98/M198 Pxxx → 跳转到 O 副程序（文件名约定 O0xxx）
  const subprogramCallTarget = getTargetMatchAtPosition(document, position, /\b(M(?:98|198)\s+)(P\w+)/ig);
  if (subprogramCallTarget) {
    const progNo = subprogramCallTarget.text.substring(1).toUpperCase();
    const targetFile = findMacroFile(document, progNo, normalizeSubprogramName);
    if (targetFile) {
      return [new vscode.Location(vscode.Uri.file(targetFile), new vscode.Position(0, 0))];
    }
  }

  return [];
}

// 在工作区查找宏程序文件
function findMacroFile(document, progNo, normalizeName = normalizeProgramName) {
  const folder = vscode.workspace.getWorkspaceFolder(document.uri);
  if (!folder) return null;

  const dir = folder.uri.fsPath;
  const fileName = normalizeName(progNo);

  const candidates = buildFileCandidates(dir, fileName);

  for (const c of candidates) {
    try { if (fs.existsSync(c)) return c; } catch {}
  }

  const recursiveCandidates = buildFileCandidates('', fileName)
    .map(candidate => path.basename(candidate).toUpperCase());

  let found = findFileRecursive(dir, new Set(recursiveCandidates), RECURSIVE_SEARCH_DEPTH);
  if (found) return found;

  // includePath 配置支持
  const config = getConfig(document.uri);
  const includePaths = config.get('includePath', []);
  if (Array.isArray(includePaths)) {
    for (const p of includePaths) {
      if (typeof p !== 'string') continue;
      let stat;
      try { stat = fs.statSync(p); } catch { continue; }
      if (!stat.isDirectory()) continue;
      const cands = buildFileCandidates(p, fileName);
      for (const c of cands) {
        try { if (fs.existsSync(c)) return c; } catch {}
      }
      found = findFileRecursive(p, new Set(recursiveCandidates), RECURSIVE_SEARCH_DEPTH);
      if (found) return found;
    }
  }

  return null;
}

function findFileRecursive(dir, targetUpperNames, maxDepth, depth = 0) {
  if (depth > maxDepth) return null;
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return null;
  }

  for (const entry of entries) {
    if (targetUpperNames.has(entry.name.toUpperCase())) return path.join(dir, entry.name);
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist') continue;
    const found = findFileRecursive(path.join(dir, entry.name), targetUpperNames, maxDepth, depth + 1);
    if (found) return found;
  }

  return null;
}

// =====================
// 4. Diagnostics（实时语法检查）
// =====================
let diagnosticCollection;
const diagnosticTimers = new Map();

function scheduleDiagnostics(document) {
  const key = document.uri.toString();
  clearTimeout(diagnosticTimers.get(key));
  diagnosticTimers.set(key, setTimeout(() => {
    diagnosticTimers.delete(key);
    refreshDiagnostics(document);
  }, DIAGNOSTIC_DEBOUNCE_MS));
}

function refreshDiagnostics(document) {
  if (!diagnosticCollection) return;
  if (document.languageId !== LANG_ID) return;
  if (!isFeatureEnabled(document.uri, 'enableDiagnostics')) {
    diagnosticCollection.delete(document.uri);
    return;
  }

  const text = document.getText();
  const seenProblems = new Set();
  const problems = validateDocument(text).filter(p => {
    const key = [p.line, p.col, p.endCol || p.col + 1, p.severity, p.msg].join('|');
    if (seenProblems.has(key)) return false;
    seenProblems.add(key);
    return true;
  });

  const diagnostics = problems.map(p => {
    const d = new vscode.Diagnostic(
      new vscode.Range(p.line - 1, p.col, p.line - 1, p.endCol || p.col + 1),
      p.msg,
      p.severity === 'error' ? vscode.DiagnosticSeverity.Error : vscode.DiagnosticSeverity.Warning
    );
    d.source = 'syntec-macro';
    if (p.code) d.code = p.code;
    return d;
  });

  diagnosticCollection.set(document.uri, diagnostics);
}

function createInsertSemicolonAction(document, diagnostic) {
  const action = new vscode.CodeAction('补上行尾 ;', vscode.CodeActionKind.QuickFix);
  const edit = new vscode.WorkspaceEdit();
  const line = document.lineAt(diagnostic.range.start.line);
  const character = Math.min(diagnostic.range.start.character, line.text.length);
  edit.insert(document.uri, new vscode.Position(diagnostic.range.start.line, character), ';');
  action.edit = edit;
  action.diagnostics = [diagnostic];
  action.isPreferred = true;
  return action;
}

function createRemoveSemicolonAction(document, diagnostic) {
  const action = new vscode.CodeAction('移除控制结构行尾 ;', vscode.CodeActionKind.QuickFix);
  const edit = new vscode.WorkspaceEdit();
  edit.delete(document.uri, diagnostic.range);
  action.edit = edit;
  action.diagnostics = [diagnostic];
  action.isPreferred = true;
  return action;
}

const DIAGNOSTIC_REPLACEMENTS = {
  [DiagnosticCode.UNSUPPORTED_ELSIF]: { title: '改为 ELSEIF', text: 'ELSEIF' },
  [DiagnosticCode.UNSUPPORTED_DEFAULT]: { title: '改为 ELSE', text: 'ELSE' },
  [DiagnosticCode.UNSUPPORTED_DIV]: { title: '改为 /', text: '/' },
  [DiagnosticCode.UNSUPPORTED_EQUALITY_OPERATOR]: { title: '改为 =', text: '=' },
  [DiagnosticCode.UNSUPPORTED_INEQUALITY_OPERATOR]: { title: '改为 <>', text: '<>' },
  [DiagnosticCode.UNSUPPORTED_LOGICAL_AND_OPERATOR]: { title: '改为 AND', text: 'AND' },
  [DiagnosticCode.UNSUPPORTED_LOGICAL_OR_OPERATOR]: { title: '改为 OR', text: 'OR' },
  [DiagnosticCode.UNSUPPORTED_PERCENT_OPERATOR]: { title: '改为 MOD', text: ' MOD ' }
};

const FANUC_COMPARISON_REPLACEMENTS = {
  EQ: '=',
  NE: '<>',
  GT: '>',
  GE: '>=',
  LT: '<',
  LE: '<='
};

const BLOCK_CLOSERS = {
  IF: 'END_IF;',
  FOR: 'END_FOR;',
  WHILE: 'END_WHILE;',
  CASE: 'END_CASE;'
};

const DIAGNOSTIC_HELP = {
  [DiagnosticCode.NAMED_LOCAL_VARIABLE]: '新代 MACRO 局部变量使用数字编号，例如 #1、#100 或 #[表达式]；#TEMP 这类命名局部变量不支持，需改为规划好的数字变量。',
  [DiagnosticCode.NAMED_GLOBAL_VARIABLE]: '新代 MACRO 公用变量使用数字编号，例如 @1、@1000 或 @[表达式]；@TEMP 这类命名公用变量不支持，需改为规划好的数字变量。',
  [DiagnosticCode.VACANT_ASSIGNMENT]: '#0/@0 为 VACANT，只读并表示空值；请不要作为赋值目标，可改用可写的数字变量。',
  [DiagnosticCode.INVALID_APP_VARIABLE_NUMBER]: 'AR/MAR APP 变量编号必须为非负整数；请使用 AR0、MAR53、AR[#1] 这类合法编号形式。',
  [DiagnosticCode.FUNCTION_MATH_DOMAIN]: { title: '查看函数定义域说明', message: '该数学函数的静态参数落在控制器定义域外；请调整为控制器允许的数值范围，避免运行时 COR 运算域错误。' },
  [DiagnosticCode.FUNCTION_IO_POINT_RANGE]: { title: '查看 I/O 点位范围说明', message: 'READ/SET I/O 点编号需为静态整数且落在控制器支持范围内；常见 DI/DO/A 点编号范围为 0~511。' },
  [DiagnosticCode.FUNCTION_IO_VALUE_RANGE]: { title: '查看 I/O 写入值说明', message: 'SETDO、SETABIT、SETRREGBIT 的写入值需为 0 或 1；请根据实际开/关意图调整。' },
  [DiagnosticCode.FUNCTION_R_REGISTER_RANGE]: { title: '查看 R 寄存器范围说明', message: 'READRREGBIT/SETRREGBIT 的 R 编号需为 0~65535 的整数。' },
  [DiagnosticCode.FUNCTION_R_BIT_RANGE]: { title: '查看 R bit 范围说明', message: 'READRREGBIT/SETRREGBIT 的 bit 编号需为 0~31 的整数。' },
  [DiagnosticCode.FUNCTION_ID_RANGE]: { title: '查看 ID 范围说明', message: 'ALARM/MSG 的静态 ID 需为 0~65535 的整数。' },
  [DiagnosticCode.FUNCTION_INTEGER_ARGUMENT]: { title: '查看整数参数说明', message: '该函数的静态参数需为整数；请移除小数点或改用运行期变量表达式。' },
  [DiagnosticCode.FUNCTION_CHKINF_CATEGORY_RANGE]: { title: '查看 CHKINF 类别说明', message: 'CHKINF 类别编号需为 1~5 的整数。' },
  [DiagnosticCode.FUNCTION_OPEN_COM_PORT]: { title: '查看 OPEN COM 说明', message: '串口传输埠语法为 OPEN("COM")；OPEN("COM1") 会按普通文件名处理。' },
  [DiagnosticCode.ROBOT_UNSUPPORTED_MOVC_POINT_ARG]: { title: '查看 MOVC 点位参数说明', message: 'MOVC 不支持 Xp/Yp/Zp 点写法；请改用成对 MOVC 的 X/Y/Z/A/B/C 直接引数，或新版 X1/X2 单行写法。' },
  [DiagnosticCode.ROBOT_SMOOTH_ARG_CONFLICT]: { title: '查看平滑引数说明', message: 'MOVL/MOVC/INCMOVL 单行只能使用 PL/PQ/PR 其中一种平滑引数；请保留实际需要的一项。' },
  [DiagnosticCode.ROBOT_UNSUPPORTED_SMOOTH_ARG]: { title: '查看平滑引数说明', message: 'MOVJ/INCMOVJ 不支持 PQ/PR；请使用 PL 或移除不支持的平滑引数。' },
  [DiagnosticCode.ROBOT_UNSUPPORTED_MOVJ_P_ARG]: { title: '查看 MOVJ P 引数说明', message: 'MOVJ 第一语法不支持 P 引数；若要使用点位/末端位置语法，请提供 X/Y/Z/A/B/C 等末端位置引数。' },
  [DiagnosticCode.ROBOT_MISSING_REQUIRED_ARG]: { title: '查看必填引数说明', message: 'INCMOVL 需要 P 引数；请按现场程序意图补入 P_。' },
  [DiagnosticCode.ROBOT_STITCH_ARG_CONFLICT]: { title: '查看 STITCHON 引数说明', message: 'STITCHON 的 L/K 只能择一输入；请保留距离 L 或 K 中实际需要的一项。' },
  [DiagnosticCode.ROBOT_STITCH_MISSING_ARG]: { title: '查看 STITCHON 引数说明', message: 'STITCHON 需指定 L 或 K 其中一个；请按加工需求补入。' },
  [DiagnosticCode.ROBOT_STITCH_L_INTEGER]: { title: '查看 STITCHON L 引数说明', message: 'STITCHON 的 L 引数不可带小数点；请使用整数距离值。' },
  [DiagnosticCode.ROBOT_WEAVEON_MIXED_ARGS]: { title: '查看 WEAVEON 引数说明', message: 'WEAVEON 的 P 语法不可与 E/Q/K/L/R/I 细节引数混用；请选择参数组或细节参数其中一种写法。' },
  [DiagnosticCode.ROBOT_WEAVEON_Q_DECIMAL]: { title: '查看 WEAVEON Q 引数说明', message: 'WEAVEON 的 Q 频率建议使用小数形式，例如 Q1.0。' },
  [DiagnosticCode.ROBOT_MOVC_PAIR_REQUIRED]: { title: '查看 MOVC 成对规则', message: '旧式 MOVC 圆弧需要成对出现：第一行为中间点，第二行为结束点；新版单行写法需使用 X1/X2 点位组。' },
  [DiagnosticCode.ROBOT_SWAITSIG_LIMIT]: { title: '查看 SWAITSIG 限制', message: '同一运动单节后只能下 1 个 SWAITSIG；多个条件请用 WAIT() 隔开或改用对应等待指令。' },
  [DiagnosticCode.ROBOT_SYNCOUT_LIMIT]: { title: '查看 SYNCOUT 限制', message: '同一有移动量移动单节最多允许 10 个 SYNCOUT；请拆分运动单节或减少同步输出。' },
  [DiagnosticCode.ROBOT_RANGE_FORBIDDEN_COMMAND]: { title: '查看机器人区间限制', message: '当前指令位于 STITCHON/WEAVEON/WAITSYNC/G192.1 等特殊区间内，控制器不支持该组合；请移出区间或关闭对应模式后再使用。' }
};

function getDiagnosticText(document, diagnostic) {
  return document.getText(diagnostic.range).trim().toUpperCase();
}

function createReplacementAction(document, diagnostic, title, replacement) {
  const action = new vscode.CodeAction(title, vscode.CodeActionKind.QuickFix);
  const edit = new vscode.WorkspaceEdit();
  edit.replace(document.uri, diagnostic.range, replacement);
  action.edit = edit;
  action.diagnostics = [diagnostic];
  action.isPreferred = true;
  return action;
}

function createDeleteDiagnosticRangeAction(document, diagnostic, title) {
  const action = new vscode.CodeAction(title, vscode.CodeActionKind.QuickFix);
  const edit = new vscode.WorkspaceEdit();
  edit.delete(document.uri, diagnostic.range);
  action.edit = edit;
  action.diagnostics = [diagnostic];
  action.isPreferred = true;
  return action;
}

function createDiagnosticHelpAction(diagnostic, title, message) {
  const action = new vscode.CodeAction(title, vscode.CodeActionKind.QuickFix);
  action.command = {
    command: 'syntecMacro.showDiagnosticHelp',
    title,
    arguments: [message]
  };
  action.diagnostics = [diagnostic];
  return action;
}

function getDiagnosticHelpAction(diagnostic, entry) {
  if (typeof entry === 'string') return createDiagnosticHelpAction(diagnostic, '查看变量规则说明', entry);
  return createDiagnosticHelpAction(diagnostic, entry.title, entry.message);
}

function getDiagnosticCode(diagnostic) {
  if (typeof diagnostic.code === 'string') return diagnostic.code;
  if (diagnostic.code && typeof diagnostic.code.value === 'string') return diagnostic.code.value;
  return undefined;
}

function createDiagnosticFromProblem(problem) {
  const diagnostic = new vscode.Diagnostic(
    new vscode.Range(problem.line - 1, problem.col, problem.line - 1, problem.endCol || problem.col + 1),
    problem.msg,
    problem.severity === 'error' ? vscode.DiagnosticSeverity.Error : vscode.DiagnosticSeverity.Warning
  );
  diagnostic.source = 'syntec-macro';
  if (problem.code) diagnostic.code = problem.code;
  if (problem.keyword) diagnostic.syntecKeyword = problem.keyword;
  return diagnostic;
}

function getUnclosedBlockKeyword(diagnostic) {
  if (diagnostic.syntecKeyword) return diagnostic.syntecKeyword;
  const match = diagnostic.message.match(/^([A-Z_]+) 块缺少对应的 END_/);
  return match ? match[1] : null;
}

function createInsertBlockCloserAction(document, diagnostic) {
  const keyword = getUnclosedBlockKeyword(diagnostic);
  const closer = BLOCK_CLOSERS[keyword];
  if (!closer) return null;

  const action = new vscode.CodeAction(`插入 ${closer}`, vscode.CodeActionKind.QuickFix);
  const edit = new vscode.WorkspaceEdit();
  const lastLine = document.lineAt(document.lineCount - 1);
  const prefix = lastLine.text.length > 0 ? '\n' : '';
  edit.insert(document.uri, lastLine.range.end, prefix + closer);
  action.edit = edit;
  action.diagnostics = [diagnostic];
  action.isPreferred = true;
  return action;
}

function rangeIntersects(a, b) {
  return a.intersection(b) !== undefined || a.contains(b.start) || b.contains(a.start);
}

function getActionableDiagnostics(document, range, context) {
  const diagnostics = context.diagnostics.filter(diagnostic =>
    diagnostic.source === 'syntec-macro' && getDiagnosticCode(diagnostic)
  );
  if (diagnostics.length > 0) return diagnostics;

  return validateDocument(document.getText())
    .filter(problem => problem.code)
    .map(createDiagnosticFromProblem)
    .filter(diagnostic => rangeIntersects(diagnostic.range, range));
}

function provideCodeActions(document, _range, context) {
  const actions = [];
  for (const diagnostic of getActionableDiagnostics(document, _range, context)) {
    const code = getDiagnosticCode(diagnostic);
    if (code === DiagnosticCode.MISSING_SEMICOLON) {
      actions.push(createInsertSemicolonAction(document, diagnostic));
    } else if (code === DiagnosticCode.CONTROL_STRUCTURE_TRAILING_SEMICOLON) {
      actions.push(createRemoveSemicolonAction(document, diagnostic));
    } else if (code === DiagnosticCode.CONTROL_UNCLOSED_BLOCK) {
      const action = createInsertBlockCloserAction(document, diagnostic);
      if (action) actions.push(action);
    } else if (code === DiagnosticCode.ROBOT_DIRECT_ARG_EQUALS) {
      actions.push(createDeleteDiagnosticRangeAction(document, diagnostic, '移除直接引数 ='));
    } else if (code === DiagnosticCode.ROBOT_DEPRECATED_MOVJ_II) {
      actions.push(createReplacementAction(document, diagnostic, '改为 MOVJ', 'MOVJ'));
    } else if (code === DiagnosticCode.ROBOT_TOOLCOR_T_ARG) {
      actions.push(createReplacementAction(document, diagnostic, '改为 P 引数', 'P'));
    } else if (code === DiagnosticCode.ROBOT_TOOLCORON_DEPRECATED) {
      actions.push(createReplacementAction(document, diagnostic, '改为 TOOLCOR', 'TOOLCOR'));
    } else if (code === DiagnosticCode.ROBOT_TOOLCOR_CLEAR) {
      actions.push(createReplacementAction(document, diagnostic, '改为 TOOLCOR P0', 'TOOLCOR P0'));
    } else if (code === DiagnosticCode.UNSUPPORTED_FANUC_COMPARISON) {
      const keyword = getDiagnosticText(document, diagnostic);
      const replacement = FANUC_COMPARISON_REPLACEMENTS[keyword];
      if (replacement) actions.push(createReplacementAction(document, diagnostic, `改为 ${replacement}`, replacement));
    } else if (code === DiagnosticCode.ASSIGNMENT_STYLE_EQUALS) {
      actions.push(createReplacementAction(document, diagnostic, '改为 :=', ':='));
    } else if (Object.prototype.hasOwnProperty.call(DIAGNOSTIC_REPLACEMENTS, code)) {
      const replacement = DIAGNOSTIC_REPLACEMENTS[code];
      if (replacement) actions.push(createReplacementAction(document, diagnostic, replacement.title, replacement.text));
    } else if (Object.prototype.hasOwnProperty.call(DIAGNOSTIC_HELP, code)) {
      actions.push(getDiagnosticHelpAction(diagnostic, DIAGNOSTIC_HELP[code]));
    }
  }
  return actions;
}

// =====================
// 5. 标签符号（N 码导航）
// =====================
function provideDocumentSymbol(document) {
  const symbols = [];
  for (let i = 0; i < document.lineCount; i++) {
    const line = document.lineAt(i);
    const text = line.text.trim();
    // N标签行（如 N100;）
    const labelMatch = text.match(createNLabelRegex());
    if (labelMatch) {
      const sym = new vscode.DocumentSymbol(
        'N' + labelMatch[1],
        '标签 N' + labelMatch[1],
        vscode.SymbolKind.Number,
        line.range,
        line.range,
        []
      );
      symbols.push(sym);
    }
    // 宏程序入口 %@MACRO
    const macroMatch = text.match(/^%@MACRO/);
    if (macroMatch) {
      const sym = new vscode.DocumentSymbol(
        '%@MACRO',
        '宏程序入口',
        vscode.SymbolKind.Namespace,
        line.range,
        line.range,
        []
      );
      symbols.push(sym);
    }
  }
  return symbols;
}

// =====================
// 6. Formatting
// =====================
function provideDocumentFormattingEdits(document, options) {
  const formatted = formatSyntecMacroDocument(document.getText(), options);
  if (formatted === document.getText()) return [];
  const lastLine = document.lineAt(document.lineCount - 1);
  const fullRange = new vscode.Range(0, 0, document.lineCount - 1, lastLine.text.length);
  return [vscode.TextEdit.replace(fullRange, formatted)];
}

// =====================
// 扩展激活
// =====================
function activate(context) {
  // 注册语言服务
  const selector = { language: LANG_ID };

  // 颜色装饰器已通过 package.json configurationDefaults 禁用
  // 无需在代码中重复设置，避免在用户工作区产生 .vscode/settings.json

  // Completion
  context.subscriptions.push(
    vscode.languages.registerCompletionItemProvider(selector, {
      provideCompletionItems
    }, '.', '#')
  );

  // Hover
  context.subscriptions.push(
    vscode.languages.registerHoverProvider(selector, { provideHover })
  );

  // Go-to Definition
  context.subscriptions.push(
    vscode.languages.registerDefinitionProvider(selector, { provideDefinition })
  );

  // Document Symbols
  context.subscriptions.push(
    vscode.languages.registerDocumentSymbolProvider(selector, { provideDocumentSymbols: provideDocumentSymbol })
  );

  // Formatting
  context.subscriptions.push(
    vscode.languages.registerDocumentFormattingEditProvider(selector, { provideDocumentFormattingEdits })
  );

  // Diagnostics
  diagnosticCollection = vscode.languages.createDiagnosticCollection(LANG_ID);
  context.subscriptions.push(diagnosticCollection);

  context.subscriptions.push(
    vscode.commands.registerCommand('syntecMacro.showDiagnosticHelp', message => {
      vscode.window.showInformationMessage(message);
    })
  );

  context.subscriptions.push(
    vscode.languages.registerCodeActionsProvider(selector, { provideCodeActions }, {
      providedCodeActionKinds: [vscode.CodeActionKind.QuickFix]
    })
  );

  // 初始扫描 + 实时更新
  for (const doc of vscode.workspace.textDocuments) {
    scheduleDiagnostics(doc);
  }

  const changeWatcher = vscode.workspace.onDidChangeTextDocument(e => {
    scheduleDiagnostics(e.document);
  });
  context.subscriptions.push(changeWatcher);

  const openWatcher = vscode.workspace.onDidOpenTextDocument(doc => {
    scheduleDiagnostics(doc);
  });
  context.subscriptions.push(openWatcher);

  const configWatcher = vscode.workspace.onDidChangeConfiguration(e => {
    if (!e.affectsConfiguration('syntecMacro')) return;
    for (const doc of vscode.workspace.textDocuments) {
      scheduleDiagnostics(doc);
    }
  });
  context.subscriptions.push(configWatcher);

  // 状态栏提示
  const statusBar = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.right, 100
  );
  statusBar.text = ' Syntec Macro v' + packageJson.version;
  statusBar.tooltip = '新代宏程序扩展已激活';
  statusBar.show();
  context.subscriptions.push(statusBar);

  console.info('[syntec-macro] 扩展已激活 v' + packageJson.version);
}

function deactivate() {}

module.exports = { activate, deactivate };
