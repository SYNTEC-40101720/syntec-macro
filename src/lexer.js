// @ts-check
// lexer.js
// 源码预处理：去除注释与字符串内容，保留列宽
// 供 validator、formatter、navigation 和函数参数检查共用，避免实现漂移

/**
 * 判断指定位置的双引号是否被奇数个反斜杠转义。
 * @param {string} text
 * @param {number} index
 * @returns {boolean}
 */
function isEscapedQuote(text, index) {
  let backslashes = 0;
  for (let cursor = index - 1; cursor >= 0 && text[cursor] === '\\'; cursor--) {
    backslashes++;
  }
  return backslashes % 2 === 1;
}

/**
 * 去除字符串和注释，保留代码逻辑。
 * 字符串和注释内容用空格替换，保留列宽；返回剥离后的文本与块注释跨越状态。
 * @param {string} line
 * @param {boolean} [lineStartInBlock] 当前行是否承接上一行未闭合的块注释
 * @returns {{ text: string, inBlockComment: boolean }}
 */
function stripCommentsAndStringsWithState(line, lineStartInBlock = false) {
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

    // 行注释 //
    if (!inString && line.substring(i, i + 2) === '//') {
      result += ' '.repeat(line.length - i);
      break;
    }
    // 块注释 (* *)
    if (!inString && line.substring(i, i + 2) === '(*') {
      result += '  ';
      inBlockComment = true;
      i += 2;
      continue;
    }
    // 字符串（双引号）
    if (line[i] === '"') {
      if (!isEscapedQuote(line, i)) inString = !inString;
      result += ' ';
    } else {
      result += inString ? ' ' : line[i];
    }
    i++;
  }
  return { text: result, inBlockComment };
}

/**
 * 便捷封装：仅返回剥离后的文本。
 * @param {string} line
 * @returns {string}
 */
function stripCommentsAndStrings(line) {
  return stripCommentsAndStringsWithState(line).text;
}

/**
 * 去除注释但保留字符串内容和列宽。
 * 用于需要继续解析字符串字面量的导航与函数参数检查。
 * @param {string} line
 * @param {boolean} [lineStartInBlock] 当前行是否承接上一行未闭合的块注释
 * @returns {{ text: string, inBlockComment: boolean }}
 */
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

    if (line[i] === '"' && !isEscapedQuote(line, i)) {
      inString = !inString;
    }
    result += line[i];
    i++;
  }

  return { text: result, inBlockComment };
}

/**
 * 便捷封装：仅返回去除注释、保留字符串后的文本。
 * @param {string} line
 * @returns {string}
 */
function stripCommentsKeepStrings(line) {
  return stripCommentsKeepStringsWithState(line).text;
}

/**
 * 判断目标位置是否位于双引号字符串内。
 * @param {string} text
 * @param {number} targetIndex
 * @returns {boolean}
 */
function isInsideString(text, targetIndex) {
  let inString = false;
  for (let index = 0; index < targetIndex; index++) {
    if (text[index] === '"' && !isEscapedQuote(text, index)) {
      inString = !inString;
    }
  }
  return inString;
}

module.exports = {
  isInsideString,
  stripCommentsKeepStrings,
  stripCommentsKeepStringsWithState,
  stripCommentsAndStrings,
  stripCommentsAndStringsWithState
};
