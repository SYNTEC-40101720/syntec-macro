// @ts-check
// lexer.js
// 源码预处理：去除注释与字符串内容，保留列宽
// 供 validator 与 formatter 共用，避免两份实现行为漂移

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
      // 检查是否被转义（前面有奇数个反斜杠）
      let bs = 0;
      let j = i - 1;
      while (j >= 0 && line[j] === '\\') { bs++; j--; }
      if (bs % 2 === 0) {
        // 未被转义，正常切换 inString
        inString = !inString;
      }
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

module.exports = {
  stripCommentsAndStrings,
  stripCommentsAndStringsWithState
};
