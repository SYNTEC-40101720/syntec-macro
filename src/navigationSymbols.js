const path = require('path');
const {
  MACRO_FILE_EXTENSIONS,
  normalizeProgramName,
  normalizeSubprogramName
} = require('./fileResolver');

function stripCommentsKeepStrings(line, lineStartInBlock) {
  let result = '';
  let inBlockComment = lineStartInBlock;
  let inString = false;

  for (let index = 0; index < line.length; index++) {
    const pair = line.substring(index, index + 2);
    if (inBlockComment) {
      if (pair === '*)') {
        result += '  ';
        inBlockComment = false;
        index++;
      } else {
        result += ' ';
      }
      continue;
    }
    if (!inString && pair === '//') {
      result += ' '.repeat(line.length - index);
      break;
    }
    if (!inString && pair === '(*') {
      result += '  ';
      inBlockComment = true;
      index++;
      continue;
    }
    if (line[index] === '"' && line[index - 1] !== '\\') inString = !inString;
    result += line[index];
  }

  return { text: result, inBlockComment };
}

function isInsideString(text, targetIndex) {
  let inString = false;
  for (let index = 0; index < targetIndex; index++) {
    if (text[index] === '"' && text[index - 1] !== '\\') inString = !inString;
  }
  return inString;
}

function extractNavigationSymbols(text) {
  const symbols = [];
  const lines = text.split(/\r?\n/);

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const trimmed = lines[lineIndex].trim();
    const labelMatch = trimmed.match(/^N(\d+)\s*;$/i);
    if (labelMatch) {
      symbols.push({ name: 'N' + labelMatch[1], kind: 'label', line: lineIndex });
    }
    if (/^%@MACRO$/i.test(trimmed)) {
      symbols.push({ name: '%@MACRO', kind: 'macroHeader', line: lineIndex });
    }
  }

  return symbols;
}

function getPortableFileName(filePath) {
  return path.posix.basename(filePath.replace(/\\/g, '/'));
}

function getProgramEntryName(filePath) {
  const fileName = getPortableFileName(filePath);
  const extension = path.posix.extname(fileName).toLowerCase();
  const baseName = MACRO_FILE_EXTENSIONS.includes(extension)
    ? path.posix.basename(fileName, extension)
    : fileName;
  return /^[GO]\d+$/i.test(baseName) ? baseName.toUpperCase() : null;
}

function isMacroFileContent(filePath, text) {
  const extension = path.posix.extname(getPortableFileName(filePath)).toLowerCase();
  if (getProgramEntryName(filePath) || MACRO_FILE_EXTENSIONS.includes(extension)) return true;
  return !extension && extractNavigationSymbols(text).some(symbol => symbol.kind === 'macroHeader');
}

function getMacroProgramName(filePath, text) {
  const hasMacroHeader = extractNavigationSymbols(text).some(symbol => symbol.kind === 'macroHeader');
  if (!hasMacroHeader) return null;

  const fileName = getPortableFileName(filePath);
  const extension = path.posix.extname(fileName).toLowerCase();
  return (MACRO_FILE_EXTENSIONS.includes(extension)
    ? path.posix.basename(fileName, extension)
    : fileName).toUpperCase();
}

function buildNavigationIndexEntry(filePath, text) {
  if (!isMacroFileContent(filePath, text)) return null;
  return {
    programEntryName: getProgramEntryName(filePath),
    macroProgramName: getMacroProgramName(filePath, text),
    symbols: extractNavigationSymbols(text),
    calls: extractStaticMacroCalls(text)
  };
}

function extractStaticMacroCalls(text) {
  const calls = [];
  const lines = text.split(/\r?\n/);
  let inBlockComment = false;

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const stripped = stripCommentsKeepStrings(lines[lineIndex], inBlockComment);
    inBlockComment = stripped.inBlockComment;
    const patterns = [
      {
        regex: /\bG6[56](?:\.1)?\s+P(?:"([^"\r\n]+)"|(\d+))(?=\s|;|$)/ig,
        normalize: match => match[1] || normalizeProgramName(match[2])
      },
      {
        regex: /\bM(?:98|198)\s+P(\d+)(?=\s|;|$)/ig,
        normalize: match => normalizeSubprogramName(match[1])
      }
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.regex.exec(stripped.text)) !== null) {
        if (isInsideString(stripped.text, match.index)) continue;
        const pOffset = match[0].search(/P(?="|\d)/i);
        const isNamed = match[1] && match[0][0].toUpperCase() === 'G';
        const start = match.index + pOffset + (isNamed ? 2 : 0);
        const length = isNamed ? match[1].length : match[0].length - pOffset;
        calls.push({
          targetName: pattern.normalize(match),
          line: lineIndex,
          start,
          end: start + length
        });
      }
    }
  }

  return calls.sort((left, right) => left.line - right.line || left.start - right.start);
}

module.exports = {
  buildNavigationIndexEntry,
  extractNavigationSymbols,
  extractStaticMacroCalls,
  getMacroProgramName,
  getProgramEntryName,
  isMacroFileContent
};
