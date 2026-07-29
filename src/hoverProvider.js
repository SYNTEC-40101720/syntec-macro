// hoverProvider.js
// 悬停文档：函数、关键字、G/M 代码、变量、运算符

const vscode = require('vscode');
const { getAllKeywords, getKeywordDoc } = require('./keywords');
const { getCodeDoc, getG10LCodeDoc } = require('./codeDocs');
const { functionIndex, isFeatureEnabled } = require('./providerShared');

const SYMBOL_OPERATORS = [':=', '<>', '<=', '>=', '&', '=', '<', '>', '+', '-', '*', '/'];

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

module.exports = { provideHover };
