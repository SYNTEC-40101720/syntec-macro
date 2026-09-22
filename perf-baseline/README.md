# perf-baseline

性能基线版本归档：把已发布版本节点的 `npm.cmd run benchmark:compare -- --iterations 10 --no-threshold --json` 输出 + 元数据（tag/platform/nodeVersion/gitCommit/wasmArtifact sha256）作为后续 Phase 1.2 / Phase 2.4 `comparePerfData.js --baseline` 比对的「基线」。

## 用途

- **Phase 1.1**：每个已发布版本（v3.0.0、v3.1.0、...）的 baseline 一次写入不再滚动改写。
- **Phase 1.2 + 2.4**：`scripts/comparePerfData.js` 扩展 `--baseline <file>` 模式，把当前采集结果与 baseline 比对，任一场景 Rust p50 回归 > 10% 在 actions log 打 `::warning::`（不阻塞 CI）。
- **决策门**（Phase 1.5）：切默认 backend 前用至少 ≥5 次稳定采集 + CI Linux + CI Windows 双平台对照，证明 Rust 全场景 ≥ JS（误差 ≤ 5%）才可推进 `package.json.syntecMacro.analysisBackend` 默认值切到 `rust-wasm`。

## 文件规则

- 文件名：`v<X.Y.Z>.json`（与 git tag 同步，已发布版本节点不可改）
- 顶部 `tag`/`collectedAt`/`platform`/`gitCommit` 必须与发布元数据一致
- 单文件含全部三场景（fixture / large-20k / nav-500-files）的 JS 与 Rust p50/p95/max + parity + fallback + regressions

## 已有 baseline

- `v3.0.0.json` — 2026-09-20 dev machine (Windows) 单次 10 iterations 采集：fixture JS p50 9.84ms / Rust p50 10.77ms parity=equal；large-20k JS p50 383.6ms / Rust p50 278ms parity=equal；nav-500-files JS batch 396ms / Rust batch 379ms parity=equal；fallback 0/0;样本量不足（仅 1 次），不可切换默认 backend。
- `v4.0.0.json` — 2026-09-22 dev machine (Windows) 10 iterations 采集，**R1.3 baseline**：v4.0.0 R1.2 Stage B 退役 JS analyzer 后 benchmark 输出 `parity=rust-only`，JS 字段全 0；Rust p50 fixture 12.84ms / large-20k 370.12ms / nav-500-files 109.77ms；wasm 320312 B / SHA-256 `b60d854c...`；fallback 0/0；作 v4.x+ 后续回归对照（Phase R2 数据表迁移后若 p50 偏移 > 10% 视为回归）。

## 后续采集清单

- dev machine (Windows) ≥5 次稳定采集 → 整合到下一份 `v3.0.x-multi-run.json`
- CI Linux + CI Windows `p1-perf-ubuntu-latest.json` / `p1-perf-windows-latest.json`，从 `actions/upload-artifact@v4` 下载
- 切换默认 backend 前所有数据证明 Rust 全场景 ≥ JS（误差 ≤ 5%）才推进下一 minor release
