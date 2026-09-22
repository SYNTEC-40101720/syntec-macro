// systemVariables.js
// 系统变数固定编号语义表（hover 提示用，不做静态诊断）
// 数据真源：src/data/systemVariables.json（Phase R2 迁出，唯一 schema）
// 维护规则：仅登记手册已明确编号的固定子集，不做整段 #1001~#5500 映射推断。

const path = require('path');

let cached = null;
let cachedMtime = 0;

function loadData() {
  const fs = require('fs');
  const dataPath = path.join(__dirname, 'data', 'systemVariables.json');
  const stat = fs.statSync(dataPath);
  // 进程内只读缓存；mtime 变化时重新加载（开发期文件改动后下次调用即生效）
  if (cached && stat.mtimeMs === cachedMtime) {
    return cached;
  }
  const raw = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  if (!raw || typeof raw !== 'object' || !raw.docs || typeof raw.docs !== 'object') {
    throw new Error('systemVariables.json: missing `docs` object');
  }
  cached = raw.docs;
  cachedMtime = stat.mtimeMs;
  return cached;
}

/**
 * 系统变数编号 → 语义说明（仅供 hover，不要在 validator 中据此 emit 诊断）。
 * 长度控制在 8 行内，避免 hover 弹窗过长。
 * 数据真源已迁到 src/data/systemVariables.json；本模块作 host 层只读缓存入口。
 * @returns {Object<string,string>} 编号 → 语义说明
 */
function getSystemVariableDocs() {
  return loadData();
}

/**
 * 由变量记号（如 "#1500" / "#1930"）查询系统变数语义。
 * @param {string} variable 变量记号，大写，形如 "#1500"
 * @returns {string|null} 语义说明 multiline 字符串，无则 null
 */
function getSystemVariableDoc(variable) {
  if (!variable) return null;
  const normalized = variable.toUpperCase();
  const docs = loadData();
  return Object.prototype.hasOwnProperty.call(docs, normalized) ? docs[normalized] : null;
}

module.exports = {
  getSystemVariableDocs,
  getSystemVariableDoc
};