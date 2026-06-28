// fileResolver.js
// Pure helpers for macro program filename normalization and lookup candidates.

const path = require('path');

const MACRO_FILE_EXTENSIONS = ['.nc', '.cnc', '.tap', '.prt', '.mpf', '.ptp', '.pim', '.anc', '.bj', '.edit', '.demo'];

function normalizeProgramName(progNo) {
  let fileName = progNo;
  if (/^\d+$/.test(fileName)) {
    fileName = 'G' + fileName.padStart(4, '0');
  } else if (/^G?\d+$/i.test(fileName)) {
    fileName = 'G' + fileName.replace(/^G/i, '').padStart(4, '0');
  }
  return fileName;
}

function normalizeSubprogramName(progNo) {
  let fileName = progNo;
  if (/^\d+$/.test(fileName)) {
    fileName = 'O' + fileName.padStart(4, '0');
  } else if (/^O?\d+$/i.test(fileName)) {
    fileName = 'O' + fileName.replace(/^O/i, '').padStart(4, '0');
  }
  return fileName;
}

function buildFileCandidates(dir, fileName) {
  return [path.join(dir, fileName), ...MACRO_FILE_EXTENSIONS.map(ext => path.join(dir, fileName + ext))];
}

module.exports = {
  MACRO_FILE_EXTENSIONS,
  normalizeProgramName,
  normalizeSubprogramName,
  buildFileCandidates
};
