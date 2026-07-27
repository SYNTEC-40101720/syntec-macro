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

  // 是否为控制结构头（无同行体）
  const ifMatch = /^(?:IF|ELSEIF|ELSIF)\b.*\bTHEN\b/i.test(statement);
  const forMatch = /^FOR\b.*\bDO\b/i.test(statement);
  const whileMatch = /^WHILE\b.*\bDO\b/i.test(statement);
  const caseMatch = /^CASE\b.*\bOF\b/i.test(statement);
  const isRepeat = /^REPEAT\b\s*$/i.test(statement);

  if (ifMatch || forMatch || whileMatch || caseMatch || isRepeat) {
    // 同行体判断：THEN/DO/OF 后必须有实际语句（不能只是分号或空白）
    const hasRealStatement = (text, startChars) =>
      text && !/^;\s*$/.test(text) && (new RegExp(`^[${startChars}]`).test(text) || /;/.test(text));

    if (ifMatch) {
      const afterThen = statement.replace(/^.*\bTHEN\b/i, '').trim();
      if (hasRealStatement(afterThen, '#@A-Za-z(')) return 'statement';
    }
    if (forMatch) {
      const afterDo = statement.replace(/^.*\bDO\b/i, '').trim();
      if (hasRealStatement(afterDo, '#@A-Za-z(')) return 'statement';
    }
    if (whileMatch) {
      const afterDo = statement.replace(/^.*\bDO\b/i, '').trim();
      if (hasRealStatement(afterDo, '#@A-Za-z(')) return 'statement';
    }
    if (caseMatch) {
      const afterOf = statement.replace(/^.*\bOF\b/i, '').trim();
      if (hasRealStatement(afterOf, '#@A-Za-z(0-9')) return 'statement';
    }
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