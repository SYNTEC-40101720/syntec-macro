// formattingProvider.js
// 文档格式化：委托 formatter 做保守缩进与规范化

const vscode = require('vscode');
const { formatDocument } = require('./analysisCore');
const {
  createAnalysisRequest,
  createDocumentSnapshot
} = require('./analysisProtocol');

function provideDocumentFormattingEdits(document, options) {
  const request = createAnalysisRequest(createDocumentSnapshot({
    uri: document.uri.toString(),
    version: document.version,
    languageId: document.languageId,
    text: document.getText()
  }));
  const result = formatDocument(request, options);
  return result.edits.map(edit => vscode.TextEdit.replace(
    new vscode.Range(
      edit.range.start.line,
      edit.range.start.character,
      edit.range.end.line,
      edit.range.end.character
    ),
    edit.newText
  ));
}

module.exports = { provideDocumentFormattingEdits };
