// formattingProvider.js
// 文档格式化：委托 analyzer (host Rust 优先, JS fallback 兼容) 做保守缩进与规范化
//
// R1.2 Stage B 前置 PR (2026-09-21): 同步路径通过 hostRustAnalyzer 获取 Rust
// 同步分析入口, 启动期 Rust 未就绪时走 JS fallback (v3.1.x 行为不变). R1.2
// Stage B 完成 (policy='empty') 后 JS fallback 路径将被移除.

const vscode = require('vscode');
const { formatDocument } = require('./analysisCore');
const {
  createAnalysisRequest,
  createDocumentSnapshot
} = require('./analysisProtocol');
const { getHostRustAnalyzer, shouldDeferToJsFallback } = require('./hostRustAnalyzer');

function provideDocumentFormattingEdits(document, options) {
  const request = createAnalysisRequest(createDocumentSnapshot({
    uri: document.uri.toString(),
    version: document.version,
    languageId: document.languageId,
    text: document.getText()
  }));
  // 优先走 host Rust analyzer (R1.2 前置 PR); 仅启动期未就绪走 JS fallback.
  const hostAnalyzer = getHostRustAnalyzer();
  if (hostAnalyzer) {
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
  if (shouldDeferToJsFallback()) {
    const jsResult = formatDocument(request, options);
    return jsResult.edits.map(edit => vscode.TextEdit.replace(
      new vscode.Range(
        edit.range.start.line,
        edit.range.start.character,
        edit.range.end.line,
        edit.range.end.character
      ),
      edit.newText
    ));
  }
  // policy='empty' 且 Rust 未就绪: 返空 (不再回退 JS)
  return [];
}

module.exports = { provideDocumentFormattingEdits };
