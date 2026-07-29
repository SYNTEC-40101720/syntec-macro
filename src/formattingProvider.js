// formattingProvider.js
// 文档格式化：委托 formatter 做保守缩进与规范化

const vscode = require('vscode');
const { formatSyntecMacroDocument } = require('./formatter');

function provideDocumentFormattingEdits(document, options) {
  const formatted = formatSyntecMacroDocument(document.getText(), options);
  if (formatted === document.getText()) return [];
  const lastLine = document.lineAt(document.lineCount - 1);
  const fullRange = new vscode.Range(0, 0, document.lineCount - 1, lastLine.text.length);
  return [vscode.TextEdit.replace(fullRange, formatted)];
}

module.exports = { provideDocumentFormattingEdits };
