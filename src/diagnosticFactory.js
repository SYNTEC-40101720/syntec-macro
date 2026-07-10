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

module.exports = {
  createDiagnostic,
  createError,
  createWarning,
  getDiagnosticDedupeKey
};