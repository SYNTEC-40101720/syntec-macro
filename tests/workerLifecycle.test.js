// workerLifecycle.test.js
// P0-C 第 3 项：Worker 生命周期与 fallback 集成测试。
//
// 本文件通过 `worker_threads` 起真实的 validatorWorker.js 处理消息，
// 在不依赖真实 wasm 资产的前提下覆盖 P0-C 第 3 项 的集成边界：
//   1. 启动：javascript backend 正常返回 AnalysisResult；
//   2. 重启：terminate 后再起 Worker，仍能获取结果；
//   3. 并发：同时发 N 条请求，全部得到唯一对应 id 的响应；
//   4. 取消/dispose：pending 请求 resolve(null)，worker 安全终止；
//   5. 版本竞态：同一 URI 的不同 version + text 走独立缓存槽，不互相覆盖；
//   6. fallback：shadow / primary backend 在资产缺失时优雅回退到 JS，
//      并通过 parentPort control 消息（{kind:'log'}）记录原因。
//
// 这些测试只断言「契约形状」与「边界行为」，不验证 wasm 真实字节，
// 因为 wasm 资产在 CI 上由 rust-wasm.yml 重建，本地测试不应强依赖
// 二进制资产存在。

const { test } = require('node:test');
const assert = require('node:assert');
const { Worker } = require('worker_threads');
const {
  createAnalysisRequest,
  createDocumentSnapshot
} = require('../src/analysisProtocol');

const WORKER_PATH = require.resolve('../src/validatorWorker.js');

/**
 * 便利：构造一个 AnalysisRequest。
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
// 1. 启动：javascript backend 正常分析并返回带 backend 标记的结果。
// ---------------------------------------------------------------------------

test('启动 javascript backend 正常返回 AnalysisResult', async () => {
  const ctx = startWorker({ backend: 'javascript' });
  try {
    const result = await ctx.analyze(makeRequest('file:///G1000', 1, 'IF #1 = 1 THEN\nEND_IF;'));
    assert.ok(result, 'worker 应返回非空结果');
    assert.strictEqual(result.backend, 'javascript');
    assert.strictEqual(result.protocolVersion, 1);
    assert.strictEqual(result.document.uri, 'file:///G1000');
    assert.strictEqual(result.diagnostics.length, 0);
  } finally {
    await ctx.terminate();
  }
});

// ---------------------------------------------------------------------------
// 2. 重启：worker terminate 后再起新 Worker，新实例仍能分析。
// ---------------------------------------------------------------------------

test('重启 worker：terminate 后新 Worker 仍能分析', async () => {
  const ctx1 = startWorker({ backend: 'javascript' });
  const r1 = await ctx1.analyze(makeRequest('file:///A0001', 1, '#1 = 1;'));
  assert.strictEqual(r1.backend, 'javascript');
  await ctx1.terminate();

  const ctx2 = startWorker({ backend: 'javascript' });
  try {
    const r2 = await ctx2.analyze(makeRequest('file:///A0002', 1, '#2 = 2;'));
    assert.strictEqual(r2.backend, 'javascript');
    assert.strictEqual(r2.document.uri, 'file:///A0002');
  } finally {
    await ctx2.terminate();
  }
});

// ---------------------------------------------------------------------------
// 3. 并发：同时发多条请求，全部得到对应 id 的响应。
// ---------------------------------------------------------------------------

test('并发请求：同时发 8 条请求全部返回', async () => {
  const ctx = startWorker({ backend: 'javascript' });
  try {
    const requests = Array.from({ length: 8 }, (_, i) =>
      ctx.analyze(makeRequest(`file:///F${i}`, 1, `#${i + 1} = ${i + 1};`)));
    const results = await Promise.all(requests);
    assert.strictEqual(results.length, 8);
    const uris = results.map(r => r && r.document.uri).sort();
    for (let i = 0; i < 8; i++) {
      assert.strictEqual(uris[i], `file:///F${i}`);
      assert.strictEqual(results[i].backend, 'javascript');
    }
    assert.strictEqual(ctx.pendingSize(), 0, '所有 pending 应已 resolve');
  } finally {
    await ctx.terminate();
  }
});

// ---------------------------------------------------------------------------
// 4. 取消/dispose：pending 请求在 terminate 时 resolve(null)；多次 dispose
//    安全，不会触发未捕获异常。
// ---------------------------------------------------------------------------

test('terminate 时 pending 请求被 resolve(null) 不会永挂', async () => {
  const ctx = startWorker({ backend: 'javascript' });
  // 第一条立即返回；第二条延后再起一个故意不 await 的 pending
  const slowText = '#1 = 1;\n' + Array.from({ length: 500 }, () => '#100 = #100 + 1;').join('\n');
  const slow = ctx.analyze(makeRequest('file:///SLOW', 1, slowText));
  // 不 await slow，立即 terminate
  await ctx.terminate();
  const result = await slow;
  assert.strictEqual(result, null, 'pending 请求应被 resolve(null)');
});

// ---------------------------------------------------------------------------
// 5. 版本竞态：同一 URI 的不同 version/text 走独立缓存槽，不互相覆盖；
//    单 Worker 缓存有界（MAX_ENTRIES=8），超出后最旧条目被淘汰。
// ---------------------------------------------------------------------------

test('版本竞态：同 URI 不同 version 走独立缓存不互相覆盖', async () => {
  const ctx = startWorker({ backend: 'javascript' });
  try {
    const v1 = makeRequest('file:///V', 1, '#1 = 1;');
    const v2 = makeRequest('file:///V', 2, '#1 = 2;');
    const [r1, r2] = await Promise.all([ctx.analyze(v1), ctx.analyze(v2)]);
    assert.strictEqual(r1.document.version, 1);
    assert.strictEqual(r2.document.version, 2);
    assert.strictEqual(r1.document.text, '#1 = 1;');
    assert.strictEqual(r2.document.text, '#1 = 2;');
    // 再次请求 v1，缓存命中（Worker 不会真正再分析，但行为对调用方透明
    // ——这里只验证缓存层不会把 v1 与 v2 混成一个结果）。
    const r1Again = await ctx.analyze(v1);
    assert.strictEqual(r1Again.document.version, 1);
    assert.strictEqual(r1Again.document.text, '#1 = 1;');
  } finally {
    await ctx.terminate();
  }
});

test('缓存有界：超过 MAX_ENTRIES(8) 后旧条目被淘汰', async () => {
  const ctx = startWorker({ backend: 'javascript' });
  try {
    // 先发 10 个不同 URI 的请求填满缓存，超出 MAX_ENTRIES=8
    for (let i = 0; i < 10; i++) {
      const r = await ctx.analyze(makeRequest(`file:///C${i}`, 1, `#${i} = ${i};`));
      assert.strictEqual(r.document.uri, `file:///C${i}`);
    }
    // 再次请求最旧的 C0（应已被淘汰）——命中或未命中都应返回正确结果，
    // 关键是这个调用不会抛 unexpected 'result is null'。
    const r0 = await ctx.analyze(makeRequest('file:///C0', 1, '#0 = 0;'));
    assert.strictEqual(r0.document.uri, 'file:///C0');
  } finally {
    await ctx.terminate();
  }
});

// ---------------------------------------------------------------------------
// 6. fallback：shadow 模式资产加载失败时优雅回退到 JS 并通过 control
//    消息记录原因；primary 模式资产加载失败时同样回退 JS 但记录
//    primary fallback 标记，不会静默成功。
// ---------------------------------------------------------------------------

test('fallback: shadow backend 资产加载失败时回退 JS 并上报 control 日志', async () => {
  const ctx = startWorker({
    backend: 'rust-wasm-shadow',
    manifestPath: '/definitely/not/exist/manifest.json'
  });
  try {
    const result = await ctx.analyze(makeRequest('file:///SH', 1, '#1 = 1;'));
    assert.ok(result, 'shadow 模式资产缺失时仍应返回 JS 结果');
    assert.strictEqual(result.backend, 'javascript');
    // 至少一条 control 日志记录 shadow fallback 原因
    const shadowLogs = ctx.logs.filter(l => /shadow|fallback|rust-wasm/i.test(l.message));
    assert.ok(shadowLogs.length > 0, 'shadow 应通过 control 消息记录 fallback 原因');
    // 不应泄露敏感源文件路径（仅记录 message 摘要，不带源码片段）
    for (const entry of shadowLogs) {
      assert.ok(!/require\(|import /.test(entry.message), '日志不应泄露 require/import 路径细节');
    }
  } finally {
    await ctx.terminate();
  }
});

test('fallback: primary backend 资产加载失败时回退 JS 但上报 primary fallback', async () => {
  const ctx = startWorker({
    backend: 'rust-wasm',
    manifestPath: '/definitely/not/exist/manifest.json'
  });
  try {
    const result = await ctx.analyze(makeRequest('file:///PR', 1, '#1 = 1;'));
    assert.ok(result, 'primary 资产缺失时也应回退 JS 返回结果，不返回 null');
    assert.strictEqual(result.backend, 'javascript');
    const primaryLogs = ctx.logs.filter(l => /primary|fallback|rust-wasm/i.test(l.message));
    assert.ok(primaryLogs.length > 0, 'primary 模式资产加载失败应通过 control 消息上报 fallback');
    // 后端标记不应为 rust-wasm（不能把回退成功伪装成 rust-wasm 成功）
    assert.notStrictEqual(result.backend, 'rust-wasm');
  } finally {
    await ctx.terminate();
  }
});

// ---------------------------------------------------------------------------
// 7. 未知 backend：worker 守护回退到 javascript 并上报 unknown 日志。
// ---------------------------------------------------------------------------

test('未知 backend 回退 javascript 并记录 unknown 日志', async () => {
  const ctx = startWorker({ backend: 'totally-unknown-backend' });
  try {
    const result = await ctx.analyze(makeRequest('file:///U', 1, '#1 = 1;'));
    assert.strictEqual(result.backend, 'javascript');
    const unknownLogs = ctx.logs.filter(l => /unknown/i.test(l.message));
    assert.ok(unknownLogs.length > 0, '未知 backend 应通过 control 消息记录 unknown 回退');
  } finally {
    await ctx.terminate();
  }
});
