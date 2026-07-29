// Conservative formatter: indentation and syntax-preserving normalization.

const { classifyStatement, getStatementTerminatorInfo } = require('./statementClassifier');
const { stripCommentsAndStringsWithState } = require('./lexer');

const OPENERS = new Set(['IF', 'FOR', 'WHILE', 'CASE', 'REPEAT']);
const MIDDLE_KEYWORDS = new Set(['ELSE', 'ELSEIF']);
const CLOSERS = new Set([
  'END_IF', 'END_FOR', 'END_WHILE', 'END_CASE', 'END_REPEAT',
  'ENDIF', 'ENDFOR', 'ENDWHILE', 'ENDCASE', 'ENDREPEAT'
]);

function getKeywords(cleanLine) {
  const keywords = [];
  const re = /\b(END_REPEAT|END_WHILE|END_CASE|END_FOR|END_IF|ENDREPEAT|ENDWHILE|ENDCASE|ENDFOR|ENDIF|ELSEIF|ELSE|REPEAT|WHILE|CASE|FOR|IF|UNTIL)\b/ig;
  let match;
  while ((match = re.exec(cleanLine)) !== null) {
    keywords.push(match[1].toUpperCase());
  }
  return keywords;
}

function getLeadingWhitespace(line) {
  const match = line.match(/^\s*/);
  return match ? match[0] : '';
}

function normalizeKeywordAliases(line, cleanLine) {
  const aliases = /\b(ENDIF|ENDFOR|ENDWHILE|ENDCASE|ENDREPEAT)\b/ig;
  const replacements = {
    ENDIF: 'END_IF',
    ENDFOR: 'END_FOR',
    ENDWHILE: 'END_WHILE',
    ENDCASE: 'END_CASE',
    ENDREPEAT: 'END_REPEAT'
  };
  let result = '';
  let cursor = 0;
  let match;

  while ((match = aliases.exec(cleanLine)) !== null) {
    result += line.slice(cursor, match.index);
    result += replacements[match[1].toUpperCase()];
    cursor = match.index + match[0].length;
  }

  return result + line.slice(cursor);
}

function normalizeAssignmentOperator(line, cleanLine) {
  const target = '(?:[#@](?:\\d+|\\[[^\\]]+\\])|(?:AR|MAR)(?:\\d+|\\[[^\\]]+\\]))';
  const assignment = new RegExp('(?:^|;|\\bTHEN\\b|\\bDO\\b|:)\\s*' + target + '\\s*=(?!=)', 'ig');
  const equalsIndices = [];
  let match;
  while ((match = assignment.exec(cleanLine)) !== null) {
    equalsIndices.push(match.index + match[0].lastIndexOf('='));
  }

  let normalized = line;
  for (let i = equalsIndices.length - 1; i >= 0; i--) {
    const equalsIndex = equalsIndices[i];
    normalized = normalized.slice(0, equalsIndex) + ':=' + normalized.slice(equalsIndex + 1);
  }
  return normalized;
}

function removeControlStructureTerminator(line, cleanLine, kind) {
  if (!['blockHeader', 'branch', 'caseLabel'].includes(kind)) return line;
  const terminator = getStatementTerminatorInfo(cleanLine);
  if (!terminator.hasSemicolon || terminator.semicolonCol < 0) return line;
  return line.slice(0, terminator.semicolonCol) + line.slice(terminator.semicolonCol + 1);
}

function normalizeStatementTerminator(line, cleanLine) {
  const trimmedClean = cleanLine.trim();
  if (!trimmedClean || trimmedClean.startsWith('//') || /^%@MACRO$/i.test(trimmedClean) || trimmedClean === '%') return line;

  const kind = classifyStatement(cleanLine);
  if (['blockHeader', 'branch', 'caseLabel', 'danglingComparison'].includes(kind)) return line;

  const terminator = getStatementTerminatorInfo(cleanLine);
  if (terminator.hasSemicolon) return line;

  const codeEnd = cleanLine.trimEnd().length;
  return line.slice(0, codeEnd) + ';' + line.slice(codeEnd);
}

function buildIndent(level, options = {}) {
  const size = Number.isInteger(options.tabSize) && options.tabSize > 0 ? options.tabSize : 4;
  if (options.insertSpaces === false) return '\t'.repeat(level);
  return ' '.repeat(level * size);
}

function formatSyntecMacroDocument(text, options = {}) {
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  const lines = text.split(/\r?\n/);
  const formatted = [];
  let indentLevel = 0;
  let inBlockComment = false;

  for (const line of lines) {
    const withoutTrailing = line.replace(/[ \t]+$/g, '');
    const trimmed = withoutTrailing.trimStart();

    if (!trimmed) {
      formatted.push('');
      continue;
    }

    const lineStartInBlockComment = inBlockComment;
    const scanned = stripCommentsAndStringsWithState(trimmed, lineStartInBlockComment);
    const clean = scanned.text;
    inBlockComment = scanned.inBlockComment;
    const keywords = getKeywords(clean);
    const statementKind = classifyStatement(clean);
    const firstKeyword = keywords[0];
    const startsWithCloser = CLOSERS.has(firstKeyword) || firstKeyword === 'UNTIL';
    const startsWithMiddle = MIDDLE_KEYWORDS.has(firstKeyword);
    const currentLevel = Math.max(0, indentLevel - (startsWithCloser || startsWithMiddle ? 1 : 0));
    const originalLeading = getLeadingWhitespace(withoutTrailing);
    const leading = originalLeading.length > 0 || indentLevel > 0 || startsWithCloser || startsWithMiddle
      ? buildIndent(currentLevel, options)
      : '';

    let normalizedLine = removeControlStructureTerminator(trimmed, clean, statementKind);
    let normalizedClean = stripCommentsAndStringsWithState(normalizedLine, lineStartInBlockComment).text;
    normalizedLine = normalizeStatementTerminator(normalizedLine, normalizedClean);
    normalizedClean = stripCommentsAndStringsWithState(normalizedLine, lineStartInBlockComment).text;
    normalizedLine = normalizeAssignmentOperator(normalizedLine, normalizedClean);
    normalizedClean = stripCommentsAndStringsWithState(normalizedLine, lineStartInBlockComment).text;
    normalizedLine = normalizeKeywordAliases(normalizedLine, normalizedClean);
    formatted.push(leading + normalizedLine);

    if (startsWithMiddle) indentLevel = currentLevel;

    const hasInlineBlockBody = statementKind === 'statement' && OPENERS.has(firstKeyword);
    for (const keyword of keywords) {
      if (hasInlineBlockBody && OPENERS.has(keyword)) continue;
      if (OPENERS.has(keyword)) indentLevel++;
      else if (keyword === 'UNTIL' || CLOSERS.has(keyword)) indentLevel = Math.max(0, indentLevel - 1);
    }

    if (startsWithMiddle) indentLevel++;
  }

  return formatted.join(eol);
}

module.exports = {
  formatSyntecMacroDocument
};
