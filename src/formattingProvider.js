// formattingProvider.js
// 文档格式化：通过 host Rust analyzer 做保守缩进与规范化
//
// R1.2 Stage B (2026-09-22): JS fallback 路径已移除 — Rust 未就绪时返空 edits.
// 不再 require analysisCore.formatDocument (R1.2 §2.12 将 git rm analysisCore.js).

const vscode = require('vscode');
const {
  createAnalysisRequest,
  createDocumentSnapshot
} = require('./analysisProtocol');
const { getHostRustAnalyzer } = require('./hostRustAnalyzer');

function provideDocumentFormattingEdits(document) {
  const request = createAnalysisRequest(createDocumentSnapshot({
    uri: document.uri.toString(),
    version: document.version,
    languageId: document.languageId,
    text: document.getText()
  }));
  const hostAnalyzer = getHostRustAnalyzer();
  if (!hostAnalyzer) {
    // Rust 未就绪 (policy='empty'): 返空, 不回退 JS
    return [];
  }
  const rustResult = hostAnalyzer(request);
  return rustResult.edits.map(edit => vscode.TextEdit.replace(
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
