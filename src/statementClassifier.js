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
    // IF/ELSEIF: THEN 后有实际语句（以变量/指令/关键字开头，或含 ;）→ 同行体
    if (ifMatch) {
      const afterThen = statement.replace(/^.*\bTHEN\b/i, '').trim();
      if (afterThen && (/^[#@A-Za-z(]/.test(afterThen) || /;/.test(afterThen))) return 'statement';
    }
    // FOR/WHILE: DO 后有实际语句 → 同行体
    if (forMatch) {
      const afterDo = statement.replace(/^.*\bDO\b/i, '').trim();
      if (afterDo && (/^[#@A-Za-z(]/.test(afterDo) || /;/.test(afterDo))) return 'statement';
    }
    if (whileMatch) {
      const afterDo = statement.replace(/^.*\bDO\b/i, '').trim();
      if (afterDo && (/^[#@A-Za-z(]/.test(afterDo) || /;/.test(afterDo))) return 'statement';
    }
    // CASE: OF 后有内容 → 同行体
    if (caseMatch) {
      const afterOf = statement.replace(/^.*\bOF\b/i, '').trim();
      if (afterOf && (/^[#@A-Za-z(0-9]/.test(afterOf) || /;/.test(afterOf))) return 'statement';
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