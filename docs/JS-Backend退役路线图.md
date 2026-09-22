# JS Backend 退役路线图

> **当前状态**: ✅ Phase R1 + R3 已完成并发布 v4.0.0 (2026-09-22). 12 个 JS 分析器模块已从仓库删除, `syntecMacro.analysisBackend` enum 收敛为 `['rust-wasm']` 单值, host provider 全部走 `hostRustAnalyzer` 同步路径, CI `release.yml` 跑通自动打包 + 上传 VSIX. 本文档保留作回滚参考与 R2 接续指引.

## 已完成 (历史简述)

- **Phase R1.1 准入自检** ✅ 6 PASS / 0 SKIP / 0 FAIL. `scripts/checkJsBackendRetirement.js --strict` 守卫.
- **Phase R1.2 Stage B** ✅ commit `02ae430`. 删除 12 个 JS 模块: `analysisCore`/`lexer`/`validator`/`robotValidator`/`controlFlowValidator`/`functionArgumentValidator`/`diagnosticRules`/`diagnosticFactory`/`formatter`/`navigationSymbols`/`navigationIndex`/`statementClassifier`. 净减 ~4218 行. 实施细则保留在 `docs/R1.2-实施方案.md` 中, 仅作 Rollback 参考.
- **Phase R3 release 流程** ✅ commit `ff90f8b` (v4.0.0 切版) + `886891a` (release flow open). tag `v4.0.0` 触发 CI `release.yml` 主路径自动打包 + 上传 VSIX. 本地脚本 `scripts/createGitHubRelease.js` 仍是域控离线备路径, agent 不主动走.
- **Phase 5.3 dead code 路径 A** ✅ 三项 `*_Q_RANGE` dead code + 对应 code action 两端共同剔除.

## 后续待启

### R1.3 — VSIX 体积与启动基线刷新 (低优先, 不阻塞)

Stage B 后 VSIX 从 246275B 降到 240510B. 只需采集 `perf-baseline/v4.0.0.json` 作退役后节点基线供后续回归对照. `perf-baseline/README.md` 记录采集规则.

### Phase R2 — 数据表迁移至 host 共享层 (可选, 不阻塞)

**目标**: 把 hover/completion 数据表从 5 个 JS 数据真源迁到独立 JSON 文件, host Provider 层从 JSON 读不再依赖 JS 表, 让 host 与 Rust 共享同一数据 schema.

| 数据表 | 行数 (估) | 迁移目标 |
|---|---|---|
| `src/keywords.js` (gcodes/mcodes) | 384 | `src/data/gcodes.json` |
| `src/functions.js` | 97 | `src/data/functions.json` |
| `src/codeDocs.js` (hoverDocs) | 260 | `src/data/hoverDocs.json` |
| `src/systemVariables.js` | 48 | `src/data/systemVariables.json` |
| `src/completionSnippets.js` | 26 | `src/data/snippets.json` (已支持) |

> `src/statementClassifier.js` 已在 R1.2 Stage B 删除, 其候选 Rust 实现 `classify_statement_for_formatter` 在 Rust 端存在, 不再迁.

**验收**:
- `tests/hoverProvider.test.js` / `tests/completionProvider.test.js` 全 PASS.
- JSON 数据接口在 host 层包装为只读缓存.
- 本路线图标 R2 完成.

## 不变约束 (保留作 R2 实施准则)

1. 不得修改 `assets/rust-wasm/` 内容时跳过 `scripts/buildRustWasmAsset.js` 全链校验.
2. host-only Provider 层与数据真源在 R2 完成后仍保留作 host 层入口.
3. 不得删除 `tests/workerLifecycle.test.js` / `tests/rustWasmAsset.test.js` / `tests/rustWasmWorkerAdapter.test.js` (fallback / ABI 守卫).
4. 不在没采集 `perf-baseline/v4.0.0.json` 前声称 R1.3 完成.

## 入口

- 主索引: `docs/迭代优化计划.md` §「后续计划 (v4.x+)」
- 实施回滚参考: `docs/R1.2-实施方案.md`
- 准入审计工具: `npm run audit:js-backend`
- 准入自检工具: `npm run check:js-backend-retirement -- --strict`
- 发布 Runbook: `docs/3.x-Release-Runbook.md`