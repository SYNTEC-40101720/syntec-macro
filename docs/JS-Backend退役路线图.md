# JS Backend 退役路线图（v3.x → v4.0）

> **目标**: 把 JavaScript analyzer 函数式核心（13 个模块，~3261 行 / ~102 KB）从 VSIX 中剔除，仅保留 Rust/Wasm 作为生产 backend + host-only Provider 层 + 数据真源表。落地后插件更精简、单一后端可维护、wasm 资产成为唯一分析路径。
>
> **生成时现态**: v3.0.0 已发布；Rust 稳定诊断 parity 67/67，含新增 L1802 静音版本门控（68 total）；wasm 资产 318040 bytes 已含全部 Rust 路径；默认 backend 仍是 `javascript`（large-20k 当时 8.3% 微回归，dev 5 次 dev 采集后已是 Rust 领先 26%，但 CI 双平台数据未累积）。
>
> **本路线图是逐步推进计划**，非 v4.0 发布前必须全收的工作清单。每批独立验收可独立合并。

## 不变前提（必须先达）

下列任一未达，本路线图任何步骤均不得推进：

1. **Phase 1.5 切默认 backend 为 `rust-wasm` 并发 v3.1.0 上线运行 ≥1 release cycle（v3.2.x）**
   - 验收：CI 双平台 ≥5 次稳定采集，Rust 全场景 p50/p95 与 JS 同量级（误差 ≤5%），fallback 比例持续 0%。
2. **Phase 5.x 跨行状态完整 parity**
   - `dead code` 三项（`SYNTEC_ROBOT_SWAITSIG_Q_RANGE` / `SYNCOUT_Q_RANGE` / `SKIPCOND_Q_RANGE`）按 Phase 5.3 决策：要么 JS 补 emit + Rust 跟迁，要么两端共同剔除 code 与 code action。
   - 详细决策表见下方 **Phase 5.3 — Dead code 三项决策**。
3. **Rust 端 emit 与 JS 端 emit 行为完全等价**
   - `compare:rust` 与 `compare:perf` 持续全等价。
   - `workerLifecycle.test.js` 9 项 worker_threads 集成测试 + `rustWasmWorkerAdapter.test.js` 9 项 shadow/primary 集成在 ≥1 个 release cycle 中无新增 FAIL。

## Phase 5.3 — Dead code 三项决策（agent 不擅自执行）

> 三项 `SYNTEC_ROBOT_*_Q_RANGE` dead code 当前两端共同不 emit；`src/robotValidator.js` 中 `addStaticSignalQRangeDiagnostic` 实际 emit 用的是 `ROBOT_STATIC_ARG_RANGE`（同一 code 复用覆盖 SKIPCOND/SWAITSIG/SYNCOUT 三个 command 的 Q range 警报），三项独立 code 是历史遗留没接 emit 入口。

### 当前状态审计（2026-09-21 surface audit）

| code | JS `diagnosticCodes.js` | JS `diagnosticActions.js` | JS 实际 emit 入口 | Rust `lib.rs` literal |
|---|:---:|:---:|:---:|:---:|
| `SYNTEC_ROBOT_SKIPCOND_Q_RANGE` | ✅（key 注册）| ✅（code action title/message）| ❌（emit 用了 `ROBOT_STATIC_ARG_RANGE`）| ❌ |
| `SYNTEC_ROBOT_SWAITSIG_Q_RANGE` | ✅ | ✅ | ❌（同上）| ❌ |
| `SYNTEC_ROBOT_SYNCOUT_Q_RANGE` | ✅ | ✅ | ❌（同上）| ❌ |

### 决策路径

**路径 A：两端共同剔除（推荐，工作量小）**

JS 行为不变、Rust 已不 emit —— 直接剔除三项保留但未启用的 code，避免未启用的 dead code 让前端 hover/code action 引到"幽灵"消息。

1. `src/diagnosticCodes.js` 删除 `ROBOT_SKIPCOND_Q_RANGE` / `SWAITSIG_Q_RANGE` / `SYNCOUT_Q_RANGE` 三项 key。
2. `src/diagnosticActions.js` 删除对应三项 code action（标题/消息属占位数据，没有诊断引用）。
3. `scripts/compareRustCore.js` 在 dead code 三项剔除后，如 baseline 中有引用则需同步删；当前 baseline 中三项均无对照样例无需动。
4. `tests/checkReleaseReadiness.test.js` 第 2 项硬正则放宽策略允许 ≥67/6X，本节已 PASS。
5. Rust 端：删除（本就无 literal，无需动）。
6. CHANGELOG `[Unreleased] ### Changed` 追加：「移除三项未启用的 `ROBOT_*_Q_RANGE` dead code 与对应 code action；既有诊断行为不变（`ROBOT_STATIC_ARG_RANGE` 覆盖三 command 的 Q range 警报）」。

**路径 B：两端共同补 emit（工作量大，需 CF/CNC B 级证据）**

把三项 dead code 真正接入 emit 入口、分 command 输出独立 message。需要 CF/CNC 证据确认 SKIPCOND/SWAITSIG/SYNCOUT 各自的 Q range 编码语义在控制器报警中的独立编号是否真存在。

1. user 跑 `docs/macro-knowledge/Phase5-控制器证据采集清单.md` §C 表 ROB-LTP-01..08 复核；尤其确认 RBT-127 / RBT-124 / RBT-115 / RBT-116 是否真对应这三个独立 code。
2. JS 端 `validateStaticArgumentRanges` 拆分：SKIPCOND/SWAITSIG/SYNCOUT 各自不再走 `ROBOT_STATIC_ARG_RANGE` 而走各自的 `*_Q_RANGE`。
3. Rust 端 `validate_static_argument_ranges` 跟迁 emit code string。
4. compareRustCore.js 增 ≥3 项对照样例（SKIPCOND/SWAITSIG/SYNCOUT 各一）覆盖 R bit 模式触发与 R 不在 0~65535 范围触发。
5. CHANGELOG `[Unreleased] ### Added` 追加：「JS+Rust emit 三项独立 `*_Q_RANGE` code；既有 `ROBOT_STATIC_ARG_RANGE` 在三 command 上的 Q range 复用让位给独立 code」。

### 决策门槛

- **路径 A 默认**：剔除不需要外部证据，agent 可独立落地（在 R1.1 PASS 之后随 PR 一并落地，不阻塞整批 R1.2）。
- **路径 B 需 B 级证据**：必须 user 上 CNC 控制器复核算出独立 warning 编号 + CF 文档级依据覆盖。`docs/macro-knowledge/Phase5-控制器证据采集清单.md` §C 表明确"RBT-127/124/115/116 警报编号依据"需 user 实测复核。
- **混路径**：可先路径 A 剔除（占位 code + code action 清理），后续若 user 拿到 B 级证据再路径 B 重新加回独立 code（参考 parity 清单已覆盖段允许 follow-up 扩展，readiness 第 2 项硬正则已放宽）。

## Phase R1 — JS analyzer 函数式核心退役（agent 可执行）

> 前置：上述不变前提 1 + 2 + 3 全达。
> 工作量：13 个 JS 文件 ~3261 行退役 + 必要 wiring 调整。

### R1.1 — 准入自检脚本就位

新增 `scripts/checkJsBackendRetirement.js` + npm `check:js-backend-retirement`：对照 `scripts/auditJsBackend.js` 产出的缺口清单做准入 review。

| # | 门禁 | 准入条件 |
|---|------|----------|
| 1 | Phase 1.5 默认 backend 已切 rust-wasm | `package.json` `syntecMacro.analysisBackend` default === `rust-wasm` |
| 2 | 至少一个 release cycle 验证 | CHANGELOG `## X.Y.Z` 段含 `default backend: rust-wasm` |
| 3 | Rust 稳定诊断 parity 100% | JS+Rust 行为完全等价（无新增 dead code） |
| 4 | wasm asset 已 bundle | `check:rust:wasm:asset` PASS 且 byteLength/SHA 与已发布 VSIX 一致 |
| 5 | fallback 比例持续 0% | benchmark:compare 5 次采集 fallback 0/504 |
| 6 | Phase 5.x 跨行状态完整（或两端共同剔除） | dead code 三项决策已落地 |

每项返回 `PASS`/`SKIP`/`FAIL`+detail；`--strict` 任一 FAIL exitCode=1。

### R1.2 — 剔除 JS analyzer 函数式核心（一次 PR 收口）

**剔除范围**（13 个文件，~3261 行）：

| 文件 | 行数 | KB | 用途 |
|---|---|---|---|
| `src/validator.js` | 606 | 24.4 | 主 line-rule 顺序 |
| `src/robotValidator.js` | 682 | 28.9 | 跨行状态机 |
| `src/lexer.js` | 157 | 3.9 | 词法 |
| `src/controlFlowValidator.js` | 222 | 7.4 | 控制流嵌套 |
| `src/functionArgumentValidator.js` | 240 | 10.3 | 函数静态引数 |
| `src/diagnosticActions.js` | 80 | 9.9 | code action 表 |
| `src/diagnosticRules.js` | 26 | 0.6 | 规则编排 |
| `src/diagnosticFactory.js` | 152 | 4 | 创建 diagnostic |
| `src/formatter.js` | 152 | 5.9 | 已迁 Rust format_document |
| `src/navigationSymbols.js` | 118 | 3.8 | 已迁 Rust extract_navigation |
| `src/navigationIndex.js` | 43 | 1.4 | 命名收集 |
| `src/fileResolver.js` | 38 | 1.1 | 文件解析 |
| `src/analysisCore.js` | 72 | 2.5 | JS analyzer 入口 |

**保留范围**（仅 wiring 调整，体量小）：

| 保留 | 调整 |
|---|---|
| `src/analysisProtocol.js` (390 行) | 保留作 host ↔ Rust 协议契约 |
| `src/analysisBackend.js` (72 行) | 改为只注入 Rust 后端 + fallback 不再有 JS 实体 |
| `src/analysisHost.js` | 接收 `analysisBackend` Promise，不变 |

**剔除步骤**：
1. 修改 `src/analysisBackend.js` 删除 `javascript` backend case，保留 `rust-wasm` 为唯一 backend；fallback 路径改为「加载失败 → 抛错并显示 banner 提示重装/扩展损坏」（不再静默降级到 JS）。
2. 修改 `src/validatorWorker.js` 删除 `backend === 'javascript'` 分支。
3. 修改 `src/diagnosticsProvider.js` 与 `package.json` enumDescriptions → 保留 `rust-wasm` 为唯一选项。
4. `git rm` 上述 13 个文件；`scripts/checkVsixContents.js` 维护白名单。
5. 删除 `tests/validator.test.js` / `tests/robotValidator.test.js` 等 JS-only analyzer 单测（依赖被剔除的模块）。
6. `tests/rustWasmAsset.test.js` / `rustWasmWorkerAdapter.test.js` / `workerLifecycle.test.js` 保留并扩展：fallback 路径只断言"加载失败抛错"而非"回退 JS"。

**验收**：
- `npm test` 全绿（剔除前测试基线收紧后从 447 降至 ~350，剔除的 JS analyzer 单测被删）。
- `npm run compare:rust` 仍 parity 全等价（不动 Rust 端）。
- `npm run check:vsix` 显示 src 文件数减少 13 个。
- `npm run package` 产出 VSIX 字节数下降（估算 247KB → ~150KB）。
- `npm run check:release:readiness -- --strict` 在新增 R1 准入步骤全 PASS 后才切版本号。

### R1.3 — VSIX 体积与启动基线刷新

- 重打包 VSIX 比对 R1.1 前后字节差异。
- 在 `perf-baseline/` 新增 `v4.0.0.json` 作退役后节点基线。

## Phase R2 — 数据表迁移至 host 共享层（可选，不阻塞 R1）

> 前置：R1.1 + R1.2 全落地并稳定 ≥1 release cycle。
> 工作量：7 个 JS 数据表共 ~1262 行迁到独立 JSON / Rust 共享段。

**目标**: hover/completion 数据表从 `keywords.js` / `codeDocs.js` / `functions.js` / `systemVariables.js` 等迁到 `data/` 独立 JSON 文件，host Provider 层从 JSON 读不再依赖 JS 表。

| 数据表 | 行数 | 迁移目标 |
|---|---|---|
| `keywords.js` → gcodes/mcodes | 384 | `data/gcodes.json` |
| `functions.js` → functions | 97 | `data/functions.json` |
| `codeDocs.js` → hoverDocs | 260 | `data/hoverDocs.json` |
| `systemVariables.js` | 48 | `data/systemVariables.json` |
| `completionSnippets.js` | 26 | `data/snippets.json` (`package.json` 已支持) |
| `statementClassifier.js` | 63 | 候选迁 Rust `classify_statement_for_formatter`（已存在） |

### R2.X — 验收

- 数据表迁出不影响 hover/completion 行为（`hoverProvider.test.js` / `completionProvider.test.js` 仍全 pass）。
- JSON 数据接口在 host 层包装为只读缓存。

## Phase R3 — Agent 不擅自做的事

以下动作涉及 release workflow / credential / 跨平台构建，**完全由 user 决策**：

1. v4.0.0 版本号切换（Major：剔除 JS）
2. GitHub Release + tag + VSIX 上传
3. R1.1 + R1.2 PR review + 合并
4. v4.0.0 上线后用户问题观察期 ≥1 release cycle

## Agent 现在能做的简单部分

- ✅ `scripts/auditJsBackend.js` 已创建
- ✅ 缺口清单已生成：3 dead code + 13 退役候选 + 14 host-only 不动 + 7 数据表保留
- 🔜 R1.1 准入自检脚本（无资料阻塞）— 当前 Phase 1.5 / Phase 5.x 未达，脚本就位等准入
- 🔜 workerLifecycle / rustWasmWorkerAdapter 测试现状盘点 + dead code 三项决策文档化
- 🔜 路线图接入 `docs/迭代优化计划.md` 主索引

## 不变约束（与 `docs/3.x-Rust-Wasm切换剩余任务规划.md` §3 一致）

1. 在 R1.1 准入所有项 PASS 之前**不要剔除任何 JS 模块**。
2. 不得删除 `tests/workerLifecycle.test.js` / `rustWasmAsset.test.js` / `rustWasmWorkerAdapter.test.js`（这些是 fallback 行为守卫）。
3. 不得修改 `assets/rust-wasm/` 内容时跳过 `scripts/buildRustWasmAsset.js` 全链校验。
4. host-only Provider 层与数据真源表即便在 R2 完成后也保留作 host 层入口。

## 入口

- 路线图: `docs/JS-Backend退役路线图.md`（本文）
- 准入审计工具: `scripts/auditJsBackend.js`
- 准入自检工具: `scripts/checkJsBackendRetirement.js`（待 R1.1 创建）
- 主索引: `docs/迭代优化计划.md` §R1
- 发布 runbook: `docs/3.x-Release-Runbook.md`（v4.0 Major 时参考本路线图）
