const path = require('path');
const { MACRO_FILE_EXTENSIONS } = require('./fileResolver');
const { getProgramEntryName } = require('./navigationSymbols');

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

module.exports = { collectNavigationIndexEntries, isPotentialNavigationFile };