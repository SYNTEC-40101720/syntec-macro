// tests/pathResolver.test.js
// pathResolver host-only helper 直接单测：导航符号提取、文件元数据判定、
// 导航索引收集（并发/取消/过滤）。

const assert = require('node:assert');
const { test } = require('node:test');
const path = require('path');
const {
  extractNavigationSymbols,
  getMacroProgramName,
  getProgramEntryName,
  isMacroFileContent,
  MACRO_FILE_EXTENSIONS,
  normalizeProgramName,
  normalizeSubprogramName,
  buildFileCandidates,
  collectNavigationIndexEntries,
  isPotentialNavigationFile
} = require('../src/pathResolver');

// --- extractNavigationSymbols ---

test('extractNavigationSymbols finds N labels and macro header with zero-based lines', () => {
  const symbols = extractNavigationSymbols('%@MACRO\nN10;\n#1 := 1;\n  N200 ;\n');
  assert.deepStrictEqual(symbols, [
    { name: '%@MACRO', kind: 'macroHeader', line: 0 },
    { name: 'N10', kind: 'label', line: 1 },
    { name: 'N200', kind: 'label', line: 3 }
  ]);
});

test('extractNavigationSymbols ignores non-label lines and lowercase macro header', () => {
  const symbols = extractNavigationSymbols('%@macro\nGOTO 100;\nN100;\n');
  assert.deepStrictEqual(symbols, [
    { name: '%@MACRO', kind: 'macroHeader', line: 0 },
    { name: 'N100', kind: 'label', line: 2 }
  ]);
});

// --- getProgramEntryName ---

test('getProgramEntryName recognizes G/O base names across platforms and extensions', () => {
  assert.strictEqual(getProgramEntryName('C:\\CNC\\G1000.nc'), 'G1000');
  assert.strictEqual(getProgramEntryName('/macros/O8000'), 'O8000');
  assert.strictEqual(getProgramEntryName('g42.MPF'), 'G42');
  assert.strictEqual(getProgramEntryName('G1000'), 'G1000');
});

test('getProgramEntryName returns null for non program-entry names', () => {
  assert.strictEqual(getProgramEntryName('readme.md'), null);
  assert.strictEqual(getProgramEntryName('notes'), null);
  assert.strictEqual(getProgramEntryName('X100.nc'), null);
});

// --- isMacroFileContent ---

test('isMacroFileContent accepts program-entry or macro-extension files unconditionally', () => {
  assert.strictEqual(isMacroFileContent('G1000.nc', 'any text'), true);
  assert.strictEqual(isMacroFileContent('O8000', 'any text'), true);
  assert.strictEqual(isMacroFileContent('part.tap', 'any text'), true);
});

test('isMacroFileContent for extensionless files depends on macro header in text', () => {
  assert.strictEqual(isMacroFileContent('notes', '%@MACRO\nN1;\n'), true);
  assert.strictEqual(isMacroFileContent('notes', '#1 := 1;\n'), false);
});

// --- getMacroProgramName ---

test('getMacroProgramName requires macro header and derives name from file', () => {
  assert.strictEqual(getMacroProgramName('G1000.nc', '%@MACRO\n'), 'G1000');
  assert.strictEqual(getMacroProgramName('sub routine', '%@MACRO\n'), 'SUB ROUTINE');
  assert.strictEqual(getMacroProgramName('G1000.nc', '#1 := 1;\n'), null);
});

// --- fileResolver re-exports ---

test('fileResolver path helpers are re-exported unchanged', () => {
  assert.ok(Array.isArray(MACRO_FILE_EXTENSIONS) && MACRO_FILE_EXTENSIONS.includes('.nc'));
  assert.strictEqual(normalizeProgramName('12'), 'G0012');
  assert.strictEqual(normalizeProgramName('g100'), 'G0100');
  assert.strictEqual(normalizeSubprogramName('8000'), 'O8000');
  const candidates = buildFileCandidates(path.join('CNC', 'macros'), 'G1000');
  assert.strictEqual(candidates[0], path.join('CNC', 'macros', 'G1000'));
  assert.strictEqual(candidates.length, 1 + MACRO_FILE_EXTENSIONS.length);
});

// --- isPotentialNavigationFile ---

test('isPotentialNavigationFile accepts program entries, macro extensions and extensionless files', () => {
  assert.strictEqual(isPotentialNavigationFile('G1000.nc'), true);
  assert.strictEqual(isPotentialNavigationFile('part.prt'), true);
  assert.strictEqual(isPotentialNavigationFile('untitled'), true);
  assert.strictEqual(isPotentialNavigationFile('notes.md'), false);
});

// --- collectNavigationIndexEntries ---

function createCollectorContext(overrides = {}) {
  const loaded = [];
  return {
    concurrency: 2,
    isCancelled: () => false,
    getFilePath: file => file.path,
    loadIndex: async (file, filePath) => {
      loaded.push(filePath);
      return { file: filePath };
    },
    ...overrides
  };
}

test('collectNavigationIndexEntries filters to potential navigation files and preserves order', async () => {
  const files = [
    { path: 'G1000.nc' },
    { path: 'skip.md' },
    { path: 'O8000' }
  ];
  const entries = await collectNavigationIndexEntries(files, createCollectorContext());
  assert.strictEqual(entries.length, 2);
  assert.strictEqual(entries[0].file.path, 'G1000.nc');
  assert.strictEqual(entries[1].file.path, 'O8000');
});

test('collectNavigationIndexEntries swallows loadIndex errors and skips failed files', async () => {
  const files = [{ path: 'G1000.nc' }, { path: 'G2000.nc' }];
  const entries = await collectNavigationIndexEntries(files, createCollectorContext({
    loadIndex: async (file, filePath) => {
      if (filePath === 'G1000.nc') throw new Error('read failed');
      return { file: filePath };
    }
  }));
  assert.strictEqual(entries.length, 1);
  assert.strictEqual(entries[0].file.path, 'G2000.nc');
});

test('collectNavigationIndexEntries stops when cancelled', async () => {
  const files = Array.from({ length: 10 }, (_, i) => ({ path: `G${1000 + i}.nc` }));
  let loadCalls = 0;
  let cancelled = false;
  const entries = await collectNavigationIndexEntries(files, createCollectorContext({
    isCancelled: () => cancelled,
    loadIndex: async () => {
      loadCalls += 1;
      if (loadCalls >= 2) cancelled = true;
      return { loaded: true };
    }
  }));
  assert.ok(loadCalls < files.length, `should stop early, loadCalls=${loadCalls}`);
  assert.ok(entries.length <= loadCalls);
});

test('collectNavigationIndexEntries handles empty file list', async () => {
  const entries = await collectNavigationIndexEntries([], createCollectorContext());
  assert.deepStrictEqual(entries, []);
});

test('collectNavigationIndexEntries clamps invalid concurrency to 1', async () => {
  const files = [{ path: 'G1000.nc' }];
  const entries = await collectNavigationIndexEntries(files, createCollectorContext({ concurrency: -3 }));
  assert.strictEqual(entries.length, 1);
});
