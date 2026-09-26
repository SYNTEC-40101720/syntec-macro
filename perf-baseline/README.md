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

## CI 平台性能门禁基线（`perf-baseline/ci/`，2026-09-26 起）

`rust-wasm.yml` 的「Performance regression gate」步骤把当前 run 的 perf-data 与
`perf-baseline/ci/<os>.json`（`os` = matrix 值，如 `ubuntu-latest` / `windows-latest`）
经 `compare:perf --baseline --strict` 比对：任一场景 Rust p50 或 nav batch 回归 > 10%、
或 fallback > 0，CI 直接 fail。基线文件缺失时该步骤 notice 跳过。

- 基线必须来自 **CI runner 采集**（与本机 dev 阈值混用会因平台速度差异误报）：
  从 rust-wasm run 的 `p1-perf-<os>` artifact 下载 `benchmark-<os>.json`，重命名为
  `<os>.json` 提交到 `perf-baseline/ci/`，并在文件内补 `tag` 字段标注采集 commit。
- `benchmarkCompare.js --json` 自 2026-09-26 起自带 `collectedAt`/`platform`/
  `nodeVersion` 元数据，artifact 文件可直接作基线，无需补平台字段。
- 首份 `windows-dev-machine.json` 为本机 Windows 采集的代理基线（10 iterations，
  fixture p50 10.9ms / large-20k 287.8ms / nav 60.9ms）；待 CI windows-latest
  artifact 落地后替换为 runner 实测值。
- `ubuntu-latest.json` 待首个 CI run artifact 提交后门禁即生效。
