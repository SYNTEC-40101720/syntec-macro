// keywords.js
// 关键字、常量、控制流、变量格式定义
// 数据真源：src/data/keywords.json（Phase R2 迁出，唯一 schema）
// 含 2 张表：keywords（分组数组）+ keywordDocs（关键词详细说明 map）

const path = require('path');

let cached = null;
let cachedMtime = 0;

function loadData() {
  const fs = require('fs');
  const dataPath = path.join(__dirname, 'data', 'keywords.json');
  const stat = fs.statSync(dataPath);
  if (cached && stat.mtimeMs === cachedMtime) {
    return cached;
  }
  const raw = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  if (!raw || !raw.keywords || !raw.keywordDocs) {
    throw new Error('keywords.json: missing keywords/keywordDocs');
  }
  cached = raw;
  cachedMtime = stat.mtimeMs;
  return cached;
}

function getKeywords() {
  return loadData().keywords;
}

function getKeywordDocs() {
  return loadData().keywordDocs;
}

let _allKeywordsCache = null;

function getAllKeywords() {
  if (_allKeywordsCache) return _allKeywordsCache;
  const kw = getKeywords();
  _allKeywordsCache = [...new Set([
    ...kw.conditional,
    ...kw.repeat,
    ...kw.while,
    ...kw.for,
    ...kw.case,
    ...kw.flow,
    ...kw.operators,
    ...kw.robot
  ])];
  return _allKeywordsCache;
}

function getMCodeDesc(code) {
  const { getCodeShortDescription } = require('./codeDocs');
  return getCodeShortDescription(code) || 'M代码';
}

/**
 * 获取关键词详细说明
 * @param {string} keyword - 关键词
 * @returns {object|null} - 包含 sig 和 doc 的对象，或 null
 */
function getKeywordDoc(keyword) {
  return getKeywordDocs()[keyword] || null;
}

module.exports = {
  get keywords() {
    return getKeywords();
  },
  get keywordDocs() {
    return getKeywordDocs();
  },
  getKeywords,
  getKeywordDocs,
  getAllKeywords,
  getMCodeDesc,
  getKeywordDoc
};