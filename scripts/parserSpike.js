// @ts-check
// M2 开发态容错 Parser 原型：不接入生产 Provider，仅用于比较 IR、错误恢复和性能。

// R1.2 Stage B: ../src/lexer removed; stripCommentsAndStringsWithState now throws on call.
const _r1_2_retired____src_lexer = (name) => () => { throw new Error('R1.2 Stage B: ' + name + ' retired (../src/lexer removed)'); };
const stripCommentsAndStringsWithState = _r1_2_retired____src_lexer('stripCommentsAndStringsWithState');
// R1.2 Stage B: ../src/statementClassifier removed; classifyStatement now throws on call.
const _r1_2_retired____src_statementClassifier = (name) => () => { throw new Error('R1.2 Stage B: ' + name + ' retired (../src/statementClassifier removed)'); };
const classifyStatement = _r1_2_retired____src_statementClassifier('classifyStatement');
// R1.2 Stage B: ../src/navigationSymbols removed; extractNavigationSymbols, extractStaticMacroCalls now throws on call.
const _r1_2_retired____src_navigationSymbols = (name) => () => { throw new Error('R1.2 Stage B: ' + name + ' retired (../src/navigationSymbols removed)'); };
const extractNavigationSymbols = _r1_2_retired____src_navigationSymbols('extractNavigationSymbols');
const extractStaticMacroCalls = _r1_2_retired____src_navigationSymbols('extractStaticMacroCalls');

const OPENERS = new Set(['IF', 'FOR', 'WHILE', 'CASE', 'REPEAT']);
const CLOSER_TO_OPENER = {
  END_IF: 'IF',
  END_FOR: 'FOR',
  END_WHILE: 'WHILE',
  END_CASE: 'CASE',
  END_REPEAT: 'REPEAT',
  ENDIF: 'IF',
  ENDFOR: 'FOR',
  ENDWHILE: 'WHILE',
  ENDCASE: 'CASE',
  ENDREPEAT: 'REPEAT'
};
const KEYWORDS = new Set([
  ...OPENERS,
  ...Object.keys(CLOSER_TO_OPENER),
  'ELSE',
  'ELSEIF',
  'UNTIL',
  'EXIT',
  'GOTO'
]);
const TOKEN_PATTERN = /#(?:\[[^\]]+\]|\d+)|@(?:\[[^\]]+\]|\d+)|G\d+(?:\.\d+)?|M\d+|N\d+|[A-Z_][A-Z0-9_.-]*|\d+(?:\.\d+)?|:=|<>|<=|>=|==|[()[\],;:+\-*/<>=:]/ig;

/**
 * @typedef {Object} ParserToken
 * @property {'identifier'|'variable'|'number'|'operator'|'punctuation'} kind
 * @property {string} text
 * @property {number} start
 * @property {number} end
 */

/**
 * @typedef {Object} ParserBlock
 * @property {string} keyword
 * @property {number} startLine
 * @property {number|null} endLine
 * @property {string|null} closedBy
 * @property {boolean} recovered
 */

/**
 * @typedef {Object} ParserLine
 * @property {number} line
 * @property {string} kind
 * @property {string[]} keywords
 * @property {ParserToken[]} tokens
 */

/**
 * @typedef {Object} ParserDiagnostic
 * @property {'unmatched-closer'|'unmatched-until'|'unclosed-block'} kind
 * @property {string} [keyword]
 * @property {number} line
 * @property {string} message
 */

/**
 * @typedef {Object} ParserResult
 * @property {number} version
 * @property {ParserLine[]} lines
 * @property {ParserBlock[]} blocks
 * @property {Object[]} symbols
 * @property {Object[]} calls
 * @property {ParserDiagnostic[]} diagnostics
 */

/**
 * @param {string} text
 * @returns {ParserToken[]}
 */
function tokenizeLine(text) {
  const tokens = [];
  let match;
  while ((match = TOKEN_PATTERN.exec(text)) !== null) {
    const tokenText = match[0];
    const upper = tokenText.toUpperCase();
    let kind = 'identifier';
    if (/^[#@]/.test(tokenText)) kind = 'variable';
    else if (/^\d/.test(tokenText)) kind = 'number';
    else if (/^(?::=|<>|<=|>=|==|[+\-*/<>=])$/.test(tokenText)) kind = 'operator';
    else if (/^[()[\],;:]$/.test(tokenText)) kind = 'punctuation';
    else if (/^(?:G|M|N)\d/i.test(tokenText)) kind = 'identifier';
    if (KEYWORDS.has(upper)) kind = 'identifier';
    tokens.push({
      kind,
      text: tokenText,
      start: match.index,
      end: match.index + tokenText.length
    });
  }
  TOKEN_PATTERN.lastIndex = 0;
  return tokens;
}

/**
 * @param {ParserBlock[]} stack
 * @param {string} closer
 * @param {number} line
 * @param {ParserDiagnostic[]} diagnostics
 * @returns {boolean}
 */
function closeBlock(stack, closer, line, diagnostics) {
  const opener = CLOSER_TO_OPENER[closer];
  let matchIndex = -1;
  for (let index = stack.length - 1; index >= 0; index--) {
    if (stack[index].keyword === opener) {
      matchIndex = index;
      break;
    }
  }
  if (matchIndex < 0) {
    diagnostics.push({
      kind: 'unmatched-closer',
      keyword: closer,
      line,
      message: `${closer} 没有匹配的 ${opener}`
    });
    return false;
  }

  for (let index = stack.length - 1; index > matchIndex; index--) {
    stack[index].recovered = true;
  }
  const block = stack[matchIndex];
  block.endLine = line;
  block.closedBy = closer;
  stack.splice(matchIndex);
  return true;
}

/**
 * @param {string} text
 * @returns {ParserResult}
 */
function parseMacroDocument(text) {
  if (typeof text !== 'string') throw new TypeError('parser text must be a string');

  const rawLines = text.split(/\r?\n/);
  const lines = [];
  const blocks = [];
  const stack = [];
  const diagnostics = [];
  let inBlockComment = false;

  for (let lineIndex = 0; lineIndex < rawLines.length; lineIndex++) {
    const scanned = stripCommentsAndStringsWithState(rawLines[lineIndex], inBlockComment);
    inBlockComment = scanned.inBlockComment;
    const clean = scanned.text;
    const tokens = tokenizeLine(clean);
    const keywords = tokens
      .map(token => token.text.toUpperCase())
      .filter(keyword => KEYWORDS.has(keyword));
    lines.push({
      line: lineIndex,
      kind: classifyStatement(clean),
      keywords,
      tokens
    });

    let closedRepeatByUntil = false;
    for (const keyword of keywords) {
      if (OPENERS.has(keyword)) {
        const block = {
          keyword,
          startLine: lineIndex,
          endLine: null,
          closedBy: null,
          recovered: false
        };
        blocks.push(block);
        stack.push(block);
      } else if (keyword === 'UNTIL') {
        const closed = closeBlock(stack, 'END_REPEAT', lineIndex, diagnostics);
        closedRepeatByUntil = closed;
        if (!closed) {
          diagnostics.push({
            kind: 'unmatched-until',
            keyword,
            line: lineIndex,
            message: 'UNTIL 没有匹配的 REPEAT'
          });
        }
      } else if (CLOSER_TO_OPENER[keyword]) {
        if (closedRepeatByUntil && CLOSER_TO_OPENER[keyword] === 'REPEAT') continue;
        closeBlock(stack, keyword, lineIndex, diagnostics);
      }
    }
  }

  for (const block of stack) {
    diagnostics.push({
      kind: 'unclosed-block',
      keyword: block.keyword,
      line: block.startLine,
      message: `${block.keyword} 块缺少闭合语句`
    });
  }

  return {
    version: 1,
    lines,
    blocks,
    symbols: extractNavigationSymbols(text),
    calls: extractStaticMacroCalls(text),
    diagnostics
  };
}

module.exports = {
  closeBlock,
  parseMacroDocument,
  tokenizeLine
};
