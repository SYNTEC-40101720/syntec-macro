function isMacroHeaderLine(line) {
  return /^%@MACRO$/i.test(line.trim());
}

function getStatementTerminatorInfo(cleanLine) {
  return {
    hasSemicolon: /;\s*$/.test(cleanLine),
    semicolonCol: cleanLine.search(/;\s*$/),
    endCol: cleanLine.search(/\s*$/)
  };
}

function classifyStatement(cleanLine) {
  const trimmed = cleanLine.trim();
  if (!trimmed) return 'blank';
  if (isMacroHeaderLine(trimmed)) return 'macroHeader';
  if (/^%$/.test(trimmed)) return 'programDelimiter';

  const statement = trimmed.replace(/;\s*$/, '').trim();
  if (/^(?:IF|ELSEIF|ELSIF)\b.*\bTHEN\b/i.test(statement) ||
      /^FOR\b.*\bDO\b/i.test(statement) ||
      /^WHILE\b.*\bDO\b/i.test(statement) ||
      /^CASE\b.*\bOF\b/i.test(statement) ||
      /^REPEAT\b\s*$/i.test(statement)) {
    return 'blockHeader';
  }
  if (/^ELSE\b\s*$/i.test(statement)) return 'branch';
  if (/^\s*(?:[#@]?(?:\d+|\[[^\]]+\])|[A-Za-z][A-Za-z0-9_]*)(?:\s*,\s*(?:[#@]?(?:\d+|\[[^\]]+\])|[A-Za-z][A-Za-z0-9_]*))*\s*:\s*$/.test(statement)) {
    return 'caseLabel';
  }
  if (/^[#@\[(+\-.\d].*(?:<>|<=|>=|<|>)/.test(statement)) return 'danglingComparison';
  return 'statement';
}

module.exports = {
  classifyStatement,
  getStatementTerminatorInfo,
  isMacroHeaderLine
};