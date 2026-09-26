// validatorWorker.js
// Worker 线程入口：在独立线程中执行 Rust/Wasm 分析，避免阻塞 Extension Host
//
// R1.2 Stage B (2026-09-22): 后端仅剩 `rust-wasm`. JS analyzeDocument / shadow
// dual-run 路径已删除. 资产加载失败 → 抛错并上报 control 日志,
// Extension Host 决定如何提示用户.

const { parentPort, workerData } = require('worker_threads');
const {
  createRustWasmWorkerAdapter
} = require('./rustWasmWorkerAdapter');

const workerLog = (message) => {
  // Worker 端日志通过 parentPort 的 control 消息上报，避免
  // console 在 Extension Host 不可见；失败 silent 不影响诊断。
  try {
    parentPort && parentPort.postMessage({ kind: 'log', message });
  } catch (err) {
    // parentPort 可能已断开；忽略。
    void err;
  }
};

let pendingPromise = null;
const analyzer = async (request) => {
  if (!pendingPromise) {
    pendingPromise = createRustWasmWorkerAdapter({
      manifestPath: workerData && workerData.manifestPath,
      onFallback: (reason, error) => {
        workerLog(`[rust-wasm] fallback: ${reason} ${error.message}`);
      }
    });
  }
  try {
    const adapter = await pendingPromise;
    return adapter(request);
  } catch (err) {
    // Rust/Wasm 启动失败 → 抛错, Extension Host 通过 control 日志决定 UI
    // (banner 提示重装/扩展损坏). 不再回退 JS 实体.
    workerLog(`[rust-wasm] 启动失败: ${err instanceof Error ? err.message : err}`);
    throw err;
  }
};

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
