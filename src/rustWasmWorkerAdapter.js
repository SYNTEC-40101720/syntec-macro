// @ts-check
// P0-C 第 2 项：Worker 内的 Rust/Wasm 后端注入与显式 fallback 边界。
//
// 本模块由 `validatorWorker.js` 在 Worker 线程内调用，**不** 在
// Extension Host 主线程上加载 Wasm；它把 `loadRustWasmAsset` 的资产加载
// 与 `createRustWasmAdapter` 的协议适配组合成一个高阶 analyzer，满足
// `createAnalysisBackend` 注入契约：
//
// - `backend = 'rust-wasm'`
// - 加载或运行时失败抛带 `reason` 的错误，由 `createAnalysisBackend`
//   的 `onFallback` 捕获并回退 JavaScript；
// - shadow 模式（`mode: 'shadow'`）下，analyzer 既跑 Rust 又跑 JS、
//   比较结果一致性，但**始终返回 JS 结果**；差异通过 `onShadowMismatch`
//   上报供生产 telemetry 记录，不影响最终用户诊断。
//
// 默认 backend 仍是 JavaScript；本模块不切换默认，只提供「可注入」入口，
// 满足 P0-C 第 2 项「shadow/differential 模式」边界；P0-C 第 3 项才允许
// 把默认 backend 切到 `rust-wasm`。

const path = require('path');
const { createRustWasmAdapter } = require('./rustWasmAdapter');
const {
  RustWasmAssetError,
  loadRustWasmAsset
} = require('./rustWasmAsset');

/**
 * Worker 默认 manifest 路径——从 `src/` 解析到 `assets/rust-wasm/manifest.json`。
 * 与 `scripts/probeRustWasm.js`/`scripts/benchmarkRustWasm.js` 共用同一份资产，
 * 保证开发态和生产态指向同一组字节-校验过的 wasm 二进制。
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
 * @property {AnalysisFunction} [javascriptAnalyzer] shadow 模式对照的 JS 后端；默认懒加载 `analysisCore.analyzeDocument`。
 * @property {(reason: string, error: Error, request: AnalysisRequest) => void} [onFallback]
 *   加载或运行时失败时调用；上层据此记录 telemetry，**不**承担实际回退（实际回退由 `createAnalysisBackend` 完成）。
 * @property {{mode?: 'shadow'|'primary', log?: (message: string) => void}} [shadow]
 *   shadow 模式：'shadow' 双跑 JS+Rust 并 onShadowMismatch；'primary' Rust 为主、失败显式抛错由上层回退。
 * @property {(mismatch: {request: AnalysisRequest, javascriptResult: AnalysisResult, rustResult: AnalysisResult}, error?: Error) => void} [onShadowMismatch]
 *   shadow 模式下结果不一致或 Rust 抛错的回调，生产 telemetry 用；不影响最终返回。
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
 * @returns {Promise<AnalysisFunction>} 返回一个 `(request) => AnalysisResult` 函数；shadow 模式返回 JS 结果，primary 模式返回 Rust 结果。
 */
async function createRustWasmWorkerAdapter(options = {}) {
  const manifestPath = options.manifestPath || DEFAULT_MANIFEST_PATH;
  const onFallback = options.onFallback;
  const shadowMode = options.shadow && options.shadow.mode === 'shadow';
  let javascriptAnalyzer = options.javascriptAnalyzer;
  const onShadowMismatch = options.onShadowMismatch;
  /** @type {(message: string) => void} */
  const log = options.shadow && options.shadow.log || (() => {});
  const loadAsset = options.loadAsset || loadRustWasmAsset;
  const createAdapter = options.createAdapter || createRustWasmAdapter;

  /** @type {AnalysisFunction} */
  let jsAnalyzer = async (request) => {
    if (!javascriptAnalyzer) {
      const { analyzeDocument } = require('./analysisCore');
      javascriptAnalyzer = analyzeDocument;
    }
    return javascriptAnalyzer(request);
  };
  jsAnalyzer = jsAnalyzer.bind(null);

  let rustAnalyzer;
  try {
    const { instance } = await loadAsset(manifestPath, {
      requiredExports: options.requiredExports
    });
    rustAnalyzer = createAdapter(instance.exports, { });
  } catch (err) {
    const reason = err instanceof RustWasmAssetError ? err.reason : 'rust-wasm-load-failed';
    const wrapped = err instanceof Error ? err : new Error(String(err));
    if (onFallback) onFallback(reason, wrapped, /** @type {AnalysisRequest} */ ({}));
    if (shadowMode) {
      log(`[rust-wasm] shadow 模式下资产加载失败，回退到 JavaScript：${wrapped.message}`);
      return jsAnalyzer;
    }
    throw wrapped;
  }

  if (shadowMode) {
    return async (request) => {
      let rustResult = null;
      let rustError = null;
      let jsResult;
      try {
        jsResult = await jsAnalyzer(request);
      } catch (err) {
        throw err;
      }
      try {
        rustResult = await rustAnalyzer(request);
      } catch (err) {
        rustError = err instanceof Error ? err : new Error(String(err));
      }
      if (rustError || !rustResult) {
        const reason = (rustError && rustError instanceof RustWasmAssetError)
          ? rustError.reason
          : 'rust-wasm-run-failed';
        if (onFallback && rustError) onFallback(reason, rustError, request);
        log(`[rust-wasm] shadow 模式下运行时失败，本请求回退 JS：${rustError ? rustError.message : 'empty result'}`);
        return jsResult;
      }
      if (!resultsEqualShallow(jsResult, rustResult)) {
        if (onShadowMismatch) onShadowMismatch({ request, javascriptResult: jsResult, rustResult }, rustError || undefined);
        log('[rust-wasm] shadow 比较发现 Rust/JS 差分，本请求保留 JS 结果');
      }
      return jsResult;
    };
  }

  return async (request) => rustAnalyzer(request);
}

/**
 * Shadow 模式的 shallow 比较：只比较 backend 标记与诊断数量/顺序的稳定字段。
 * 逐字段深比较留待 telemetry 进一步细化；shadow 模式只做"是否触发回退"决策。
 *
 * @param {AnalysisResult} javascriptResult
 * @param {AnalysisResult} rustResult
 * @returns {boolean}
 */
function resultsEqualShallow(javascriptResult, rustResult) {
  if (!javascriptResult || !rustResult) return false;
  if (javascriptResult.protocolVersion !== rustResult.protocolVersion) return false;
  if (!Array.isArray(javascriptResult.diagnostics) || !Array.isArray(rustResult.diagnostics)) return false;
  if (javascriptResult.diagnostics.length !== rustResult.diagnostics.length) return false;
  for (let i = 0; i < javascriptResult.diagnostics.length; i++) {
    const js = javascriptResult.diagnostics[i];
    const rs = rustResult.diagnostics[i];
    if (js.code !== rs.code || js.severity !== rs.severity) return false;
    if (js.range.start.line !== rs.range.start.line ||
        js.range.start.character !== rs.range.start.character ||
        js.range.end.line !== rs.range.end.line ||
        js.range.end.character !== rs.range.end.character) return false;
  }
  return true;
}

module.exports = {
  DEFAULT_MANIFEST_PATH,
  createRustWasmWorkerAdapter,
  resultsEqualShallow
};
