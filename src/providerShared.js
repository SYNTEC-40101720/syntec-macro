// providerShared.js
// 跨 Provider 共享的常量与工具：语言标识、函数索引、配置读取

const vscode = require('vscode');
const { buildFunctionIndex } = require('./functions');

const LANG_ID = 'syntec-macro';

// 函数名索引（补全与悬停共用，仅构建一次）
const functionIndex = buildFunctionIndex();

function getConfig(resource) {
  return vscode.workspace.getConfiguration('syntecMacro', resource);
}

function isFeatureEnabled(resource, key) {
  return getConfig(resource).get(key, true);
}

module.exports = { LANG_ID, functionIndex, getConfig, isFeatureEnabled };
