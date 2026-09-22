// codeDocs.js
// Hover documentation for G/M codes.
// 数据真源：src/data/hoverDocs.json（Phase R2 迁出，唯一 schema）
// 含 3 张表：gCodeDocs / g10LCodeDocs / mCodeDocs

const path = require('path');

let cached = null;
let cachedMtime = 0;

function loadData() {
  const fs = require('fs');
  const dataPath = path.join(__dirname, 'data', 'hoverDocs.json');
  const stat = fs.statSync(dataPath);
  if (cached && stat.mtimeMs === cachedMtime) {
    return cached;
  }
  const raw = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  if (!raw || typeof raw !== 'object' ||
    !raw.gCodeDocs || !raw.g10LCodeDocs || !raw.mCodeDocs) {
    throw new Error('hoverDocs.json: missing gCodeDocs/g10LCodeDocs/mCodeDocs');
  }
  cached = raw;
  cachedMtime = stat.mtimeMs;
  return cached;
}

function getGCodeDocs() {
  return loadData().gCodeDocs;
}

function getG10LCodeDocs() {
  return loadData().g10LCodeDocs;
}

function getMCodeDocs() {
  return loadData().mCodeDocs;
}

function getCodeDoc(code) {
  const normalized = code.toUpperCase();
  const data = loadData();
  return data.gCodeDocs[normalized] || data.mCodeDocs[normalized] || null;
}

function getG10LCodeDoc(lCode) {
  return loadData().g10LCodeDocs[String(lCode).toUpperCase()] || null;
}

function getCodeShortDescription(code) {
  const doc = getCodeDoc(code);
  return doc ? doc.doc : null;
}

module.exports = {
  get gCodeDocs() {
    return getGCodeDocs();
  },
  get g10LCodeDocs() {
    return getG10LCodeDocs();
  },
  get mCodeDocs() {
    return getMCodeDocs();
  },
  getGCodeDocs,
  getG10LCodeDocs,
  getMCodeDocs,
  getCodeDoc,
  getG10LCodeDoc,
  getCodeShortDescription
};