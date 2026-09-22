// 分析后端选择边界.
//
// R1.2 Stage B (2026-09-22): JAVASCRIPT_BACKEND 分支已删除; createAnalysisBackend
// 只支持 rust-wasm; fallback 不再回退 JS. analyzeDocument (来自已剔除的
// analysisCore.js) 已不再 require.

const RUST_WASM_BACKEND = 'rust-wasm';

/**
 * @typedef {import('./analysisProtocol').AnalysisRequest} AnalysisRequest
 * @typedef {import('./analysisProtocol').AnalysisResult} AnalysisResult
 * @typedef {(request: AnalysisRequest) => AnalysisResult} AnalysisFunction
 */

function assertAnalyzer(value, name) {
  if (typeof value !== 'function') {
    throw new TypeError(`${name} must be a function`);
  }
}

/**
 * Create an analyzer with an explicit rust-wasm backend.
 *
 * R1.2 后: javascript backend 与 JS fallback 路径已退役; rustAnalyzer 失败
 * 由 onFallback 上报但不再回退 JS, 上层决定 UI 提示.
 *
 * @param {{
 *   backend?: 'rust-wasm',
 *   rustAnalyzer?: AnalysisFunction,
 *   onFallback?: (error: Error, request: AnalysisRequest) => void
 * }} [options]
 * @returns {AnalysisFunction}
 */
function createAnalysisBackend(options = {}) {
  if (options === null || typeof options !== 'object' || Array.isArray(options)) {
    throw new TypeError('options must be an object');
  }
  const backend = options.backend || RUST_WASM_BACKEND;
  if (backend !== RUST_WASM_BACKEND) {
    throw new TypeError(`unsupported analysis backend: ${backend} (only rust-wasm is available)`);
  }

  assertAnalyzer(options.rustAnalyzer, 'rustAnalyzer');
  assertAnalyzer(options.onFallback, 'onFallback');
  const rustAnalyzer = options.rustAnalyzer;
  const onFallback = options.onFallback;

  return request => {
    try {
      const result = rustAnalyzer(request);
      if (result === null || typeof result !== 'object' ||
          result.backend !== RUST_WASM_BACKEND) {
        throw new Error('Rust analysis backend returned an invalid result');
      }
      return result;
    } catch (error) {
      const normalizedError = error instanceof Error
        ? error
        : new Error(String(error));
      onFallback(normalizedError, request);
      // R1.2: 不再回退 JS, 直接 rethrow 由上层 worker 决定 UI.
      throw normalizedError;
    }
  };
}

module.exports = {
  RUST_WASM_BACKEND,
  createAnalysisBackend
};
