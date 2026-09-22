// functions.js
// 内置函数完整定义：补全数据 + Hover文档
// 数据真源：src/data/functions.json（Phase R2 迁出，唯一 schema）
// 基于《新代控制器技术参考手册》函数表修订

const path = require('path');

let cached = null;
let cachedMtime = 0;

function loadData() {
  const fs = require('fs');
  const dataPath = path.join(__dirname, 'data', 'functions.json');
  const stat = fs.statSync(dataPath);
  if (cached && stat.mtimeMs === cachedMtime) {
    return cached;
  }
  const raw = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  if (!raw || !Array.isArray(raw.functions)) {
    throw new Error('functions.json: missing `functions` array');
  }
  cached = raw.functions;
  cachedMtime = stat.mtimeMs;
  return cached;
}

function getFunctions() {
  return loadData();
}

/** 构建函数名索引 Map，key 为函数名（大写），value 为函数对象 */
function buildFunctionIndex() {
  const map = new Map();
  for (const fn of getFunctions()) {
    map.set(fn.name, fn);
  }
  return map;
}

module.exports = {
  get functions() {
    return getFunctions();
  },
  getFunctions,
  buildFunctionIndex
};