// definitionProvider.js
// 跳转定义：GOTO N标签、G65/G66/M98/M198 宏程序文件

const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const {
  normalizeProgramName,
  normalizeSubprogramName,
  buildFileCandidates
} = require('./fileResolver');
const { getConfig } = require('./providerShared');

const RECURSIVE_SEARCH_DEPTH = 5;

function createNLabelRegex(labelNo) {
  if (labelNo) return new RegExp('^N' + labelNo + '\\s*;', 'i');
  return /^N(\d+)\s*;/i;
}

function getTargetMatchAtPosition(document, position, regex, targetGroupIndex = 2) {
  const line = document.lineAt(position.line).text;
  let match;
  regex.lastIndex = 0;
  while ((match = regex.exec(line)) !== null) {
    const prefix = match.slice(1, targetGroupIndex).join('');
    const target = match[targetGroupIndex];
    const targetStart = match.index + prefix.length;
    const targetEnd = targetStart + target.length;
    if (position.character >= targetStart && position.character <= targetEnd) {
      return {
        text: target,
        range: new vscode.Range(position.line, targetStart, position.line, targetEnd)
      };
    }
  }
  return null;
}

function provideDefinition(document, position) {
  // GOTO 数字 → 跳转到 N 标签
  // 实测语法：GOTO 100;（不带N），目标为 N100;
  const gotoTarget = getTargetMatchAtPosition(document, position, /\b(GOTO\s+)(\d+)(?!\w)/ig);
  if (gotoTarget) {
    const targetLabel = 'N' + gotoTarget.text;
    const labelRegex = createNLabelRegex(gotoTarget.text);
    const targets = [];
    for (let i = 0; i < document.lineCount; i++) {
      const rawLine = document.lineAt(i).text;
      const l = rawLine.trim();
      if (labelRegex.test(l)) {
        const start = rawLine.search(/\S/);
        const labelRange = new vscode.Range(i, start, i, start + targetLabel.length);
        targets.push(new vscode.Location(document.uri, labelRange));
      }
    }
    return targets;
  }

  // G65/G66/G66.1 Pxxx → 跳转到宏程序（文件名约定 G0xxx）
  const macroCallTarget = getTargetMatchAtPosition(document, position, /\b(G6[56](?:\.1)?\s+)(P\w+)/ig);
  if (macroCallTarget) {
    const progNo = macroCallTarget.text.substring(1).toUpperCase();
    // 尝试在当前工作区找同名文件
    const targetFile = findMacroFile(document, progNo, normalizeProgramName);
    if (targetFile) {
      return [new vscode.Location(vscode.Uri.file(targetFile), new vscode.Position(0, 0))];
    }
  }

  // G65/G66/G66.1 P"Name" → 跳转到同名宏程序文件（静态字符串字面量）
  const stringMacroCallTarget = getTargetMatchAtPosition(document, position, /\b(G6[56](?:\.1)?\s+)(P")([^"]+)(")/ig, 3);
  if (stringMacroCallTarget) {
    const targetFile = findMacroFile(document, stringMacroCallTarget.text, name => name);
    if (targetFile) {
      return [new vscode.Location(vscode.Uri.file(targetFile), new vscode.Position(0, 0))];
    }
  }

  // M98/M198 Pxxx → 跳转到 O 副程序（文件名约定 O0xxx）
  const subprogramCallTarget = getTargetMatchAtPosition(document, position, /\b(M(?:98|198)\s+)(P\w+)/ig);
  if (subprogramCallTarget) {
    const progNo = subprogramCallTarget.text.substring(1).toUpperCase();
    const targetFile = findMacroFile(document, progNo, normalizeSubprogramName);
    if (targetFile) {
      return [new vscode.Location(vscode.Uri.file(targetFile), new vscode.Position(0, 0))];
    }
  }

  return [];
}

// 在工作区查找宏程序文件
function findMacroFile(document, progNo, normalizeName = normalizeProgramName) {
  const folder = vscode.workspace.getWorkspaceFolder(document.uri);
  if (!folder) return null;

  const dir = folder.uri.fsPath;
  const fileName = normalizeName(progNo);

  const candidates = buildFileCandidates(dir, fileName);

  for (const c of candidates) {
    try { if (fs.existsSync(c)) return c; } catch {}
  }

  const recursiveCandidates = buildFileCandidates('', fileName)
    .map(candidate => path.basename(candidate).toUpperCase());

  let found = findFileRecursive(dir, new Set(recursiveCandidates), RECURSIVE_SEARCH_DEPTH);
  if (found) return found;

  // includePath 配置支持
  const config = getConfig(document.uri);
  const includePaths = config.get('includePath', []);
  if (Array.isArray(includePaths)) {
    for (const p of includePaths) {
      if (typeof p !== 'string') continue;
      let stat;
      try { stat = fs.statSync(p); } catch { continue; }
      if (!stat.isDirectory()) continue;
      const cands = buildFileCandidates(p, fileName);
      for (const c of cands) {
        try { if (fs.existsSync(c)) return c; } catch {}
      }
      found = findFileRecursive(p, new Set(recursiveCandidates), RECURSIVE_SEARCH_DEPTH);
      if (found) return found;
    }
  }

  return null;
}

function findFileRecursive(dir, targetUpperNames, maxDepth, depth = 0) {
  if (depth > maxDepth) return null;
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return null;
  }

  for (const entry of entries) {
    if (targetUpperNames.has(entry.name.toUpperCase())) return path.join(dir, entry.name);
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist') continue;
    const found = findFileRecursive(path.join(dir, entry.name), targetUpperNames, maxDepth, depth + 1);
    if (found) return found;
  }

  return null;
}

module.exports = { provideDefinition };
