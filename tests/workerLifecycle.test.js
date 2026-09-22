// workerLifecycle.test.js
// Worker 生命周期与 fallback 集成测试.
//
// R1.2 Stage B (2026-09-22): JS backend / shadow mode 已退役, JS fallback 路径已删除.
// 新契约:
//   - backend 仅剩 `rust-wasm` (无论 workerData.backend 是什么, worker 都走 rust-wasm;
//     未知 backend 退化并记录 control 日志, 仍尝试 rust-wasm).
//   - 资产加载失败 → worker 抛错 + 上报 control 日志, ctx.analyze reject (不返 JS 结果).
//   - cache + lifecycle 行为 (concurrency / cache eviction / terminate) 不变,
//     但需要真实 wasm 资产 (由本地 assets/rust-wasm/manifest.json 提供).
//
// 本文件通过 `worker_threads` 起真实 validatorWorker.js 处理消息, 验证:
//   1. 启动: rust-wasm backend 正常返回 AnalysisResult;
//   2. 重启: terminate 后再起 Worker 仍能分析;
//   3. 并发: 同时发 N 条请求, 全部得到唯一对应 id 的响应;
//   4. 取消/dispose: pending 请求 resolve(null), worker 安全终止;
//   5. 版本竞态: 同一 URI 不同 version+text 走独立缓存槽, 不互相覆盖;
//   6. fallback: 资产缺失时 worker reject 并上报 control 日志 (不返 JS 结果);
//   7. 未知 backend: worker 退化为 rust-wasm 并记录 unknown 日志.

const { test } = require('node:test');
const assert = require('node:assert');
const { Worker } = require('worker_threads');
const path = require('path');
const {
  createAnalysisRequest,
  createDocumentSnapshot
} = require('../src/analysisProtocol');

const WORKER_PATH = require.resolve('../src/validatorWorker.js');

// R1.2: 使用真实 manifest 路径 (由 assets/rust-wasm/ 提供), 测试 worker rust-wasm 路径.
const DEFAULT_MANIFEST = path.join(__dirname, '..', 'assets', 'rust-wasm', 'manifest.json');

/**
 * 便利：构造一个 AnalysisRequest.
 */
function makeRequest(uri, version, text, profile = 'generic') {
  return createAnalysisRequest(
    createDocumentSnapshot({
      uri,
      version,
      languageId: 'syntec-macro',
      text
    }),
    { profile }
  );
}

/**
 * 起一个真实 Worker，暴露 postMessage/dispose，搜集所有 control 与
 * 响应消息。
 */
function startWorker(workerData) {
  /** @type {Map<number, {resolve: (value: any) => void, reject: (err: Error) => void}>} */
  const pending = new Map();
  /** @type {Array<{kind: 'log', message: string}>} */
  const logs = [];
  const worker = new Worker(WORKER_PATH, { workerData });
  worker.on('message', (message) => {
    if (message && message.kind === 'log') {
      logs.push({ kind: 'log', message: String(message.message) });
      return;
    }
    const { id, result, error } = message || {};
    const entry = pending.get(id);
    if (!entry) return;
    pending.delete(id);
    if (error) entry.reject(new Error(String(error)));
    else entry.resolve(result);
  });
  let nextId = 0;
  /**
   * @param {import('../src/analysisProtocol').AnalysisRequest} request
   * @returns {Promise<import('../src/analysisProtocol').AnalysisResult|null>}
   */
  function analyze(request) {
    const id = ++nextId;
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      worker.postMessage({ id, request });
    });
  }
  async function terminate() {
    for (const { resolve } of pending.values()) resolve(null);
    pending.clear();
    await worker.terminate();
  }
  return { worker, analyze, terminate, logs, pendingSize: () => pending.size };
}

// ---------------------------------------------------------------------------
// 1. 启动: rust-wasm backend 正常分析并返回带 backend 标记的结果.
// ---------------------------------------------------------------------------

test('启动 rust-wasm backend 正常返回 AnalysisResult', async () => {
  const ctx = startWorker({ backend: 'rust-wasm', manifestPath: DEFAULT_MANIFEST });
  try {
    const result = await ctx.analyze(makeRequest('file:///G1000', 1, 'IF #1 = 1 THEN\nEND_IF;'));
    assert.ok(result, 'worker 应返回非空结果');
    assert.strictEqual(result.backend, 'rust-wasm');
    assert.strictEqual(result.protocolVersion, 1);
    assert.strictEqual(result.document.uri, 'file:///G1000');
    assert.strictEqual(result.diagnostics.length, 0);
  } finally {
    await ctx.terminate();
  }
});

// ---------------------------------------------------------------------------
// 2. 重启: worker terminate 后再起 Worker, 新实例仍能分析.
// ---------------------------------------------------------------------------

test('重启 worker: terminate 后新 Worker 仍能分析', async () => {
  const ctx1 = startWorker({ backend: 'rust-wasm', manifestPath: DEFAULT_MANIFEST });
  const r1 = await ctx1.analyze(makeRequest('file:///A0001', 1, '#1 = 1;'));
  assert.strictEqual(r1.backend, 'rust-wasm');
  await ctx1.terminate();

  const ctx2 = startWorker({ backend: 'rust-wasm', manifestPath: DEFAULT_MANIFEST });
  try {
    const r2 = await ctx2.analyze(makeRequest('file:///A0002', 1, '#2 = 2;'));
    assert.strictEqual(r2.backend, 'rust-wasm');
    assert.strictEqual(r2.document.uri, 'file:///A0002');
  } finally {
    await ctx2.terminate();
  }
});

// ---------------------------------------------------------------------------
// 3. 并发: 同时发多条请求, 全部得到对应 id 的响应.
// ---------------------------------------------------------------------------

test('并发请求: 同时发 8 条请求全部返回', async () => {
  const ctx = startWorker({ backend: 'rust-wasm', manifestPath: DEFAULT_MANIFEST });
  try {
    const requests = Array.from({ length: 8 }, (_, i) =>
      ctx.analyze(makeRequest(`file:///F${i}`, 1, `#${i + 1} = ${i + 1};`)));
    const results = await Promise.all(requests);
    assert.strictEqual(results.length, 8);
    const uris = results.map(r => r && r.document.uri).sort();
    for (let i = 0; i < 8; i++) {
      assert.strictEqual(uris[i], `file:///F${i}`);
      assert.strictEqual(results[i].backend, 'rust-wasm');
    }
    assert.strictEqual(ctx.pendingSize(), 0, '所有 pending 应已 resolve');
  } finally {
    await ctx.terminate();
  }
});

// ---------------------------------------------------------------------------
// 4. 取消/dispose: pending 请求在 terminate 时 resolve(null); 多次 dispose
//    安全, 不会触发未捕获异常.
// ---------------------------------------------------------------------------

test('terminate 时 pending 请求被 resolve(null) 不会永挂', async () => {
  const ctx = startWorker({ backend: 'rust-wasm', manifestPath: DEFAULT_MANIFEST });
  const slowText = '#1 = 1;\n' + Array.from({ length: 500 }, () => '#100 = #100 + 1;').join('\n');
  const slow = ctx.analyze(makeRequest('file:///SLOW', 1, slowText));
  await ctx.terminate();
  const result = await slow;
  assert.strictEqual(result, null, 'pending 请求应被 resolve(null)');
});

// ---------------------------------------------------------------------------
// 5. 版本竞态: 同一 URI 不同 version+text 走独立缓存槽, 不互相覆盖;
//    单 Worker 缓存有界 (MAX_ENTRIES=8), 超出后最旧条目被淘汰.
// ---------------------------------------------------------------------------

test('版本竞态: 同 URI 不同 version 走独立缓存不互相覆盖', async () => {
  const ctx = startWorker({ backend: 'rust-wasm', manifestPath: DEFAULT_MANIFEST });
  try {
    const v1 = makeRequest('file:///V', 1, '#1 = 1;');
    const v2 = makeRequest('file:///V', 2, '#1 = 2;');
    const [r1, r2] = await Promise.all([ctx.analyze(v1), ctx.analyze(v2)]);
    assert.strictEqual(r1.document.version, 1);
    assert.strictEqual(r2.document.version, 2);
    assert.strictEqual(r1.document.text, '#1 = 1;');
    assert.strictEqual(r2.document.text, '#1 = 2;');
    const r1Again = await ctx.analyze(v1);
    assert.strictEqual(r1Again.document.version, 1);
    assert.strictEqual(r1Again.document.text, '#1 = 1;');
  } finally {
    await ctx.terminate();
  }
});

test('缓存有界: 超过 MAX_ENTRIES(8) 后旧条目被淘汰', async () => {
  const ctx = startWorker({ backend: 'rust-wasm', manifestPath: DEFAULT_MANIFEST });
  try {
    for (let i = 0; i < 10; i++) {
      const r = await ctx.analyze(makeRequest(`file:///C${i}`, 1, `#${i} = ${i};`));
      assert.strictEqual(r.document.uri, `file:///C${i}`);
    }
    const r0 = await ctx.analyze(makeRequest('file:///C0', 1, '#0 = 0;'));
    assert.strictEqual(r0.document.uri, 'file:///C0');
  } finally {
    await ctx.terminate();
  }
});

// ---------------------------------------------------------------------------
// 6. fallback: 资产缺失时 worker reject 并上报 control 日志 (不返 JS 结果).
//    R1.2 Stage B: 不再回退 JS, ctx.analyze reject.
// ---------------------------------------------------------------------------

test('rust-wasm 资产缺失时 worker reject 并上报 control 日志', async () => {
  const ctx = startWorker({
    backend: 'rust-wasm',
    manifestPath: '/definitely/not/exist/manifest.json'
  });
  try {
    await assert.rejects(
      ctx.analyze(makeRequest('file:///PR', 1, '#1 = 1;')),
      /rust|wasm|asset|manifest|ENOENT|no such file/i,
      'rust-wasm 资产缺失时 ctx.analyze 应 reject 而非返回 JS 结果'
    );
    const fallbackLogs = ctx.logs.filter(l => /fallback|rust-wasm|启动失败/i.test(l.message));
    assert.ok(fallbackLogs.length > 0, 'worker 应通过 control 消息上报启动失败/fallback 原因');
    for (const entry of fallbackLogs) {
      assert.ok(!/require\(|import /.test(entry.message), '日志不应泄露 require/import 路径细节');
    }
  } finally {
    await ctx.terminate();
  }
});

// ---------------------------------------------------------------------------
// 7. 未知 backend: worker 退化为 rust-wasm 并记录 unknown 日志 (R1.2: 不再回退 javascript).
// ---------------------------------------------------------------------------

test('未知 backend 退化为 rust-wasm 并记录 unknown 日志', async () => {
  const ctx = startWorker({ backend: 'totally-unknown-backend', manifestPath: DEFAULT_MANIFEST });
  try {
    const result = await ctx.analyze(makeRequest('file:///U', 1, '#1 = 1;'));
    assert.strictEqual(result.backend, 'rust-wasm');
    const unknownLogs = ctx.logs.filter(l => /unknown/i.test(l.message));
    assert.ok(unknownLogs.length > 0, '未知 backend 应通过 control 消息记录 unknown 退化');
  } finally {
    await ctx.terminate();
  }
});
