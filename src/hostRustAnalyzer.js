// @ts-check
// Host 端同步 Rust/Wasm analyzer 注入层.
//
// 在 `extension.js::activate` 中 await 一次 wasm 实例加载并缓存同步
// analyzer 实例; provider 通过 `getHostRustAnalyzer()` 拿到同步入口。
// 加载未完成或失败时返回 `null`, caller 返回空 edits/symbols
// (R1.2 起 JS 回退路径已删除, 无 fallback)。
//
// 单测见 tests/hostRustAnalyzer.test.js。

const { loadRustWasmAsset } = require('./rustWasmAsset');
const { createRustWasmAdapter } = require('./rustWasmAdapter');
const { DEFAULT_MANIFEST_PATH: DEFAULT_WORKER_MANIFEST_PATH } = require('./rustWasmWorkerAdapter');
const {
  createAnalysisRequest,
  createDocumentSnapshot,
  ANALYSIS_PROTOCOL_VERSION
} = require('./analysisProtocol');

// 内联 LANG_ID 而不 require providerShared (后者顶层 require('vscode') 在 node
// 单测环境会 fail). 与 providerShared.js LANG_ID 保持同步定义.
const LANG_ID = 'syntec-macro';
void ANALYSIS_PROTOCOL_VERSION;

// 复用 rustWasmWorkerAdapter 的默认 manifest 路径, 保证 host 端同步 analyzer
// 与 worker 异步 adapter 指向同一 wasm 资产 (相同字节级 / SHA 校验).
const DEFAULT_MANIFEST_PATH = DEFAULT_WORKER_MANIFEST_PATH;

let cachedHostAnalyzer = null;
let cachedHostInstance = null;  // wasm Instance，用于按 file 创建 nav-only adapter
let initPromise = null;

/**
 * 同步获取 host 端 Rust analyzer。加载未完成时返回 `null`（caller 返回空
 * edits/symbols，不回退 JS）。
 * @returns {((request: import('./analysisProtocol').AnalysisRequest) => import('./analysisProtocol').AnalysisResult) | null}
 */
function getHostRustAnalyzer() {
  return cachedHostAnalyzer;
}

/**
 * 同步获取 host 端 wasm Instance（仅供需要 file-specific adapter 的路径用，
 * e.g. navigationProvider nav batch）。加载未完成时返回 `null`。
 * @returns {WebAssembly.Instance | null}
 */
function getHostWasmInstance() {
  return cachedHostInstance;
}

/**
 * 给定真实 filePath，创建一个 nav-only adapter：走 Phase 1.3 的
 * `syntec_core_analyze_navigation_json` ABI（跳过 diagnostics+formatter，
 * 4-6x 快于 analyze_request），并让 adapter 在 normalize 时为该文件
 * 注入 programEntryName/macroProgramName 元数据。每文件一个 adapter 是 OK
 * 的 — adapter closure 仅捕获 wasm exports + options，无额外内存开销。
 *
 * 加载未完成时返回 `null`（caller 返回空结果）。
 *
 * @param {string} filePath 裸文件路径（不含 file:// scheme）
 * @param {{createAdapter?: (exports: object, options?: object) => Function}} [injectables]
 * @returns {((request: import('./analysisProtocol').AnalysisRequest) => import('./analysisProtocol').AnalysisResult) | null}
 */
function createNavOnlyAdapter(filePath, injectables = {}) {
  if (!cachedHostInstance) return null;
  if (typeof filePath !== 'string' || filePath.length === 0) {
    throw new TypeError('createNavOnlyAdapter: filePath must be a non-empty string');
  }
  const createAdapter = injectables.createAdapter || createRustWasmAdapter;
  return createAdapter(cachedHostInstance.exports, { navigationFilePath: filePath });
}

/**
 * 重置 host analyzer 状态（测试用；生产环境一般不调用）。
 */
function resetHostRustAnalyzer() {
  cachedHostAnalyzer = null;
  cachedHostInstance = null;
  initPromise = null;
}

/**
 * 初始化 host 端 Rust analyzer: await wasm 加载 + createRustWasmAdapter,
 * 完成后同步 `getHostRustAnalyzer()` 可用。重复调用幂等返回同一 Promise。
 *
 * @param {string} [manifestPath] 资产 manifest 路径（测试 override 用）。
 * @param {{loadAsset?: (path: string, opts?: object) => Promise<{instance: WebAssembly.Instance}>, createAdapter?: (exports: object, options?: object) => Function}} [injectables]
 * @returns {Promise<Function>} resolve analyzer 同步入口。
 */
async function initHostRustAnalyzer(manifestPath, injectables = {}) {
  if (cachedHostAnalyzer) return cachedHostAnalyzer;
  if (initPromise) return initPromise;
  const resolvedManifestPath = manifestPath || DEFAULT_MANIFEST_PATH;
  const loadAsset = injectables.loadAsset || loadRustWasmAsset;
  const createAdapter = injectables.createAdapter || createRustWasmAdapter;
  initPromise = (async () => {
    const { instance } = await loadAsset(resolvedManifestPath);
    cachedHostInstance = instance;
    cachedHostAnalyzer = createAdapter(instance.exports);
    return cachedHostAnalyzer;
  })();
  return initPromise;
}

/**
 * 同步 helper: 为 host provider 用 AnalysisRequest 构造 helper。
 * @param {string} text
 * @param {string} [uri]
 * @param {number} [version]
 * @returns {import('./analysisProtocol').AnalysisRequest}
 */
function makeRequest(text, uri = 'file:///host-analyzer.nc', version = 0) {
  return createAnalysisRequest(createDocumentSnapshot({
    uri, version, languageId: LANG_ID, text
  }));
}

module.exports = {
  initHostRustAnalyzer,
  getHostRustAnalyzer,
  getHostWasmInstance,
  createNavOnlyAdapter,
  resetHostRustAnalyzer,
  makeRequest
};
