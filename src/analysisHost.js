// @ts-check
// 有界的纯分析快照缓存：为增量分析和未来 Rust 后端保留稳定的 Host 边界。

const { createAnalysisBackend } = require('./analysisBackend');

const DEFAULT_MAX_ENTRIES = 8;

/**
 * @typedef {import('./analysisProtocol').AnalysisRequest} AnalysisRequest
 * @typedef {import('./analysisProtocol').AnalysisResult} AnalysisResult
 * @typedef {(request: AnalysisRequest) => AnalysisResult} AnalysisFunction
 */

/**
 * @param {AnalysisRequest} request
 * @returns {string}
 */
function getAnalysisCacheKey(request) {
  const document = request.document;
  return [
    request.protocolVersion,
    request.profile,
    document.uri,
    document.version,
    document.text
  ].join('\u0000');
}

class AnalysisHost {
  /**
   * @param {object} [options]
   * @param {number} [options.maxEntries]
   * @param {AnalysisFunction} [options.analyzer]
   * @param {'rust-wasm'} [options.backend] R1.2 Stage B 后唯一支持.
   * @param {AnalysisFunction} [options.rustAnalyzer]
   * @param {(error: Error, request: AnalysisRequest) => void} [options.onFallback]
   */
  constructor(options = {}) {
    const maxEntries = options.maxEntries === undefined
      ? DEFAULT_MAX_ENTRIES
      : options.maxEntries;
    if (!Number.isInteger(maxEntries) || maxEntries <= 0) {
      throw new TypeError('maxEntries must be a positive integer');
    }
    this.maxEntries = maxEntries;
    this.analyzer = options.analyzer || createAnalysisBackend({
      backend: options.backend,
      rustAnalyzer: options.rustAnalyzer,
      onFallback: options.onFallback
    });
    this.cache = new Map();
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * @param {AnalysisRequest} request
   * @returns {AnalysisResult}
   */
  analyze(request) {
    const key = getAnalysisCacheKey(request);
    const cached = this.cache.get(key);
    if (cached) {
      this.cache.delete(key);
      this.cache.set(key, cached);
      this.hits++;
      return cached;
    }

    const result = this.analyzer(request);
    this.cache.set(key, result);
    this.misses++;
    while (this.cache.size > this.maxEntries) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }
    return result;
  }

  /**
   * @param {string} [uri]
   */
  invalidate(uri) {
    if (uri === undefined) {
      this.cache.clear();
      return;
    }
    for (const key of this.cache.keys()) {
      if (key.includes(`\u0000${uri}\u0000`)) this.cache.delete(key);
    }
  }

  clear() {
    this.cache.clear();
  }

  /**
   * @returns {{size: number, hits: number, misses: number}}
   */
  getStats() {
    return {
      size: this.cache.size,
      hits: this.hits,
      misses: this.misses
    };
  }
}

module.exports = {
  AnalysisHost,
  DEFAULT_MAX_ENTRIES,
  getAnalysisCacheKey
};
