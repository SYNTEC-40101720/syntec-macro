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

module.exports = {
  createDiagnostic,
  createError,
  createWarning
};