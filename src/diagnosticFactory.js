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

function createError(line, col, endCol, msg, extra = {}) {
  return createDiagnostic(line, col, endCol, msg, 'error', extra);
}

function createWarning(line, col, endCol, msg, extra = {}) {
  return createDiagnostic(line, col, endCol, msg, 'warning', extra);
}

function getDiagnosticDedupeKey(problem) {
  const identity = problem.code || problem.msg;
  return [problem.line, problem.col, problem.endCol || problem.col + 1, problem.severity, identity].join('|');
}

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

function suppressWarningsOverlappingErrors(diagnostics) {
  const errors = diagnostics.filter(diagnostic => diagnostic.severity === 'error');
  return diagnostics.filter(diagnostic =>
    diagnostic.severity !== 'warning' ||
    !errors.some(error => diagnosticRangesOverlap(diagnostic, error))
  );
}

function getSeverityRank(severity) {
  return severity === 'error' ? 0 : 1;
}

function compareDiagnostics(left, right) {
  return (left.line - right.line) ||
    (left.col - right.col) ||
    ((left.endCol || left.col + 1) - (right.endCol || right.col + 1)) ||
    (getSeverityRank(left.severity) - getSeverityRank(right.severity)) ||
    String(left.code || left.msg).localeCompare(String(right.code || right.msg));
}

function sortDiagnostics(diagnostics) {
  return [...diagnostics].sort(compareDiagnostics);
}

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