// validatorWorker.js
// Worker 线程入口：在独立线程中执行分析后端，避免阻塞 Extension Host
//
// R1.2 Stage B (2026-09-22): 后端仅剩下 `rust-wasm`; javascript / rust-wasm-shadow /
// 未知 backend 分支已删除. JS analyzeDocument / shadow dual-run 路径随
// analysisCore.js §2.12 git rm 一并失效. 资产加载失败 → 抛错并上报 control 日志,
// Extension Host 决定如何提示用户.

const { parentPort, workerData } = require('worker_threads');
const { AnalysisHost } = require('./analysisHost');
const {
  createRustWasmWorkerAdapter
} = require('./rustWasmWorkerAdapter');

const DEFAULT_BACKEND = 'rust-wasm';

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

if (backendName !== 'rust-wasm') {
  shadowLog(`[rust-wasm] unknown backend "${backendName}", 退化为 ${DEFAULT_BACKEND}`);
}

let pendingPromise = null;
analyzer = async (request) => {
  if (!pendingPromise) {
    pendingPromise = createRustWasmWorkerAdapter({
      manifestPath: workerData && workerData.manifestPath,
      onFallback: (reason, error) => {
        shadowLog(`[rust-wasm] fallback: ${reason} ${error.message}`);
      }
    });
  }
  try {
    const adapter = await pendingPromise;
    return adapter(request);
  } catch (err) {
    // Rust/Wasm 启动失败 → 抛错, Extension Host 通过 control 日志决定 UI
    // (banner 提示重装/扩展损坏). 不再回退 JS 实体.
    shadowLog(`[rust-wasm] 启动失败: ${err instanceof Error ? err.message : err}`);
    throw err;
  }
};

const analysisHost = new AnalysisHost({ analyzer: request => analyzer(request) });

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
