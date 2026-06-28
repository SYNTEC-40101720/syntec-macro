// Conservative formatter: indentation and trailing whitespace only.

const OPENERS = new Set(['IF', 'FOR', 'WHILE', 'CASE', 'REPEAT']);
const MIDDLE_KEYWORDS = new Set(['ELSE', 'ELSEIF']);
const CLOSERS = new Set([
  'END_IF', 'END_FOR', 'END_WHILE', 'END_CASE', 'END_REPEAT',
  'ENDIF', 'ENDFOR', 'ENDWHILE', 'ENDCASE', 'ENDREPEAT'
]);

function stripCommentsAndStrings(line) {
  let result = '';
  let inString = false;
  let inBlockComment = false;
  let i = 0;
  while (i < line.length) {
    if (inBlockComment) {
      if (line.substring(i, i + 2) === '*)') {
        result += '  ';
        inBlockComment = false;
        i += 2;
        continue;
      }
      result += ' ';
      i++;
      continue;
    }
    if (!inString && line.substring(i, i + 2) === '//') {
      result += ' '.repeat(line.length - i);
      break;
    }
    if (!inString && line.substring(i, i + 2) === '(*') {
      result += '  ';
      inBlockComment = true;
      i += 2;
      continue;
    }
    if (line[i] === '"') {
      let backslashes = 0;
      let j = i - 1;
      while (j >= 0 && line[j] === '\\') { backslashes++; j--; }
      if (backslashes % 2 === 0) inString = !inString;
    }
    result += inString ? ' ' : line[i];
    i++;
  }
  return result;
}

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

  for (const line of lines) {
    const withoutTrailing = line.replace(/[ \t]+$/g, '');
    const trimmed = withoutTrailing.trimStart();

    if (!trimmed) {
      formatted.push('');
      continue;
    }

    const clean = stripCommentsAndStrings(trimmed);
    const keywords = getKeywords(clean);
    const firstKeyword = keywords[0];
    const startsWithCloser = CLOSERS.has(firstKeyword) || firstKeyword === 'UNTIL';
    const startsWithMiddle = MIDDLE_KEYWORDS.has(firstKeyword);
    const currentLevel = Math.max(0, indentLevel - (startsWithCloser || startsWithMiddle ? 1 : 0));
    const originalLeading = getLeadingWhitespace(withoutTrailing);
    const leading = originalLeading.length > 0 || indentLevel > 0 || startsWithCloser || startsWithMiddle
      ? buildIndent(currentLevel, options)
      : '';

    formatted.push(leading + trimmed);

    if (startsWithMiddle) indentLevel = currentLevel;

    for (const keyword of keywords) {
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
