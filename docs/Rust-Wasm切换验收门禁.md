# Rust/Wasm 切换与验收门禁

> **历史背景**: v2.15.0 ~ v3.0.0 阶段把 Rust/Wasm 引入并共存于 JS 后端; v3.1.0 切默认 backend 为 rust-wasm; v4.0.0 (2026-09-22) 收口 — JS 分析器已退役, rust-wasm 成为唯一后端. 本文档保留**永久有效的验收门禁与不变约束**, 旧 v3.0.0 阶段性叙述已删, 历史节点见 `CHANGELOG.md`.

## 1. 当前架构 (v4.0.0 起)

- **唯一分析后端**: `rust-wasm`. 后端选择配置项 `syntecMacro.analysisBackend` 已删除 (单后端无需选择), `javascript`/`rust-wasm-shadow` 已退役.
- **Wasm asset**: `assets/rust-wasm/{manifest.json, syntec_core.wasm}` 经 `scripts/buildRustWasmAsset.js` 全链校验 (manifest 形状 + 字节长度 + SHA-256 + `WebAssembly.instantiate` + 必需 exports), bundle 进 VSIX.
- **Host Provider** (completion/hover/definition/navigation/formatting/diagnostics/code-actions) 走 `src/hostRustAnalyzer.js` 同步路径; Worker (`src/validatorWorker.js`) 硬切 `rust-wasm` backend.
- **数据真源** (Phase R2 已完成 2026-09-22): `src/systemVariables.js` / `src/functions.js` / `src/codeDocs.js` / `src/keywords.js` 四表数据已迁到 `src/data/*.json`, JS 模块改 thin JSON loader (mtime-aware 进程内只读缓存); `src/completionSnippets.js` 评估为纯函数无数据真源不迁. 详见 `docs/开发交接说明.md`.

## 2. 验收门禁 (每次发布前后必跑)

```powershell
Set-Location D:\FN\syntec-macro
git --no-pager diff --check
npm.cmd run check:all        # = npm test (含全部治理 check) + lint
npm.cmd run typecheck:analysis
npm.cmd run check:release -- --tag vX.Y.Z
npm.cmd run check:release:readiness -- --strict
# —— 或发布前一键全量（readiness + governance + check:all + integration + package + smoke）:
npm.cmd run release:verify
npm.cmd run check:rust:wasm:asset
npm.cmd run check:vsix
npm.cmd run compare:rust          # 需 $env:SYNTEC_RUST_CLI 指向 CLI 二进制, 否则 --baseline fixture
npm.cmd run probe:rust:wasm
npm.cmd run benchmark:compare -- --iterations 5 --no-threshold
npm.cmd run test:integration
npm.cmd run test:integration:navigation
npm.cmd run package
npm.cmd run smoke:installed
```

## 3. 不变约束 (永久有效)

1. **Rust/Wasm 是唯一后端**: 不得引入任何 JS 分析器 fallback 路径. v4.0.0 后 `analysisCore.js` 等 12 模块已删, 重引入需经 R2 主线讨论.
2. **Wasm asset bundled 进 VSIX**: 不得把开发态 `crates/syntec-core/target/` 复制进 VSIX; 必经 `scripts/buildRustWasmAsset.js` 写 manifest + SHA-256 + exports 子集断言.
3. **数据真源单一登记**: MACRO 规则的状态只在 `docs/MACRO能力矩阵.md` 登记一次; 诊断 code ↔ 能力 ID 交叉引用在 `docs/Rust诊断parity清单.md`.
4. **不泛化运行时现象**: LTP/机器人/Modbus 跨行状态与运行时差异继续只记录证据不静态强制 (证据原文可从 Confluence SYNTech 手册查询).
5. **测试集守卫**: `tests/workerLifecycle.test.js` / `tests/rustWasmAsset.test.js` / `tests/rustWasmWorkerAdapter.test.js` 等是 fallback / ABI 守卫, 不得删除.

## 4. check:release:readiness -- --strict 7 项门禁

每次发版必须全 PASS (item 7 SKIP 由 release workflow 跑完后再核).

| # | 门禁 | 说明 |
| --- | ------ | ------ |
| 1 | Rust/Wasm 完整 `AnalysisResult` parity | `compare:rust` 测 |
| 2 | 稳定诊断 + navigation + format parity (68/68) | `compare:rust` 测 |
| 3 | 生产 Wasm 资产 + 加载器 + Worker + fallback | `check:rust:wasm:asset` + `workerLifecycle.test.js` |
| 4 | 跨平台 CI 构建矩阵 (Ubuntu + Windows) | `.github/workflows/rust-wasm.yml` |
| 5 | 真实性能 / 内存 / 启动 / fallback 数据采集 | `perf-data/` 落地 + `benchmark:compare` |
| 6 | VSIX + 集成 + 回滚测试 | `check:vsix` + `test:integration` + `smoke:installed` |
| 7 | GitHub tag / Release / VSIX 校验值一致 | SKIP (tag 选定后由 release workflow 跑) |

## 5. 文档入口

- 主线索引 (每次新会话先读): `docs/开发交接说明.md`
- 发布 Runbook: `docs/Release-Runbook.md`
- Rust 诊断 parity 清单: `docs/Rust诊断parity清单.md`
- MACRO 能力矩阵: `docs/MACRO能力矩阵.md`
- 语法与诊断手册: `docs/新代MACRO语法规范手册.md` / `docs/诊断规则与修复动作.md`
