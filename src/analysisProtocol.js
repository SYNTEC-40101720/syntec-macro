// @ts-check
// 纯分析层协议：将编辑器文档与分析结果和 VS Code API 解耦。

const DEFAULT_PROFILE = 'generic';
const ANALYSIS_SOURCE = 'syntec-macro';
const ANALYSIS_PROTOCOL_VERSION = 1;

/**
 * @typedef {Object} DocumentSnapshot
 * @property {string} uri
 * @property {number} version
 * @property {string} languageId
 * @property {string} text
 */

/**
 * @typedef {Object} AnalysisRequest
 * @property {number} protocolVersion
 * @property {DocumentSnapshot} document
 * @property {string} profile
 */

/**
 * @typedef {'error'|'warning'|'info'|'hint'} AnalysisSeverity
 */

/**
 * @typedef {Object} AnalysisPosition
 * @property {number} line Zero-based line number.
 * @property {number} character Zero-based UTF-16 character offset.
 */

/**
 * @typedef {Object} AnalysisRange
 * @property {AnalysisPosition} start
 * @property {AnalysisPosition} end
 */

/**
 * @typedef {Object} AnalysisDiagnostic
 * @property {AnalysisRange} range
 * @property {string} message
 * @property {AnalysisSeverity} severity
 * @property {string} source
 * @property {string} [code]
 * @property {string} [keyword]
 */

/**
 * @typedef {Object} AnalysisSymbol
 * @property {string} name
 * @property {string} kind
 * @property {number} line Zero-based line number.
 * @property {number} [startCharacter]
 * @property {number} [endCharacter]
 */

/**
 * @typedef {Object} AnalysisNavigationCall
 * @property {string} targetName
 * @property {number} line Zero-based line number.
 * @property {number} start Zero-based start character.
 * @property {number} end Zero-based end character.
 */

/**
 * @typedef {Object} AnalysisNavigation
 * @property {string|null} programEntryName
 * @property {string|null} macroProgramName
 * @property {AnalysisSymbol[]} symbols
 * @property {AnalysisNavigationCall[]} calls
 */

/**
 * @typedef {Object} AnalysisTextEdit
 * @property {AnalysisRange} range
 * @property {string} newText
 */

/**
 * @typedef {Object} AnalysisResult
 * @property {number} protocolVersion
 * @property {DocumentSnapshot} document
 * @property {string} profile
 * @property {string} backend
 * @property {AnalysisDiagnostic[]} diagnostics
 * @property {AnalysisSymbol[]} symbols
 * @property {AnalysisTextEdit[]} edits
 * @property {AnalysisNavigation|null} navigation
 */

/**
 * @param {unknown} value
 * @param {string} name
 */
function assertRecord(value, name) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${name} must be an object`);
  }
}

/**
 * @param {unknown} value
 * @param {string} name
 */
function assertNonEmptyString(value, name) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new TypeError(`${name} must be a non-empty string`);
  }
}

/**
 * @param {unknown} value
 * @param {string} name
 */
function assertNonNegativeInteger(value, name) {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new TypeError(`${name} must be a non-negative integer`);
  }
}

/**
 * @param {DocumentSnapshot} input
 * @returns {DocumentSnapshot}
 */
function createDocumentSnapshot(input) {
  assertRecord(input, 'document');
  assertNonEmptyString(input.uri, 'document.uri');
  assertNonNegativeInteger(input.version, 'document.version');
  assertNonEmptyString(input.languageId, 'document.languageId');
  if (typeof input.text !== 'string') {
    throw new TypeError('document.text must be a string');
  }

  return {
    uri: input.uri,
    version: input.version,
    languageId: input.languageId,
    text: input.text
  };
}

/**
 * @param {DocumentSnapshot} document
 * @param {{profile?: string}} [options]
 * @returns {AnalysisRequest}
 */
function createAnalysisRequest(document, options = {}) {
  const snapshot = createDocumentSnapshot(document);
  assertRecord(options, 'options');
  const profile = options.profile === undefined ? DEFAULT_PROFILE : options.profile;
  assertNonEmptyString(profile, 'options.profile');
  return {
    protocolVersion: ANALYSIS_PROTOCOL_VERSION,
    document: snapshot,
    profile
  };
}

/**
 * @param {AnalysisRequest} request
 * @returns {AnalysisRequest}
 */
function normalizeAnalysisRequest(request) {
  assertRecord(request, 'request');
  if (request.protocolVersion !== undefined &&
      request.protocolVersion !== ANALYSIS_PROTOCOL_VERSION) {
    throw new TypeError(`unsupported analysis protocol version: ${request.protocolVersion}`);
  }
  const normalized = createAnalysisRequest(request.document, { profile: request.profile });
  return normalized;
}

/**
 * @param {AnalysisDiagnostic} diagnostic
 * @returns {string}
 */
function getAnalysisDiagnosticKey(diagnostic) {
  const start = diagnostic.range.start;
  const end = diagnostic.range.end;
  return [
    start.line,
    start.character,
    end.line,
    end.character,
    diagnostic.severity,
    diagnostic.code || diagnostic.message,
    diagnostic.keyword || ''
  ].join('|');
}

module.exports = {
  ANALYSIS_SOURCE,
  ANALYSIS_PROTOCOL_VERSION,
  DEFAULT_PROFILE,
  createAnalysisRequest,
  createDocumentSnapshot,
  getAnalysisDiagnosticKey,
  normalizeAnalysisRequest
};
