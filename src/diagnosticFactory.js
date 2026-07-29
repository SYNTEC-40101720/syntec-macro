// @ts-check

/**
 * 诊断问题的额外可选字段（可附加 code / keyword）。
 * @typedef {Object} DiagnosticExtra
 * @property {string} [code]
 * @property {string} [keyword]
 */

/**
 * 验证器产出的诊断问题对象（与 vscode.Diagnostic 解耦的纯数据结构）。
 * @typedef {Object} DiagnosticProblem
 * @property {number} line
 * @property {number} col
 * @property {number} [endCol]
 * @property {string} msg
 * @property {'error'|'warning'} [severity]
 * @property {string} [code]
 * @property {string} [keyword]
 */

/**
 * @param {number} line
 * @param {number} col
 * @param {number} endCol
 * @param {string} msg
 * @param {'error'|'warning'} [severity]
 * @param {DiagnosticExtra} [extra]
 * @returns {DiagnosticProblem}
 */
function createDiagnostic(line, col, endCol, msg, severity = 'error', extra = {}) {
  return {
    line,
    col,
    endCol,
    msg,
    severity,
    ...extra
  };
}

/**
 * @param {number} line
 * @param {number} col
 * @param {number} endCol
 * @param {string} msg
 * @param {DiagnosticExtra} [extra]
 * @returns {DiagnosticProblem}
 */
function createError(line, col, endCol, msg, extra = {}) {
  return createDiagnostic(line, col, endCol, msg, 'error', extra);
}

/**
 * @param {number} line
 * @param {number} col
 * @param {number} endCol
 * @param {string} msg
 * @param {DiagnosticExtra} [extra]
 * @returns {DiagnosticProblem}
 */
function createWarning(line, col, endCol, msg, extra = {}) {
  return createDiagnostic(line, col, endCol, msg, 'warning', extra);
}

/**
 * @param {DiagnosticProblem} problem
 * @returns {string}
 */
function getDiagnosticDedupeKey(problem) {
  const identity = problem.code || problem.msg;
  // 包含 keyword 等额外字段，避免同一位置同 code 但 keyword 不同的诊断被错误去重
  const extraKey = problem.keyword ? '|' + problem.keyword : '';
  return [problem.line, problem.col, problem.endCol || problem.col + 1, problem.severity, identity, extraKey].join('|');
}

/**
 * @param {DiagnosticProblem} left
 * @param {DiagnosticProblem} right
 * @returns {boolean}
 */
function diagnosticRangesOverlap(left, right) {
  if (left.line !== right.line) return false;
  const leftStart = left.col;
  const leftEnd = left.endCol || left.col + 1;
  const rightStart = right.col;
  const rightEnd = right.endCol || right.col + 1;
  if (leftStart === 0 && leftEnd === 0) return false;
  if (rightStart === 0 && rightEnd === 0) return false;
  return leftStart < rightEnd && rightStart < leftEnd;
}

/**
 * @param {DiagnosticProblem[]} diagnostics
 * @returns {DiagnosticProblem[]}
 */
function suppressWarningsOverlappingErrors(diagnostics) {
  const errors = diagnostics.filter(diagnostic => diagnostic.severity === 'error');
  return diagnostics.filter(diagnostic =>
    diagnostic.severity !== 'warning' ||
    !errors.some(error => diagnosticRangesOverlap(diagnostic, error))
  );
}

/**
 * @param {'error'|'warning'} severity
 * @returns {number}
 */
function getSeverityRank(severity) {
  return severity === 'error' ? 0 : 1;
}

/**
 * @param {DiagnosticProblem} left
 * @param {DiagnosticProblem} right
 * @returns {number}
 */
function compareDiagnostics(left, right) {
  return (left.line - right.line) ||
    (left.col - right.col) ||
    ((left.endCol || left.col + 1) - (right.endCol || right.col + 1)) ||
    (getSeverityRank(left.severity) - getSeverityRank(right.severity)) ||
    String(left.code || left.msg).localeCompare(String(right.code || right.msg));
}

/**
 * @param {DiagnosticProblem[]} diagnostics
 * @returns {DiagnosticProblem[]}
 */
function sortDiagnostics(diagnostics) {
  return [...diagnostics].sort(compareDiagnostics);
}

/**
 * @param {DiagnosticProblem[]} diagnostics
 * @returns {DiagnosticProblem[]}
 */
function normalizeDiagnostics(diagnostics) {
  return sortDiagnostics(suppressWarningsOverlappingErrors(diagnostics));
}

module.exports = {
  createDiagnostic,
  createError,
  createWarning,
  compareDiagnostics,
  getDiagnosticDedupeKey,
  normalizeDiagnostics,
  sortDiagnostics,
  suppressWarningsOverlappingErrors
};
