const path = require('path');
const { MACRO_FILE_EXTENSIONS } = require('./fileResolver');
const { getProgramEntryName } = require('./navigationSymbols');

function isPotentialNavigationFile(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  return Boolean(getProgramEntryName(filePath)) || !extension || MACRO_FILE_EXTENSIONS.includes(extension);
}

async function collectNavigationIndexEntries(files, options) {
  const entries = [];
  for (const file of files) {
    if (options.isCancelled()) break;
    const filePath = options.getFilePath(file);
    if (!isPotentialNavigationFile(filePath)) continue;

    let index;
    try {
      index = await options.loadIndex(file, filePath);
    } catch {
      continue;
    }
    if (options.isCancelled()) break;
    if (index) entries.push({ file, index });
  }
  return entries;
}

module.exports = { collectNavigationIndexEntries, isPotentialNavigationFile };