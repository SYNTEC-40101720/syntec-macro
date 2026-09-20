// @ts-check
// 纯分析层协议：将编辑器文档与分析结果和 VS Code API 解耦。

const DEFAULT_PROFILE = 'generic';
const DEFAULT_BACKEND = 'javascript';
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
 * @typedef {Object} DiagnosticProblem
 * @property {number} line One-based line number.
 * @property {number} col Zero-based character offset.
 * @property {number} [endCol]
 * @property {string} msg
 * @property {'error'|'warning'} [severity]
 * @property {string} [code]
 * @property {string} [keyword]
 */

/**
 * @typedef {Object} NavigationIndexSymbol
 * @property {string} name
 * @property {string} kind
 * @property {number} line Zero-based line number.
 */

/**
 * @typedef {Object} NavigationIndexCall
 * @property {string} targetName
 * @property {number} line Zero-based line number.
 * @property {number} start Zero-based start character.
 * @property {number} end Zero-based end character.
 */

/**
 * @typedef {Object} NavigationIndex
 * @property {string|null} programEntryName
 * @property {string|null} macroProgramName
 * @property {NavigationIndexSymbol[]} symbols
 * @property {NavigationIndexCall[]} calls
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
 * 将现有 validator 的 1-based 诊断转换为核心协议使用的 0-based range。
 *
 * @param {DiagnosticProblem} problem
 * @returns {AnalysisDiagnostic}
 */
function toAnalysisDiagnostic(problem) {
  assertRecord(problem, 'diagnostic');
  if (!Number.isInteger(problem.line) || problem.line < 1) {
    throw new TypeError('diagnostic.line must be a positive integer');
  }
  if (!Number.isInteger(problem.col) || problem.col < 0) {
    throw new TypeError('diagnostic.col must be a non-negative integer');
  }
  if (problem.endCol !== undefined &&
      (!Number.isInteger(problem.endCol) || problem.endCol < problem.col)) {
    throw new TypeError('diagnostic.endCol must be greater than or equal to diagnostic.col');
  }
  assertNonEmptyString(problem.msg, 'diagnostic.msg');

  /** @type {AnalysisSeverity} */
  const severity = problem.severity || 'error';
  if (!['error', 'warning', 'info', 'hint'].includes(severity)) {
    throw new TypeError('diagnostic.severity is invalid');
  }

  const endCharacter = problem.endCol || problem.col + 1;
  /** @type {AnalysisDiagnostic} */
  const diagnostic = {
    range: {
      start: { line: problem.line - 1, character: problem.col },
      end: { line: problem.line - 1, character: endCharacter }
    },
    message: problem.msg,
    severity,
    source: ANALYSIS_SOURCE
  };
  if (problem.code !== undefined) {
    assertNonEmptyString(problem.code, 'diagnostic.code');
    diagnostic.code = problem.code;
  }
  if (problem.keyword !== undefined) {
    assertNonEmptyString(problem.keyword, 'diagnostic.keyword');
    diagnostic.keyword = problem.keyword;
  }
  return diagnostic;
}

/**
 * @param {AnalysisRequest} request
 * @param {DiagnosticProblem[]} problems
 * @param {{backend?: string}} [metadata]
 * @returns {AnalysisResult}
 */
function createAnalysisResult(request, problems, metadata = {}) {
  const normalizedRequest = normalizeAnalysisRequest(request);
  if (!Array.isArray(problems)) {
    throw new TypeError('diagnostics must be an array');
  }
  assertRecord(metadata, 'metadata');
  const backend = metadata.backend === undefined ? DEFAULT_BACKEND : metadata.backend;
  assertNonEmptyString(backend, 'metadata.backend');

  return {
    protocolVersion: ANALYSIS_PROTOCOL_VERSION,
    document: normalizedRequest.document,
    profile: normalizedRequest.profile,
    backend,
    diagnostics: problems.map(toAnalysisDiagnostic),
    symbols: [],
    edits: [],
    navigation: null
  };
}

/**
 * Convert the existing navigation index shape into the shared analysis shape.
 *
 * @param {NavigationIndex|null} index
 * @param {string} text
 * @returns {AnalysisNavigation}
 */
function createNavigationAnalysis(index, text) {
  if (typeof text !== 'string') {
    throw new TypeError('navigation text must be a string');
  }
  if (index === null) {
    return {
      programEntryName: null,
      macroProgramName: null,
      symbols: [],
      calls: []
    };
  }
  assertRecord(index, 'navigation index');
  if (!Array.isArray(index.symbols) || !Array.isArray(index.calls)) {
    throw new TypeError('navigation index must contain symbols and calls arrays');
  }
  const lines = text.split(/\r?\n/);
  return {
    programEntryName: index.programEntryName || null,
    macroProgramName: index.macroProgramName || null,
    symbols: index.symbols.map(symbol => {
      assertRecord(symbol, 'navigation symbol');
      if (!Number.isInteger(symbol.line) || symbol.line < 0) {
        throw new TypeError('navigation symbol.line must be a non-negative integer');
      }
      assertNonEmptyString(symbol.name, 'navigation symbol.name');
      assertNonEmptyString(symbol.kind, 'navigation symbol.kind');
      const lineText = lines[symbol.line] || '';
      return {
        name: symbol.name,
        kind: symbol.kind,
        line: symbol.line,
        startCharacter: 0,
        endCharacter: lineText.length
      };
    }),
    calls: index.calls.map(call => {
      assertRecord(call, 'navigation call');
      assertNonEmptyString(call.targetName, 'navigation call.targetName');
      if (!Number.isInteger(call.line) || call.line < 0 ||
          !Number.isInteger(call.start) || call.start < 0 ||
          !Number.isInteger(call.end) || call.end < call.start) {
        throw new TypeError('navigation call range is invalid');
      }
      return {
        targetName: call.targetName,
        line: call.line,
        start: call.start,
        end: call.end
      };
    })
  };
}

/**
 * @param {AnalysisRequest} request
 * @param {NavigationIndex|null} index
 * @returns {AnalysisResult}
 */
function createNavigationResult(request, index) {
  const result = createAnalysisResult(request, [], { backend: DEFAULT_BACKEND });
  if (index === null) return result;
  result.navigation = createNavigationAnalysis(index, result.document.text);
  result.symbols = result.navigation.symbols;
  return result;
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
  DEFAULT_BACKEND,
  DEFAULT_PROFILE,
  createAnalysisRequest,
  createAnalysisResult,
  createNavigationAnalysis,
  createNavigationResult,
  createDocumentSnapshot,
  getAnalysisDiagnosticKey,
  normalizeAnalysisRequest,
  toAnalysisDiagnostic
};
