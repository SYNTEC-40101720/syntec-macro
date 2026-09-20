// @ts-check
// 纯 JavaScript 分析后端；后续 Rust/Wasm 后端应实现相同的请求/结果协议。

const { validateDocument } = require('./validator');
const {
  createAnalysisResult,
  createNavigationResult,
  normalizeAnalysisRequest
} = require('./analysisProtocol');

/**
 * @param {import('./analysisProtocol').AnalysisRequest} request
 * @returns {import('./analysisProtocol').AnalysisResult}
 */
function analyzeDocument(request) {
  if (request === null || typeof request !== 'object' || request.document === undefined) {
    throw new TypeError('analysis request must contain a document snapshot');
  }
  const problems = validateDocument(request.document.text);
  return createAnalysisResult(request, problems, { backend: 'javascript' });
}

/**
 * Run the syntax-preserving formatter through the same pure analysis boundary.
 *
 * @param {import('./analysisProtocol').AnalysisRequest} request
 * @param {Object} [options]
 * @returns {import('./analysisProtocol').AnalysisResult}
 */
function formatDocument(request, options = {}) {
  const normalizedRequest = normalizeAnalysisRequest(request);
  const { formatSyntecMacroDocument } = require('./formatter');
  const text = normalizedRequest.document.text;
  const formatted = formatSyntecMacroDocument(text, options);
  const result = createAnalysisResult(normalizedRequest, [], { backend: 'javascript' });
  if (formatted === text) return result;

  const lines = text.split(/\r?\n/);
  const lastLine = lines[lines.length - 1];
  result.edits = [{
    range: {
      start: { line: 0, character: 0 },
      end: { line: lines.length - 1, character: lastLine.length }
    },
    newText: formatted
  }];
  return result;
}

/**
 * Run the existing pure navigation indexer through the analysis facade.
 *
 * @param {import('./analysisProtocol').AnalysisRequest} request
 * @param {string} filePath
 * @returns {import('./analysisProtocol').AnalysisResult}
 */
function analyzeNavigationDocument(request, filePath) {
  const normalizedRequest = normalizeAnalysisRequest(request);
  if (typeof filePath !== 'string' || filePath.length === 0) {
    throw new TypeError('navigation filePath must be a non-empty string');
  }
  const { buildNavigationIndexEntry } = require('./navigationSymbols');
  const index = buildNavigationIndexEntry(filePath, normalizedRequest.document.text);
  return createNavigationResult(normalizedRequest, index);
}

module.exports = {
  analyzeDocument,
  analyzeNavigationDocument,
  formatDocument
};
