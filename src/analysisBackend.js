// 分析后端选择边界：Rust/Wasm 完成 parity 后可由适配层注入。

const { analyzeDocument } = require('./analysisCore');

const JAVASCRIPT_BACKEND = 'javascript';
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
 * Create an analyzer with an explicit backend and a non-silent JavaScript fallback.
 *
 * Rust/Wasm is deliberately dependency-injected so the production extension does
 * not load an unverified binary or Wasm asset by accident.
 *
 * @param {{
 *   backend?: 'javascript'|'rust-wasm',
 *   javascriptAnalyzer?: AnalysisFunction,
 *   rustAnalyzer?: AnalysisFunction,
 *   onFallback?: (error: Error, request: AnalysisRequest) => void
 * }} [options]
 * @returns {AnalysisFunction}
 */
function createAnalysisBackend(options = {}) {
  if (options === null || typeof options !== 'object' || Array.isArray(options)) {
    throw new TypeError('options must be an object');
  }
  const backend = options.backend || JAVASCRIPT_BACKEND;
  const javascriptAnalyzer = options.javascriptAnalyzer || analyzeDocument;
  assertAnalyzer(javascriptAnalyzer, 'javascriptAnalyzer');

  if (backend === JAVASCRIPT_BACKEND) return javascriptAnalyzer;
  if (backend !== RUST_WASM_BACKEND) {
    throw new TypeError(`unsupported analysis backend: ${backend}`);
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
      return javascriptAnalyzer(request);
    }
  };
}

module.exports = {
  JAVASCRIPT_BACKEND,
  RUST_WASM_BACKEND,
  createAnalysisBackend
};
