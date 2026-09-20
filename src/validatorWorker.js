// validatorWorker.js
// Worker 线程入口：在独立线程中执行分析后端，避免阻塞 Extension Host
//
// P0-C 第 2 项：支持 backend 选择（默认 `javascript`）与 shadow 模式
// （`rust-wasm-shadow`）双跑 JS/Rust 并记录差分，不影响最终用户诊断；
// primary 模式由后端切换门禁（P0-C 第 3 项）开启。

const { parentPort, workerData } = require('worker_threads');
const { AnalysisHost } = require('./analysisHost');
const { analyzeDocument } = require('./analysisCore');
const {
  createRustWasmWorkerAdapter
} = require('./rustWasmWorkerAdapter');
const { createAnalysisBackend } = require('./analysisBackend');

const DEFAULT_BACKEND = 'javascript';

const backendName = (workerData && workerData.backend) ||
  process.env.SYNTEC_WORKER_BACKEND ||
  DEFAULT_BACKEND;

const shadowLog = (message) => {
  // Worker 端日志通过 parentPort 的 control 消息上报，避免
  // console 在 Extension Host 不可见；失败 silent 不影响诊断。
  try {
    parentPort && parentPort.postMessage({ kind: 'log', message });
  } catch (err) {
    // parentPort 可能已断开；忽略。
    void err;
  }
};

if (backendName === 'javascript') {
  analyzer = createAnalysisBackend({
    backend: 'javascript',
    javascriptAnalyzer: analyzeDocument
  });
} else if (backendName === 'rust-wasm-shadow') {
  // shadow 模式异步初始化；初始化期间所有请求回退 JS。
  let pendingPromise = null;
  /**
   * @param {import('./analysisProtocol').AnalysisRequest} request
   */
  const compute = async (request) => {
    if (!pendingPromise) {
      pendingPromise = createRustWasmWorkerAdapter({
        manifestPath: workerData && workerData.manifestPath,
        shadow: { mode: 'shadow', log: shadowLog },
        onFallback: (reason, error) => {
          shadowLog(`[rust-wasm] fallback: ${reason} ${error.message}`);
        },
        onShadowMismatch: ({ rustResult, javascriptResult }) => {
          shadowLog(`[rust-wasm] shadow mismatch: rust=${rustResult.diagnostics.length} js=${javascriptResult.diagnostics.length}`);
        }
      });
    }
    // 第一次阴影初始化未完成走 JS；完成后上 shadow。
    try {
      const adapter = await pendingPromise;
      return adapter(request);
    } catch (err) {
      // 资产加载失败：本 worker 接下来都走 JS。错误由 shadowLog 记录。
      shadowLog(`[rust-wasm] shadow 初始化失败，回退 JS：${err instanceof Error ? err.message : err}`);
      return analyzeDocument(request);
    }
  };
  analyzer = compute;
} else if (backendName === 'rust-wasm') {
  // primary 模式：Rust 为主，失败由 createAnalysisBackend 显式回退 JS。
  let pendingPromise = null;
  analyzer = async (request) => {
    if (!pendingPromise) {
      pendingPromise = createRustWasmWorkerAdapter({
        manifestPath: workerData && workerData.manifestPath,
        onFallback: (reason, error) => {
          shadowLog(`[rust-wasm] primary fallback: ${reason} ${error.message}`);
        }
      });
    }
    try {
      const adapter = await pendingPromise;
      return adapter(request);
    } catch (err) {
      // primary 启动失败：上层没有 try/catch；这里回退 JS 并通过
      // parentPort control 上报，由 Extension Host 决定是否切换 backend。
      shadowLog(`[rust-wasm] primary 启动失败，回退 JS：${err instanceof Error ? err.message : err}`);
      return analyzeDocument(request);
    }
  };
} else {
  shadowLog(`[rust-wasm] unknown backend "${backendName}"，回退 javascript`);
  analyzer = createAnalysisBackend({
    backend: 'javascript',
    javascriptAnalyzer: analyzeDocument
  });
}

const analysisHost = new AnalysisHost();

// 分析缓存：按 protocolVersion+profile+uri+version+text 精确缓存
// async analyzer 的结果。命中返回缓存的 Promise 避免重复实例化 wasm。
const cache = new Map();
const MAX_ENTRIES = 8;

function cacheKey(request) {
  return [
    request.protocolVersion,
    request.profile,
    request.document.uri,
    request.document.version,
    request.document.text
  ].join('\u0000');
}

parentPort.on('message', ({ id, request }) => {
  const key = cacheKey(request);
  if (cache.has(key)) {
    const cached = cache.get(key);
    cached.then(
      result => parentPort.postMessage({ id, result }),
      err => parentPort.postMessage({ id, error: err instanceof Error ? err.message : String(err) })
    );
    return;
  }
  const promise = Promise.resolve().then(() => analyzer(request));
  cache.set(key, promise);
  while (cache.size > MAX_ENTRIES) {
    const oldestKey = cache.keys().next().value;
    cache.delete(oldestKey);
  }
  promise.then(
    result => parentPort.postMessage({ id, result }),
    err => parentPort.postMessage({ id, error: err instanceof Error ? err.message : String(err) })
  );
});

module.exports = { analysisHost, backendName, cache };
