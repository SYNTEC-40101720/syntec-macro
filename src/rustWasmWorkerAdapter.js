// @ts-check
// Worker 内的 Rust/Wasm 后端注入与显式 fallback 边界.
//
// R1.2 Stage B (2026-09-22): shadow 模式 (双跑 JS+Rust 比对差分作 telemetry) 已移除,
// JS backend fallback 路径已删除. 模块只返回 Rust 结果; 加载失败抛错由上层 worker
// 捕获并通过 control 消息上报 (Extension Host 决定 UI 提示).
//
// 本模块由 `validatorWorker.js` 在 Worker 线程内调用, **不** 在 Extension Host 主
// 线程上加载 Wasm; 把 `loadRustWasmAsset` 的资产加载与 `createRustWasmAdapter`
// 的协议适配组合成一个高阶 analyzer.

const path = require('path');
const { createRustWasmAdapter } = require('./rustWasmAdapter');
const {
  RustWasmAssetError,
  loadRustWasmAsset
} = require('./rustWasmAsset');

/**
 * Worker 默认 manifest 路径 — 从 `src/` 解析到 `assets/rust-wasm/manifest.json`。
 */
const DEFAULT_MANIFEST_PATH = path.join(
  __dirname,
  '..',
  'assets',
  'rust-wasm',
  'manifest.json'
);

/**
 * @typedef {import('./analysisProtocol').AnalysisRequest} AnalysisRequest
 * @typedef {import('./analysisProtocol').AnalysisResult} AnalysisResult
 * @typedef {(request: AnalysisRequest) => AnalysisResult | Promise<AnalysisResult>} AnalysisFunction
 */

/**
 * @typedef {Object} RustWasmWorkerOptions
 * @property {string} [manifestPath] Override 资产 manifest 路径（测试用）。
 * @property {(reason: string, error: Error, request: AnalysisRequest) => void} [onFallback]
 *   加载或运行时失败时调用；上层据此记录 telemetry, **不**承担实际回退.
 * @property {(manifestPath: string, options?: {requiredExports?: string[]}) => Promise<{instance: WebAssembly.Instance, manifest: object, bytes: Buffer}>} [loadAsset]
 *   资产加载器注入（测试用）；默认 `loadRustWasmAsset`。
 * @property {(wasmExports: object, options?: object) => AnalysisFunction} [createAdapter]
 *   协议适配器注入（测试用）；默认 `createRustWasmAdapter`。
 * @property {string[]} [requiredExports] manifest 必需 exports 子集。
 */

/**
 * 创建一个 Worker 端的 Rust/Wasm analyzer。
 *
 * @param {RustWasmWorkerOptions} [options]
 * @returns {Promise<AnalysisFunction>}
 *   返回 `(request) => AnalysisResult`; 加载失败抛错由上层 worker 捕获.
 */
async function createRustWasmWorkerAdapter(options = {}) {
  const manifestPath = options.manifestPath || DEFAULT_MANIFEST_PATH;
  const onFallback = options.onFallback;
  const loadAsset = options.loadAsset || loadRustWasmAsset;
  const createAdapter = options.createAdapter || createRustWasmAdapter;

  try {
    const { instance } = await loadAsset(manifestPath, {
      requiredExports: options.requiredExports
    });
    const rustAnalyzer = createAdapter(instance.exports, { });
    return async (request) => rustAnalyzer(request);
  } catch (err) {
    const reason = err instanceof RustWasmAssetError ? err.reason : 'rust-wasm-load-failed';
    const wrapped = err instanceof Error ? err : new Error(String(err));
    if (onFallback) onFallback(reason, wrapped, /** @type {AnalysisRequest} */ ({}));
    throw wrapped;
  }
}

module.exports = {
  DEFAULT_MANIFEST_PATH,
  createRustWasmWorkerAdapter
};
