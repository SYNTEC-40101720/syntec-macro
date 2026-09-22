// @ts-check
// pathResolver.js
// Host-only 文件路径/元数据辅助 helper 集合 (R1.2 Stage B §2.3 新建, §2.12 后 inline, 2026-09-22).
//
// 用途: 给 host 层 `rustWasmAdapter.js` / `definitionProvider.js` / `navigationProvider.js`
// 提供跨 macro 文件的元数据访问, 不依赖被剔除的 `navigationSymbols.js` /
// `navigationIndex.js` 中的 analyzer 行为部分.
//
// `extractNavigationSymbols` / `getProgramEntryName` / `isMacroFileContent` /
// `getMacroProgramName` / `collectNavigationIndexEntries` / `isPotentialNavigationFile`
// 全部在本文件 inline 实现, 仅依赖 `fileResolver.js` 的 path helper (host-only, 整体保留).
//
// 测试覆盖:
//   - 4 元数据 helper: tests/extension.test.js (原 navigationSymbols 断言已改为 require pathResolver)
//   - collectNavigationIndexEntries / isPotentialNavigationFile: tests/extension.test.js

const path = require('path');
const {
  MACRO_FILE_EXTENSIONS,
  normalizeProgramName,
  normalizeSubprogramName,
  buildFileCandidates
} = require('./fileResolver');

// --- inlined from navigationSymbols.js (host-only, no lexer dependency) ---

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

// --- inlined from navigationIndex.js (host-only, no analyzer dependency) ---

function isPotentialNavigationFile(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  return Boolean(getProgramEntryName(filePath)) || !extension || MACRO_FILE_EXTENSIONS.includes(extension);
}

async function collectNavigationIndexEntries(files, options) {
  const entries = [];
  const requestedConcurrency = Number.isInteger(options.concurrency) && options.concurrency > 0
    ? options.concurrency
    : 1;
  let nextFileIndex = 0;

  async function consumeFiles() {
    while (true) {
      if (options.isCancelled()) return;
      const fileIndex = nextFileIndex++;
      if (fileIndex >= files.length) return;

      const file = files[fileIndex];
      const filePath = options.getFilePath(file);
      if (!isPotentialNavigationFile(filePath)) continue;

      let index;
      try {
        index = await options.loadIndex(file, filePath);
      } catch {
        continue;
      }
      if (options.isCancelled()) return;
      if (index) entries[fileIndex] = { file, index };
    }
  }

  const workerCount = Math.min(requestedConcurrency, files.length);
  await Promise.all(Array.from({ length: workerCount }, consumeFiles));
  return entries.filter(Boolean);
}

module.exports = {
  // 元数据 helper (host-only, inlined from navigationSymbols.js)
  extractNavigationSymbols,
  getMacroProgramName,
  getProgramEntryName,
  isMacroFileContent,
  // path helper (host-only, 来自 fileResolver — §1d 判定为整体保留)
  MACRO_FILE_EXTENSIONS,
  normalizeProgramName,
  normalizeSubprogramName,
  buildFileCandidates,
  // workspace navigation helper (host-only, inlined from navigationIndex.js)
  collectNavigationIndexEntries,
  isPotentialNavigationFile
};
