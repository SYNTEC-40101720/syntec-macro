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

// P0-C 第 2 项：Worker 端 backend 选择
const WORKER_BACKEND_DEFAULT = 'javascript';
const WORKER_BACKEND_OPTIONS = Object.freeze([
  'javascript',
  'rust-wasm-shadow',
  'rust-wasm'
]);

/**
 * 读 `syntecMacro.analysisBackend` 配置；非法值回退到 default。
 * 后端切换的行为由 createAnalysisBackend 兜底；这里只做配置校验。
 *
 * @returns {string}
 */
function getAnalysisBackendSetting() {
  const configured = getConfig().get('analysisBackend', WORKER_BACKEND_DEFAULT);
  if (!WORKER_BACKEND_OPTIONS.includes(configured)) {
    return WORKER_BACKEND_DEFAULT;
  }
  return configured;
}

module.exports = {
  LANG_ID,
  functionIndex,
  getConfig,
  isFeatureEnabled,
  WORKER_BACKEND_DEFAULT,
  WORKER_BACKEND_OPTIONS,
  getAnalysisBackendSetting
};
