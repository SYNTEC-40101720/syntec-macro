// tests/helpers/documentMock.js
// Mock TextDocument：让完成/悬停/定义/格式化 Provider 可在 node --test 下
// 不依赖真实 VS Code extension host。覆盖 Provider 实际用到的 API 表面：
//   document.uri / document.lineAt(position).text / document.getText() /
//   document.getText(range) / document.lineCount / document.languageId /
//   document.version / document.getWordRangeAtPosition(position, regex)
//
// 用法：
//   const { createDocumentSnapshot } = require('./documentMock');
//   const doc = createDocumentSnapshot(text, { uri: 'file:///x.nc' });
//   provideCompletionItems(doc, new Position(0, 0));

'use strict';

const { Uri, Range } = require('./vscodeMock');

/**
 * 创建 mock TextDocument，按 \n 切分行；
 * lineAt(position) 返回 { text, range, ... }，镜像 VS Code 行读取行为；
 * getText() 返回全文；getText(range) 返回该 Range 覆盖的子串；
 * getWordRangeAtPosition(position, regex) 返回匹配 position 的词 range。
 *
 * @param {string} text 文档全文
 * @param {object} [opts] 可选 { uri, version, languageId }
 * @returns {object}
 */
function createDocumentSnapshot(text, opts = {}) {
  const lines = text.split('\n');
  return {
    uri: opts.uri instanceof Uri ? opts.uri : Uri.file(opts.uri || '/workspace/sample.nc'),
    version: opts.version === undefined ? 1 : opts.version,
    languageId: opts.languageId || 'syntec-macro',
    lineCount: lines.length,
    getText(range) {
      if (range === undefined) return text;
      // 仅支持同行的 Range 子串提取（hover/completion Provider 用到的形式）。
      const startLine = range.start.line;
      const endLine = range.end.line;
      if (startLine === endLine) {
        const line = lines[startLine] || '';
        return line.substring(range.start.character, range.end.character);
      }
      // 跨行：用换行符 join 出选中行段
      const parts = [];
      for (let i = startLine; i <= endLine; i++) {
        const l = lines[i] || '';
        if (i === startLine) parts.push(l.substring(range.start.character));
        else if (i === endLine) parts.push(l.substring(0, range.end.character));
        else parts.push(l);
      }
      return parts.join('\n');
    },
    lineAt(lineOrPosition) {
      const line = typeof lineOrPosition === 'number' ? lineOrPosition : lineOrPosition.line;
      return {
        text: lines[line] || '',
        lineNumber: line,
        range: {
          start: { line, character: 0 },
          end: { line, character: (lines[line] || '').length }
        },
        isEmpty: (lines[line] || '').length === 0
      };
    },
    getWordRangeAtPosition(position, regex = /[A-Za-z_][A-Za-z0-9_]*/) {
      const line = lines[position.line] || '';
      let match;
      const re = new RegExp(regex.source, regex.flags.includes('g') ? regex.flags : regex.flags + 'g');
      re.lastIndex = 0;
      while ((match = re.exec(line)) !== null) {
        const start = match.index;
        const end = start + match[0].length;
        if (position.character >= start && position.character <= end) {
          return new Range(position.line, start, position.line, end);
        }
        if (match.index === re.lastIndex) re.lastIndex++;
      }
      return undefined;
    }
  };
}

module.exports = { createDocumentSnapshot };
