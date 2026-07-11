const { performance } = require('perf_hooks');
const { buildNavigationIndexEntry } = require('../src/navigationSymbols');

const FILE_COUNT = 500;
const LINES_PER_FILE = 40;
const FIRST_RUN_LIMIT_MS = 2000;
const REPEAT_RUN_LIMIT_MS = 500;

function createMacroText(fileIndex) {
  const lines = ['%@MACRO'];
  for (let lineIndex = 1; lineIndex < LINES_PER_FILE; lineIndex++) {
    if (lineIndex % 10 === 0) {
      lines.push(`N${fileIndex * 100 + lineIndex};`);
    } else if (lineIndex % 3 === 0) {
      lines.push(`G65 P${1000 + (fileIndex % 20)} A${lineIndex};`);
    } else {
      lines.push(`#1 := #1 + ${lineIndex};`);
    }
  }
  return lines.join('\n');
}

function buildFixture() {
  return Array.from({ length: FILE_COUNT }, (_, fileIndex) => ({
    filePath: `/workspace/G${String(fileIndex).padStart(4, '0')}.nc`,
    text: createMacroText(fileIndex)
  }));
}

function measureIndexBuild(files) {
  const start = performance.now();
  const entries = files.map(file => buildNavigationIndexEntry(file.filePath, file.text));
  return { durationMs: performance.now() - start, entries };
}

function main() {
  const files = buildFixture();
  const first = measureIndexBuild(files);
  const repeat = measureIndexBuild(files);

  if (first.entries.some(entry => !entry) || repeat.entries.some(entry => !entry)) {
    throw new Error('Navigation benchmark produced an incomplete index.');
  }

  console.info(`Navigation parser benchmark: ${FILE_COUNT} files, ${FILE_COUNT * LINES_PER_FILE} lines`);
  console.info(`First run: ${first.durationMs.toFixed(2)} ms (limit ${FIRST_RUN_LIMIT_MS} ms)`);
  console.info(`Repeat run: ${repeat.durationMs.toFixed(2)} ms (limit ${REPEAT_RUN_LIMIT_MS} ms)`);

  if (first.durationMs > FIRST_RUN_LIMIT_MS || repeat.durationMs > REPEAT_RUN_LIMIT_MS) {
    process.exitCode = 1;
  }
}

if (require.main === module) main();

module.exports = { buildFixture, measureIndexBuild };