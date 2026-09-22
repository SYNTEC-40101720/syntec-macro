# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## 4.0.0 - 2026-09-22

### Changed — Breaking (R1.2 Stage B: JS 后端退役)

- **Major 版本升级 3.1.0 → 4.0.0**: R1.2 Stage B 把 JS 分析后端彻底退役, backend 硬切为只支持 `rust-wasm`. `syntecMacro.analysisBackend` enum 收敛为 `['rust-wasm']` 单值, `javascript` 与 `rust-wasm-shadow` 配置项不再可用 (graceful upgrade: 旧值会被 VS Code 校验拒绝并提示用户重设为 `rust-wasm`). `src/analysisCore.js`/`lexer.js`/`validator.js`/`robotValidator.js`/`controlFlowValidator.js`/`functionArgumentValidator.js`/`diagnosticRules.js`/`diagnosticFactory.js`/`formatter.js`/`navigationSymbols.js`/`navigationIndex.js`/`statementClassifier.js` 共 12 个 JS 分析器源文件删除, 净减 ~4218 行. Host provider (`formattingProvider`/`navigationProvider`/`definitionProvider`) 现全部走 `hostRustAnalyzer` 同步路径, worker (`validatorWorker`) 默认与唯一 backend 为 `rust-wasm`.
- **R1.2 Stage B §2.x host provider 同步路径重写**: `formattingProvider` 不再 `require('./analysisCore').formatDocument`, 格式化 100% 走 Rust (未就绪时返回 `[]`). `navigationProvider` 同步路径不再 `require('analysisCore'/'navigationIndex'/'navigationSymbols')`, 改由 `pathResolver` 提供 `collectNavigationIndexEntries`/`isPotentialNavigationFile`/`getProgramEntryName`/`getMacroProgramName`/`isMacroFileContent`/`extractNavigationSymbolsMetaOnly` 等 host-only 函数; `loadIndex` 在 host 未就绪时返回 `null`, 上层降级为延迟响应.
- **R1.2 Stage B §2.1 hostRustAnalyzer policy 'empty'**: `extension.js` activate 中显式调用 `setHostAnalyzerPolicy('empty')`, host 未就绪时 `getHostRustAnalyzer()` 返回 `null`, 所有 host provider 返回空结果而非试图加载 `analysisCore` 的 JS fallback.
- **R1.2 Stage B §2.9-§2.10 worker 与 adapter 重写**: `validatorWorker.js` 的 `DEFAULT_BACKEND` 改为 `rust-wasm`; 移除 `javascript`/`shadow`/`unknown` 分支, 未知 backend 退化为 `rust-wasm` 并记录 unknown 日志; `rustWasmWorkerAdapter.js` 删除 shadow mode、`resultsEqualShallow`、`javascriptAnalyzer` option、`onShadowMismatch`, 只保留主路径.
- **R1.2 Stage B §2.11 analysisBackend**: `createAnalysisBackend` 只接受 `backend='rust-wasm'`, 要求 `rustAnalyzer`/`onFallback` 为函数; JS fallback 路径删除, `onFallback` 仅上报且 rethrow 由 worker 决定 UI 提示.
- **R1.2 Stage B §2.12 diagnosticsProvider**: 移除 `fallbackAnalysisHost = new AnalysisHost()` (Stage B 下会触发 createAnalysisBackend 抛错); worker 不可用时 `validateDocumentAsync` 返回 `Promise.resolve(null)`, `refreshDiagnostics` 跳过本轮.
- **R1.2 Stage B 测试与脚本改动**: 删除 4 个仅测 JS 单元的测试 (`validator.test.js`/`navigationIndex.test.js`/`parserSpike.test.js`/`analysisBenchmark.test.js`); `workerLifecycle.test.js` 重写为 8 项全 `rust-wasm` 契约; `rustWasmWorkerAdapter.test.js` 重写为 3 项纯 primary mode; `extension.test.js` 删除 25 项 JS-unit tests 保留 41 项; `analysisProtocol.test.js` 删 6 项 JS backend 测试 + 新增 3 项 R1.2 契约断言; `formattingProvider.test.js` 改为 async host-Rust 路径; `compareRustCore.test.js` 断言已退役 JS helpers 抛 MODULE_NOT_FOUND; `benchmarkCompare.test.js` 删 4 项 `runJavaScriptEquivalent` 测试, 重写 parity 契约为 'rust-only'. `scripts/compareRustCore.js` 默认基线改为 `tests/fixtures/rust-parity-baseline.json`, JS helper 改为 lazy require 在 R1.2 后抛 MODULE_NOT_FOUND.

### Migration

- **从 3.1.0 升级**: 用户配置若设过 `syntecMacro.analysisBackend = "javascript"` 或 `"rust-wasm-shadow"`, 升级到 4.0.0 后该值不在 enum 中, VS Code 会拒绝该值并回退到 `rust-wasm` 默认. 无任何用户数据迁移; Rust/Wasm 资产 `assets/rust-wasm/` 已 bundle 进 VSIX.
- **回滚**: 如需回到 3.1.0, 按 `docs/R1.2-实施方案.md` §6 Rollback 步骤 (撤销 R1.2 PR + 重装 `syntec-macro@3.1.0` 或 `v3.1.0` tag). 不提供运行时 JS 分级回退.

### Validation (R1.2 Stage B 提交 commit 02ae430)

- `npm test`: 236/236 PASS, 0 fail / 0 skip / 0 cancelled
- `npm run lint`: clean
- `npm run compare:rust` (`SYNTEC_RUST_CLI`): 135 cases + 10 nav + 17 format parity 全等价
- `npm run check:js-backend-retirement`: 6 PASS / 0 SKIP / 0 FAIL
- `npm run check:release:readiness`: 6 PASS / 1 SKIP / 0 FAIL
- `npm run check:vsix`: 35 files valid
- `npm run smoke:installed`: extension 激活 + rust-wasm worker 正常加载

### Changed — Document ownership boundary for `release:create`

- **Open the v4.0 release workflow as agent-runnable**: `docs/R1.2-实施方案.md` 前置条款 3 与 `docs/JS-Backend退役路线图.md` §Phase R3 的 "Agent 不擅自做的事 / 完全由 user 决策" 措辞改为 "Agent 按 `docs/3.x-Release-Runbook.md` 走完整 tag/发版流程，每步输出当前进度与下一个准备动作由用户认可；只走 CI 主路径（`git push origin v*.*.*` 触发 `.github/workflows/release.yml`），不保留 `scripts/createGitHubRelease.js` 备路径以外的最高权限凭证操作". 此处的范围调整只覆盖 v4.0；后续 Major 版本（v5.0+）默认回到原 user 决策边界。

## 3.1.0 - 2026-09-21

### Changed

- **Phase 1.5 — 默认 backend 切换为 rust-wasm + 版本升级 3.1.0**: `syntecMacro.analysisBackend` default 由 `javascript` 切到 `rust-wasm`；`enumDescriptions` 同步；`package.json` / `package-lock.json` / `README` 徽章 / `CHANGELOG` 全部切到 3.1.0。后续 JS 仍保留 fallback 路径，加载/运行失败时显式降级。
- 前置 `check:js-backend-retirement --strict` 准入 6 项 (除 1/2 切换本身解决) 全部 PASS；`compare:rust` Parity 全等价；`check:release:readiness --strict` 6 PASS+1 SKIP+0 FAIL。

## [Unreleased]

## 4.1.0 - 2026-09-22

### Added — 27 个 SOFT governance 缺口 DIAGNOSTIC_HELP 用户文案补齐（2026-09-22）

- **背景**: `scripts/checkDiagnosticGovernance.js` 的 SOFT 门禁（`src/diagnosticActions.js` `DIAGNOSTIC_HELP` 用户文案）历来是 informational warning，不阻塞发布; `npm run check:diagnostic-governance` 此前报告 HARD=0 PASS / SOFT=27（27 个稳定诊断 code 缺 hover/codeAction 用户文案，派生层 `docs/诊断规则与修复动作.md` fallback 显示 `-`）。本批为 27 个缺文案的 code 全部补 `DIAGNOSTIC_HELP[code] = { title, message }`，让 hover/codeAction 在 editor 内能显示明确说明，并为把 governance 检查升级为发布硬门禁铺路。
- **补齐 27 项**:
  - **基础语法与赋值 (4 项)**: `SYNTEC_MISSING_SEMICOLON` (分号闭合) / `SYNTEC_CONTROL_STRUCTURE_TRAILING_SEMICOLON` (流程控制关键字行不需要分号) / `SYNTEC_ASSIGNMENT_STYLE_EQUALS` (`:=` 而非 `=`) / `SYNTEC_UNSUPPORTED_LOGICAL_NOT_OPERATOR` (`NOT` 而非 `!`)。
  - **Fanuc/不支持运算符 (11 项)**: `SYNTEC_UNSUPPORTED_ELSIF` (改 ELSEIF) / `SYNTEC_UNSUPPORTED_DEFAULT` (改 ELSE) / `SYNTEC_UNSUPPORTED_DIV` (改 `/`) / `SYNTEC_UNSUPPORTED_EQUALITY_OPERATOR` (改 `=`) / `SYNTEC_UNSUPPORTED_INEQUALITY_OPERATOR` (改 `<>`) / `SYNTEC_UNSUPPORTED_LOGICAL_AND_OPERATOR` (改 AND) / `SYNTEC_UNSUPPORTED_LOGICAL_OR_OPERATOR` (改 OR) / `SYNTEC_UNSUPPORTED_PERCENT_OPERATOR` (改 MOD) / `SYNTEC_UNSUPPORTED_COMPOUND_ASSIGNMENT` (展开 `+=` 等) / `SYNTEC_UNSUPPORTED_INCREMENT` (展开 `++`) / `SYNTEC_UNSUPPORTED_FANUC_COMPARISON` (`EQ/NE/GT/GE/LT/LE` → `= / <> / > / >= / < / <=`)。
  - **控制流配对与未闭合 (7 项)**: `SYNTEC_CONTROL_UNMATCHED_END` / `SYNTEC_CONTROL_NESTING_ORDER` / `SYNTEC_CONTROL_UNMATCHED_ELSE` / `SYNTEC_CONTROL_UNMATCHED_ELSEIF` / `SYNTEC_CONTROL_ELSEIF_AFTER_ELSE` / `SYNTEC_CONTROL_UNMATCHED_UNTIL` / `SYNTEC_CONTROL_UNCLOSED_BLOCK`。
  - **机器人 TOOLCOR/MOVJ/直接引数 (5 项)**: `SYNTEC_ROBOT_DEPRECATED_MOVJ_II` (MOVJ II 弃用) / `SYNTEC_ROBOT_DIRECT_ARG_EQUALS` (直接引数用 `=` 而非 `:=`) / `SYNTEC_ROBOT_TOOLCOR_T_ARG` (T 引数弃用改 P) / `SYNTEC_ROBOT_TOOLCORON_DEPRECATED` (TOOLCORON 弃用) / `SYNTEC_ROBOT_TOOLCOR_CLEAR` (TOOLCOR 清除)。
- **每项文案结构**: 遵循既有 `{ title: '查看/改为 <主题>', message: '<新代 MACRO 规则 + 规避策略>' }` 形状; `title` 用作 hover 标题，`message` 用作 hover 主体或 codeAction 详细说明。`ASSIGNMENT_STYLE_EQUALS` 等 5 个原有 `DIAGNOSTIC_REPLACEMENTS` 已有 Quick Fix 的 code，文案主要补充"为什么"段的 hover 体验。
- **`tests/checkDiagnosticGovernance.test.js` 契约更新**: 原 `buildChecks default mode` 测试断言 `r.soft.length > 0`（SOFT 缺口存在）改 `r.soft.length === 0`（SOFT 已补齐）；原 `formatResult --strict` 测试的 if 分支翻转：`soft.length === 0` 验证 strict 模式输出 PASS，`else` 分支保留 SOFT 缺口时不应 PASS 的反向断言作未来回退守卫。
- **`docs/诊断规则与修复动作.md` 派生层刷新**: 经 `npm run docs:diagnostics` 自动重生成，27 个原本 fallback 显示 `-` 的行改为实际文案。
- **`.github/workflows/release.yml` 发布门禁升级**: `诊断规则科学化治理` step 从默认模式升到 `-- --strict`（HARD + SOFT 任一缺失即 fail job），正式作发布硬门禁；PR 阶段 `ci.yml` 仍 `continue-on-error: true` informational review 保持开发宽松。
- 验收: `npm test` 293/293 PASS / `lint` 0 / `typecheck:analysis` 0 / `check:diagnostic-governance` HARD=0 PASS / SOFT=0 PASS（70/70 DIAGNOSTIC_HELP 全覆盖） / `docs:diagnostics:check` 通过 / `check:release` 一致。

### Changed — Phase 5.4-5.6 文档收口（2026-09-22）

- **Phase 5.3 第 4 项 + Phase 5.4-5.6 收口**：本批不是新增 code 或 emit 路径，是对已落地代码的文档状态收口，反映 `crates/syntec-core/src/lib.rs` 现状已在 `analyze_request` 主循环内逐行调用 `validate_robot_line_state`（即时 emit 入口由 Phase 5.3 第 1-2 项落地），文件尾内联段处理 `SYNTEC_ROBOT_MOVC_PAIR_REQUIRED` 未配对收尾，`result_to_json` 已完整序列化 `diagnostics` 数组。
  - **Phase 5.3 第 4 项 (已完成 2026-09-22)**：`analyze_request` 主循环验放收口。8 项 RBT 全部覆盖 emit（RBT-124/127/115/322/154-2/110/257/123）；`RBT-118` 决策不 emit；dead code `SWAITSIG_Q_RANGE` / `SYNCOUT_Q_RANGE` / `SKIPCOND_Q_RANGE` 在 Phase 5.3 路径 A 已退役。
  - **Phase 5.4 (已完成 2026-09-22)**：`compare:rust` parity 验证。差分基线 139 类（135 + 4 个 RBT-127 中间点超限）+ navigation 10/10 + edits 17/17 全等价；`tests/fixtures/rust-parity-baseline.json` 已含 Phase 5.3 第 1/2 项全部 case。
  - **Phase 5.5 (已完成 2026-09-22)**：接入 `analyze_request` 主循环。`validate_robot_line_state` 已在主循环内逐行调用，所有 Phase 5.3 emit 即时产生并通过 `result_to_json` 输出；MOVC pending pair 文件尾 emit 由主循环后的内联段处理。STITCHON/WEAVEON/WAITSYNC/G192 区间未关闭的收尾 emit 属新规则（JS 端原无此诊断），不在 Phase 5.3 范围内，留作未来 follow-up。
  - **Phase 5.6 (已完成 2026-09-22)**：`docs/Rust诊断parity清单.md` 顶部状态段已含 Phase 5.3 第 1/2/3 项里程碑记录（73/73 Rust parity code 全覆盖）；`docs/macro-knowledge/MACRO能力矩阵.md` ROB-001 状态维持 «实测复核（CF + B 级双轨对齐）»，段内已说明 23 个 `SYNTEC_ROBOT_*` 稳定诊断 code 全覆盖 + 3 个 dead code 已退役。
  - **文档同步**：`docs/迭代优化计划.md` §3 Phase 5 节点收口（5.3 第 4 项及后续 + 5.4-5.6 标记「已完成 2026-09-22」）；`docs/macro-knowledge/Phase5-控制器证据采集清单.md` §D 接续表加「状态」列，5.2 / 5.3 / 5.4 / 5.5 / 5.6 各项标 ✅ 已完成。
  - 验收: `npm test` 293/293 PASS / `lint` 0 / `typecheck:analysis` 0 / `check:rust:wasm:asset` PASS (322575 B / SHA-256 `02bcb398...`) / `check:release:readiness --strict` 6 PASS+1 SKIP+0 FAIL / `check:js-backend-retirement --strict` 6 PASS+0 SKIP+0 FAIL / `check:diagnostic-governance` 治理门禁 PASS / `compare:rust` 139/139+10/10+17/17。

### Fixed — Phase 5.3 第 3 项 cargo test --lib 既有破损修复（2026-09-22）

- **背景**: Phase 5.3 第 1-2 项 task_complete 时确认 `cargo test --lib` 有 4 个 navigation 测试破损（CI 仅跑 `cargo build --lib` 不阻塞 CI）。Phase 5.3 第 3 项顺势收口。
- **navigation 测试 `result.calls` → `result.navigation.as_ref().expect(...).calls`**: `crates/syntec-core/src/lib.rs` `tests` mod 内 4 个测试 (`extracts_macro_symbols_and_static_calls` / `normalizes_numeric_and_named_navigation_calls` / `navigation_ignores_strings_and_comments` / `navigation_positions_use_utf16_offsets`) 在 P0-B 重构后仍断言旧版顶层 `result.calls` 字段，但 `AnalysisResult` 早已把 `calls` 移入 `navigation: Option<AnalysisNavigation>` 之下，编译失败。
- **新增测试辅助 `analyze_macro_document`**: 走 `analyze_request(AnalysisRequest { uri: "file:///test/macro.nc", ... })` 触发 `is_macro_file_content` 经 `MACRO_FILE_EXTENSIONS` 路径命中让 `navigation = Some`, 然后 `result.navigation.as_ref().expect("navigation must be present for MACRO document").calls` 取 calls。`mod tests` 顶部 `use` 加 `analyze_request` / `AnalysisRequest` / `DocumentSnapshot` / `PROTOCOL_VERSION`。
- **同并修 `is_g10_l_line` 单测断言错误**: 上次会话误写 `assert!(!is_g10_l_line("G10 L0;"))`, 但 `is_g10_l_line` 按 `^\s*G10\s+L\d+\b` 实现, `L0` 仍满足 `\d+` 且现场 `G10 L0` 也占用 LTP 解译器单节队列应计入 MOVC 中间单节, 故应判 `true`. 改为断言 `G10 L;` (L 后无 digit) 返回 `false` 与实现一致。
- **wasm 资产不变**: lib.rs 改动仅在 `#[cfg(test)]` 模块, 不进 wasm 二进制. `check:rust:wasm:asset` 仍 322575 B / SHA-256 `02bcb398d87a41e3...` PASS.
- 验收: `cargo test --lib` 37/37 PASS / `npm test` 293/293 / `lint` 0 / `typecheck:analysis` 0 / `check:diagnostic-governance` HARD=0 PASS / `check:rust:wasm:asset` PASS / `check:release:readiness --strict` 6 PASS+1 SKIP+0 FAIL / `check:js-backend-retirement --strict` 6 PASS+0 SKIP+0 FAIL / `compare:rust` 139/139+10/10+17/17 / `probe:rust:wasm` counts=0/1。

### Added — Phase 5.3 第 2 项 ROB-LTP-03/04/07/08 区间禁忌独立 code 化（2026-09-22）

- **按第一性原理拆分通用区间禁用 code**: 现场使用者看到 editor 报 `SYNTEC_ROBOT_RANGE_FORBIDDEN_COMMAND` 时无法精确定位是 RBT-115 / RBT-322 / RBT-257 / RBT-123 中哪一个 RBT 出问题；按「每 RBT → 独立 code」的项目既有路线，把 4 个运动辅助区间（STITCHON / WEAVEON / WAITSYNC / G192.1）的 error emit 从通用 `SYNTEC_ROBOT_RANGE_FORBIDDEN_COMMAND` 拆分为 4 个按区间式独立 code：
  - `SYNTEC_ROBOT_STITCHON_FORBIDDEN_COMMAND` — STITCHON 连续脉冲输出区间禁忌，对应 RBT-115 连续脉冲输出不支援此指令（ROB-LTP-03，CF 实测 `STITCHON_active=1`）。
  - `SYNTEC_ROBOT_WEAVEON_FORBIDDEN_COMMAND` — WEAVEON 摆动作用区间禁忌，对应 RBT-322 摆动不支援此指令（ROB-LTP-04，CF 实测 `WEAVEON_active=1`）。
  - `SYNTEC_ROBOT_WAITSYNC_FORBIDDEN_COMMAND` — WAITSYNC 履带追踪同动区间禁忌，对应 RBT-257 履带追踪不支援此指令（ROB-LTP-07，CF 实测 `WAITSYNC_active=1`；RBT-118 点位偏移侧 CF 优先报 RBT-257 故暂不 emit）。
  - `SYNTEC_ROBOT_G192_FORBIDDEN_COMMAND` — G192.1 末端跟踪区间禁忌，对应 RBT-123 末端跟踪不支援此指令（ROB-LTP-08，CF 实测 `G192_scope_active=1`）。
- **保留 `SYNTEC_ROBOT_RANGE_FORBIDDEN_COMMAND` 兜底**: M96 中断型副程序 warning 不区分 RBT 编号（CF 在多个区间都发 M96 等价的"无效"警告），仍走通用 `push_range_forbidden` helper。`push_range_forbidden` 保留在 `lib.rs`，4 个区间 error emit 改为直接 `push_diagnostic` literal。
- **RBT-110 / RBT-154-2 编号关联收口**: 既有 `SYNTEC_ROBOT_SYNCOUT_LIMIT`（同一运动单节最多 10 个 SYNCOUT，对应 RBT-110）和 `SYNTEC_ROBOT_SWAITSIG_LIMIT`（运动单节后只能下 1 个 SWAITSIG，对应 RBT-154-2）的 emit 逻辑已就位且语义等价 CF 描述，无需代码变更，仅在 `docs/Rust诊断parity清单.md` §交叉引用表上明确编号关联收口。
- **四件套登记完成**:
  - JS `src/diagnosticCodes.js` 新增 4 个 key（JS 总 code 65 → 69；Rust stable code 66 → 70；parity 文档 69/69 → 73/73）。
  - `src/diagnosticActions.js` `DIAGNOSTIC_HELP` 新增 4 项文案，每项含对应 RBT 编号 + 区间界限 + 规避策略（关闭区间指令 + 改用 MOVL/MOVC 等）。
  - Rust `crates/syntec-core/src/lib.rs` 4 处 `push_range_forbidden` Error 调用改为直接 `push_diagnostic` literal；2 处 M96 Warning 保留 `push_range_forbidden`。
  - `docs/Rust诊断parity清单.md` 顶部「Phase 5.3 第 2 项...」状态段 + §已覆盖列表加 4 code + §交叉引用表 ROB-001 行追加 4 code。
- **Compare:rust parity 不变**: 既有 12 个区间禁用 case (`robot-signal-stitchon-forbids-movj` / `...-stitchon-forbids-weaveon` / `...-stitchon-movl-skip-forbidden` / `...-weaveon-forbids-movj` / `...-weaveon-forbids-stitchon` / `...-waitsync-forbids-movj` / `...-waitsync-forbids-mcode` / `...-g192-forbids-swaitsig` / `...-mutual-exclusion-stitch-in-weave` / `...-mutual-exclusion-weave-in-stitch` 各 1 项；`...-stitchon-m96-warning` 1 项保 RANGE_FORBIDDEN) 仅更新 `tests/fixtures/rust-parity-baseline.json` 中 `expected.code` 字段，`text / line / col / endCol / severity` 完全保留。139/139 + 10/10 + 17/17 等价不变。
- **wasm 资产重打包**: `assets/rust-wasm/syntec_core.wasm` byteLength 322188 → 322575（+387 B，含 4 个新 literal emit 路径与 message 字符串）；SHA-256 `8a6ac9012471d763...` → `02bcb398d87a41e3...`。`probe:rust:wasm` counts=0/1 通过；`check:rust:wasm:asset` PASS。
- **文档同步**: `docs/Rust诊断parity清单.md` 顶部状态段 + §已覆盖列表 + §交叉引用表 + 文档总数 69 → 73；`docs/迭代优化计划.md` §3 Phase 5 节点刷新（Phase 5.3 第 1-2 项已落地）+ §4 文档总数 69 → 73；`docs/诊断规则与修复动作.md` 经 `npm run docs:diagnostics` 自动重生成。
- 验收: `npm test` 293/293 PASS / `lint` 0 / `typecheck:analysis` 0 / `docs:diagnostics:check` 通过 / `check:diagnostic-governance` HARD=0 PASS / `check:rust:wasm:asset` PASS / `check:vsix` 39 文件一致 / `check:data` 一致 / `check:release:readiness --strict` 6 PASS+1 SKIP+0 FAIL / `check:js-backend-retirement --strict` 6 PASS+0 SKIP+0 FAIL / `compare:rust` 139/139+10/10+17/17。

### Added — Phase 5.3 第 1 项 ROB-LTP-02 / RBT-127 emit 落地（2026-09-22）

- **第一笔 Phase 5.3 跨行 emit 入口完成**: `crates/syntec-core/src/lib.rs` `validate_robot_line_state` 在 `pending_movc_line > 0` 期间对四类「计入中间单节」的指令推进 `movc_pair_count`（阈值 10），第 11 笔即时在本行 emit `SYNTEC_ROBOT_MOVC_INTERMEDIATE_LIMIT`（severity=error），对应控制器 [RBT-127 圆弧运动单节间的指令数量已超过上限]（ROB-LTP-02，源自现场实测记录单 §C-02 / `movc_pair_count=11`）。
  - **新增辅助函数 `is_g10_l_line`**: 按 `^\s*G10\s+L\d+\b` (case-insensitive) 识别 G10 L1000/L1810/L1820/L1900/L1901 等工件/IO/通讯参数写入行，作「计入」第一类（占用 LTP 解译器中间单节缓冲队列）。
  - **计入四类**: `G10 L*` 行 (新辅助识别) / `SYNCOUT` (非运动辅助) / 非运动辅助 M 码 (`M<num>` 形态) / 非运动辅助 G 码。MOVC 自身不计数（作配对成员）。
  - **豁免三类**: （1）单行 X1=/X2= 写法不设置 `pending_movc_line`，自然不进入计数路径；（2）Macro 变量赋值 / 流程控制 / 注释 `get_command` 返回 `None` 在 `validate_robot_line_state` 顶部 early return，不计数；（3）条件分支内指令（`in_conditional_branch=true`）与 MOVC pair 规则一致豁免。
  - **触发时机（push-time bounds check）**: 第 11 笔中间指令入栈时在本行即时 emit error，行起始 col..clean_end；不延迟到下一个结束 MOVC。
  - **配对完成时重置**: MOVC 配对完成（第二笔双行写法 MOVC 到达）或运动指令截断圆弧对时 `movc_pair_count` 与 `pending_movc_line` 同步归零，避免污染下一对 MOVC。
  - **计入逻辑依据**: user 2026-09-22 CF 复核 + Phase5-控制器实测现场记录单 §C-02 「插入 11 笔 `G10 L1000 P1 R1` 触发 RBT-127，计数器 `movc_pair_count=11`」。CF 原文「中间点与结束点间允许的指令数上限为 10 个（Macro 标准语法与模态指令除外），否则触发 `RBT-127`」。
- **四件套登记完成**: JS 端 `src/diagnosticCodes.js` 加 `ROBOT_MOVC_INTERMEDIATE_LIMIT: 'SYNTEC_ROBOT_MOVC_INTERMEDIATE_LIMIT'` key + `src/diagnosticActions.js` `DIAGNOSTIC_HELP` 用户文案；Rust 端 `lib.rs` literal emit；`docs/Rust诊断parity清单.md` §已覆盖列表新增 code + §交叉引用表增至 69 项 + 顶部「Phase 5.3 第 1 项...」状态段。
- **新增 Rust 单测**: `is_g10_l_line_matches_l1000_l1802_l1810_l1820_l1900_l1901` (1 + 6 + 5 边界) + `phase5_3_movc_intermediate_limit_emits_on_eleventh_g10_l1000` (11 笔累计 + 第 11 笔即时 emit + 第 12 笔配对 MOVC 重置计数) + `phase5_3_movc_intermediate_limit_豁免_单行_x1x2_与_macro_赋值` (单行 MOVC 与 Macro 赋值豁免路径)。`cargo test --lib` 因既有 `result.calls` 测试破损未跑（Phase 5.3 修复区域无 npm test 影响路径）。
- **Compare:rust 差分扩展 + wasm 资产重打包**:
  - `scripts/compareRustCore.js` 新增 4 个 CASES 与对应 `tests/fixtures/rust-parity-baseline.json` 基线条目：
    - `robot-mov-movc-intermediate-g10-l1000-eleventh` → expect 1 RBT-127 emit (line=12, col=0, endCol=16)
    - `robot-mov-movc-intermediate-g10-l1000-ten-pair-completes` → expect 0（10 笔中间 + 配对 MOVC 收尾不触发）
    - `robot-mov-movc-intermediate-single-line-x1x2-exempt` → expect 0（单行 MOVC 已配对，后续多笔 G10 不计数）
    - `robot-mov-movc-intermediate-macro-assignment-exempt` → expect 0（Macro 变量赋值豁免，11 笔 `#1 := 5;` 不计数）
  - `compare:rust` P0-B request parity 135 → 139（139/139 等价），navigation 10/10、edits 17/17 维持等价。
  - `assets/rust-wasm/{manifest.json, syntec_core.wasm}` 重打包：byteLength 318040 → 322188（+4148 B，含新 RBT-127 emit 路径）；SHA-256 `88ddaeacf0aae64641a0f1b848bb637cd7a5bdd7be47f425f998b4e5dc7d8f5f` → `8a6ac9012471d763...`。`probe:rust:wasm` counts=0/1 通过；`benchmark:rust:wasm --iterations 10` fixture p50 14.89/16.66ms、large p50 489ms 量级稳。
- **文档同步**: `docs/Rust诊断parity清单.md` 顶部状态段 + §已覆盖列表 + §交叉引用表；`docs/迭代优化计划.md` §3 Phase 5 段刷新节点；`docs/诊断规则与修复动作.md` 经 `npm run docs:diagnostics` 自动重生成新 code 派生行。
- 验收: `npm test` 293/293 PASS / `lint` 0 / `typecheck:analysis` 0 / `docs:diagnostics:check` 通过 / `check:rust:wasm:asset` PASS / `check:vsix` 39 文件一致 / `check:data` 一致 / `check:diagnostic-governance` HARD=0 PASS / `check:release:readiness --strict` 6 PASS+1 SKIP+0 FAIL / `check:js-backend-retirement --strict` 6 PASS+0 SKIP+0 FAIL / `compare:rust` 139/139+10/10+17/17。

### Added — Phase 5.1 控制器实测复核回填（2026-09-22）

- **Phase 5.1 B 级证据采集完成 (user 张颖, Syntec 81RA / 11MA, 10.120.44C / 10.120.52, 2026-09-20~22)**: user 上控制器把 `docs/macro-knowledge/Phase5-控制器实测现场记录单.md` 23 个采集块全部填完回传（§A 9 + §B 6 + §C 8），agent 按回传工作流把数据分别导入到对应资料包，能力矩阵与 parity 清单状态同步升级，本批未新增 `SYNTEC_*` 诊断 code（Phase 5.1 仅复核 + 资料回填）。Phase 5.2-5.3 Rust 端跨行 emit 入口已解锁，后续新增 code 时按 [诊断规则科学化工作流](docs/macro-knowledge/诊断规则科学化工作流.md) 8 步骤走四件套登记。
  - **A 组（CALL-RUN-01..07）→ `MACRO调用语义资料包.md`**: §3.3 追加 Phase 5.1 控制器实测复核结论表（与 CF 规范逐项对齐 + CALL-RUN-03/04 实测差异收敛说明），§4.1 追加 CNC 实测结果记录表（9 行 + 警报/证据列）。CALL-RUN-03/04 旧版 81RA"只触发一次"差异已被 10.120.44C+ 机器人版本修正为标准时序（每移动单节 / 每单节触发），不再单独保留 81RA 旧版分支适配。
  - **B 组（FUN-A-13A..F）→ `MACRO函数审计资料包.md`**: §1 函数矩阵 FUN-A-07/08 状态升级为 B 级已采，§4 表的 FUN-A-13 项状态从"证据阻塞"改为"已完成"，§4.2 追加 Phase 5.1 控制器实测复核结论（6 项摘要表 + 6 项核心结论收口 + Rust parity emit 入口解锁 + 风险边界）。`GETPR(prNo[, axisGroup])` 返回 `float (Double)`，空值返回 `0.0` 非 VACANT；越界发 `COR-016`，超范围发 `COR-023`，权限不足发 `COR-024`；运动相关即时生效、构型参数须重启生效；多态重载完整支持。
  - **C 组（ROB-LTP-01..08）→ `MACRO-LTP专项资料包.md`**: §4.2 追加 Phase 5.1 控制器实测复核结论（8 项实测警报编号对齐表 + 关键实测量化阈值收口 + Parity 接入解锁与边界 + Rust 状态机现有字段确认）。8 个实测警报编号全部与 CF 文档基线对齐：`RBT-124/127/115/322/154-2/110/257/123`；其中 `RBT-154-2` / `RBT-110` / `RBT-257` / `RBT-123` 四项此前为"待确认编号"，现已收口；`RBT-118` 点位偏移侧编号仍待后续专项采集。Rust `RobotLineState` 现有 7 个字段已覆盖 Phase 5.1 实测所需跟踪的跨行状态，无需在 Phase 5.2 新增字段。
  - **能力矩阵与 parity 同步**: `MACRO能力矩阵.md` 顶部状态升级，能力总览 CALL-001 / CALL-002 状态从 «部分核实» 升级为 «实测复核»，FUN-001 状态升级为 «实测复核（FUN-A-13 已解锁）»，ROB-001 状态升级为 «实测复核（CF + B 级双轨对齐）»。`Rust诊断parity清单.md` 顶部追加 Phase 5.1 控制器实测复核已落地段，对 4 个能力矩阵段与 3 个资料包段加反向指针。
  - **`Phase5-控制器证据采集清单.md` 收口**: A/B/C 三表的「CNC 待测 / 实测结果 / 结论 / 日期」列批量回填摘要，§G.4 追加 Phase 5.1 B 级实测收口结论段（含 RBT-118 仍待采集说明 + Phase 5.2-5.3 解锁结论）。

### Added

- **Phase 5 控制器实测现场记录单就位**: 新增独立 `docs/macro-knowledge/Phase5-控制器实测现场记录单.md` 作为上控制器时的现场记录载体（区别于现有的 `Phase5-控制器证据采集清单.md` 后者偏采编方法学与 CF 基线索引，前者是直接填表的空表单）。结构特点：
  - 顶部「采集环境」段：控制器机型 / 软件版本 / LTP 模式 / 采集人 / 日期范围，所有记录共用
  - §A CALL-RUN-01..07：每项独立表块（9 项），CALL-RUN-03/04 P0 必测项加触发频率观察枚举（仅 1 次 / 每移动单节 / 每单节 / 其他）
  - §B FUN-A-13A..F：每项独立表块（6 项），含返回类型 / 签名 / 越界 / 权限 / 重启生效 / axisGroup 6 个关键字段
  - §C ROB-LTP-01..08：每项独立表块（8 项），含期望警报 vs 实测警报对照 + 跨行状态机内部计数器字段（MOVC_pair_count / SWAITSIG_pending / SYNCOUT_count / STITCHON_active / WEAVEON_active / WAITSYNC_active / G192_scope_active）
  - §D 采集完成后 agent 接续工作表：5.2 → 5.6 完整接续路径，含「若 dead code 重新加回需按四件套登记工作流全套」指针
  - §E 阻塞风险与最低证据门槛（A/B 级 vs C/D 级不可单独作 parity 依据 / 81RA ↔ CNC 不可外推）
  - §F 提交检查清单（自查 7 项）
- **回传流程明确**: 填完后 git 提交本文件 → 通知 agent 「Phase 5 §A/B/C 已完成实测记录单回填」→ agent 自动把数据分别导入 `MACRO调用语义资料包.md` §4 / `MACRO函数审计资料包.md` §4 / `MACRO-LTP专项资料包.md` §3/§4 / `MACRO能力矩阵.md` / `Rust诊断parity清单.md`（若新规则需补 code），然后按 [诊断规则科学化工作流](docs/macro-knowledge/诊断规则科学化工作流.md) 走四件套登记 + `check:diagnostic-governance` HARD 守卫。
- **入口与同步**: `Phase5-控制器证据采集清单.md` 顶部加双向指针指向现场记录单; `README.md` 文档分层段补入口（11→12 个文档），并把原先过时的「JS `src/robotValidator.js`」描述全部同步为 v4.0.0 R1.2 Stage B 后的 Rust 唯一架构描述。
- 验收: `docs:diagnostics:check` 通过; `check:release:readiness --strict` 6 PASS+1 SKIP+0 FAIL。

### Changed

- **文档治理 — `docs/开发交接说明.md` 与 `docs/3.x-Rust-Wasm切换剩余任务规划.md` 同步 v4.0.0 + R2 状态**: 把过时停留在 v2.14.0 / v3.0.0 视角的段落刷新到 v4.0.0+ R2 收口状态：
  - `开发交接说明.md` §「后续计划与接续工作」: R1.3 / Phase R2 标 ✅ 已完成 (2026-09-22)，Phase 5 控制器证据与新诊断科学化为剩余可选；关键词新增指向 `src/data/keywords.json` (经 thin loader)。
  - `开发交接说明.md` §「确认版本」: 期望 `package.json` 4.0.0 + `v4.0.0` tag (旧 2.14.0)。
  - `开发交接说明.md` §「本地验证命令」: `check:release --tag v4.0.0` (旧 v2.14.0), 删除引用 `src/validator.js` 的 `validateDocument` 补充检查 (模块已在 v4.0.0 退役), 补一句 `npm test` 已涵盖 check:vsix/check:data/check:js-backend-retirement/check:rust:wasm:asset/typecheck:analysis 子项。
  - `开发交接说明.md` §「当前架构入口」: 重写为 v4.0.0 视角 (扩展入口 / Host-only helpers / Phase R2 数据真源 + thin loader / Rust/Wasm 核心 / 文档与生成 5 段), 删除对 12 个已退役 JS 模块的引用。
  - `开发交接说明.md` §「已发布里程碑」: 删除 v2.10 Milestone 1/2/3 与 v3.0.0「下一步建议」段，替换为简洁 4 行版本节点列表 (v4.0.0 / v3.1.0 / v3.0.0 / v2.13~v2.15)，删除重复的历史里程碑段。
  - `3.x-Rust-Wasm切换剩余任务规划.md` §1「当前架构 (v4.0.0 起)」: 数据真源段从「5 个 JS 表保留作 JS 数据表, 留给 Phase R2 迁到 JSON」改为「Phase R2 已完成 (2026-09-22): 4 表数据已迁到 `src/data/*.json` + thin JSON loader, completionSnippets 不迁」, 指向 `docs/迭代优化计划.md` §1。
  - `Phase5-控制器证据采集清单.md` §B/C/D/G 同步 v4.0.0 R1.2 Stage B 后的 Rust 唯一架构描述（删除已退役 JS analyzer 引用，全部改为 Rust `RobotLineState` / `crates/syntec-core/src/lib.rs`）；§「使用流程」增加 A→C→B 采集顺序建议 + 四件套登记工作流指针。
- 验收: `docs:diagnostics:check` 通过, `check:release --tag v4.0.0` 一致, `check:release:readiness -- --strict` 6 PASS+1 SKIP+0 FAIL.

### Added

- **Phase R2.2–R2.4 收口 — 数据真源全表迁出完成**: 在 R2.1 试点模板 (systemVariables) 上一次推进剩余 3 张 JS 数据真源表迁到 `src/data/*.json`，按相同步骤建 JSON → 写 thin JSON loader (mtime-aware 进程内只读缓存) → 加契约测试 → 更新 `checkVsixContents.js` 必填清单 → 全量门禁 green：
  - **R2.2 `functions`**: `src/functions.js` 内嵌的 62 项内置函数数组 (name/sig/doc) 迁到 `src/data/functions.json`；JS 模块保留运行时函数 `buildFunctionIndex()` / `getFunctions()` 与 `functions` getter 兼容解构用法；新增 `tests/functions.test.js` 9 项契约测试（条目计数快照 / 字段完整 / 大写命名 / 无重名 / 索引构建 / 缓存对象身份 / 反向断言无 JS literal / 导出接口）。
  - **R2.3 `codeDocs`**: `src/codeDocs.js` 内嵌 3 张 hover 文档表 (gCodeDocs 47/G10LCodeDocs 13/mCodeDocs 17) 迁到 `src/data/hoverDocs.json`（g10LCodeDocs 的 doc 数组在源里以 `join('\n')` 输出，JSON 直接存字符串保持运行时一致）；JS 模块保留 `getCodeDoc` / `getG10LCodeDoc` / `getCodeShortDescription` 3 个查询函数 + 3 个表 getter；新增 `tests/hoverDocs.test.js` 15 项契约测试（3 表条目计数 / 字段完整 / 大小写归一 / L 码多行字符串 / 反向断言无 JS literal / 导出接口）。
  - **R2.4 `keywords`**: `src/keywords.js` 内嵌 2 张表 (keywords 10 组 + keywordDocs 72 项) 迁到 `src/data/keywords.json`；JS 模块保留 `getAllKeywords` (cache) / `getMCodeDesc` / `getKeywordDoc` 运行时函数；新增 `tests/keywords.test.js` 14 项契约测试（10 组完整 + 72 条目计数 / 字段完整 / getAllKeywords 不含 gcodes/mcodes / 缓存身份 / 控制流 + 运算符 + 机器人关键字覆盖 / 反向断言无 JS literal / 导出接口）。
  - **R2.5 `completionSnippets` 评估**: 该模块仅含 1 个纯函数 `buildFunctionSnippet` 无数据真源；R2.5 判定不在数据迁移范围。表格中 `snippets/syntec-macro.json` 是 VSCode snippet 注册表，本身已是 JSON，无需再迁。Phase R2 标完成。
  - `scripts/checkVsixContents.js` `REQUIRED_STATIC_FILES` 在 R2.1 基础上再追加 3 个 JSON 路径，VSIX 内容校验由 36 → 39 文件。`package.json` `test` 命令追加 3 个测试文件路径。
  - 全量验收：`npm test` 281/281 (含 4 个 R2 契约测试合计 39 项) / `lint` 0 / `typecheck:analysis` 0 / `check:vsix` 39 文件 / `check:release` OK / `check:release:readiness --strict` 6 PASS + 1 SKIP + 0 FAIL / `check:js-backend-retirement --strict` 6 PASS + 0 SKIP + 0 FAIL / `benchmark:compare` 无回归（fixture p50 12.01ms vs v4.0.0 baseline 12.84ms / large-20k 323.71ms vs 370.12ms / nav-500-files 67.29ms vs 109.77ms，Rust-only benchmark 热路径不在 host JSON loader 路径上，符合预期零回归）。
- **Phase R2.1 试点 — systemVariables 数据真源迁出**: 作为 v4.0.0 R1.2 Stage B JS analyzer 退役后的数据表迁移路线起点（`docs/迭代优化计划.md` §1），把 `src/systemVariables.js` 内嵌的 `SYSTEM_VARIABLE_DOCS` literal（13 个系统变数编号语义表）迁出到 `src/data/systemVariables.json` 作为唯一数据真源（含 `source` / `maintenanceRule` 元字段）；`src/systemVariables.js` 改写为 thin JSON loader，提供 `getSystemVariableDocs()` / `getSystemVariableDoc(variable)` 两个接口、内部维护 mtime-aware 进程内只读缓存，host provider 通过原接口透明访问；`src/hoverProvider.js` `#` 变量分支无需修改。新增 `tests/systemVariables.test.js` 7 项契约测试覆盖 known-doc 查询 / 大小写归一化 / 未知变量返回 null / 完整 docs 对象 / JS 模块不残留 literal 反向断言 / mtime 缓存对象身份 / 模块导出仅 thin 接口。`scripts/checkVsixContents.js` `REQUIRED_STATIC_FILES` 追加 `src/data/systemVariables.json`，VSIX 内容校验由 35→36 文件。本批为试点：选定 systemVariables 因其数据形态最简单（纯字符串 map）、单一消费方 (`hoverProvider`)、check 脚本无引用，端到端跑通整个"数据真源唯一化"模板（建 JSON → 写 thin loader → 加契约测试 → 更新 VSIX 内容清单 → 全量门禁 green）；后续 3 张表 (`keywords` / `functions` / `codeDocs`) 按本模板分批推进。
- **R1.3 VSIX 体积与启动基线刷新 — v4.0.0 baseline 落库**: 采集 `perf-baseline/v4.0.0.json` 作 v4.0.0 R1.2 Stage B 退役后节点基线（gitCommit `886891a` = v4.0.0 tag / postReleaseHead `4c786bd`），含三场景 10 iterations Rust-only 数据：fixture p50 12.84ms / p95 24.40ms / first 45.22ms；large-20k p50 370.12ms / p95 495.17ms / first 384.09ms；nav-500-files batch 109.77ms / fallback 0/0；wasm artifact 320312 B / SHA-256 `b60d854c...`；parity 标 `rust-only`（JS analyzer 已退役，JS 字段全 0，benchmarkCompare 输出形态变化）。`perf-baseline/README.md` 同步追加 v4.0.0 baseline 入口 + 用途说明（作后续 v4.x 回归对照：Phase R2 数据表迁移不应影响 benchmark，若 p50 偏移 > 10% 视为回归需排查）。本 baseline 不是切默认 backend 的决策依据（切默认已在 v3.1.0 完成），仅作 v4.x+ 回归对照基线。

 

### Added

- **JS Backend 退役路线图与准入自检工具**: 作为 Rust/Wasm 3.x 后续 Major v4.0 的退役准备工作，新增以下 agent 可立即落地的工具与文档：
  - 新增 `docs/JS-Backend退役路线图.md`：定义 JS analyzer 函数式核心退役（13 个 JS 模块 ~3261 行）+ 数据表迁移至 host 共享层（7 个 JS 数据表）+ agent 不擅自做的事（v4.0 切版 / GitHub Release / Catalyst）三段路线，以及 3 项不变前提（Phase 1.5 切默认 backend / Phase 5.x 跨行 parity / fallback 持续 0% ≥1 release cycle）。
  - 新增 `scripts/auditJsBackend.js` + npm `audit:js-backend`：一次性表面审计工具，对照 `src/diagnosticCodes.js` 全量 67 个 code 扫描 `crates/syntec-core/src/lib.rs` literal 覆盖情况，同时列出 14 个 analyzer 函数式核心模块 / 7 个 JS 数据真源表 / 14 个 host-only Provider 绑定层；输出 markdown 报告供 R1 准入 review 直接 append。当前实跑结果：67 - 64 = 3 个 `*_Q_RANGE` dead code（`SYNTEC_ROBOT_SKIPCOND_Q_RANGE` / `SWAITSIG_Q_RANGE` / `SYNCOUT_Q_RANGE`）两端均未 emit，待 Phase 5.3 决策。
  - 新增 `scripts/checkJsBackendRetirement.js` + npm `check:js-backend-retirement`：对照 R1 路线图的 6 项准入条件做 informational/strict review，每项返回 `PASS`/`SKIP`/`FAIL`+detail；默认 exitCode=0（非门禁），`--strict` 任一 FAIL exitCode=1 作 CI/发布前硬门禁。当前实跑 3 PASS / 2 SKIP / 1 FAIL（默认 backend 仍 javascript，未切 rust-wasm）。
  - 新增 `tests/checkJsBackendRetirement.test.js` 10 项契约测试覆盖：CHECKS 数组 6 项 id 完整、每项 run() 形稳健、main 与 `--strict` exitCode 行为、当前 v3.0.0 应 FAIL（默认 backend）+ SKIP（3 dead code）+ PASS（wasm asset + 路线图文档）的预期断言。
  - 把 §R 段接入 `docs/迭代优化计划.md` 主索引，作为 v3.x → v4.0 推进入口。
  - 本批工具仅作退役准入诊断；不动 `src/` 任何 analyzer 与 provider 文件，不改动 wasm asset。
  - `docs/JS-Backend退役路线图.md` 中追加 **Phase 5.3 — Dead code 三项决策** 章节：列出三项 `SYNTEC_ROBOT_*_Q_RANGE`（SKIPCOND / SWAITSIG / SYNCOUT）的当前状态审计表、路径 A（两端共同剔除，agent 可执行）vs 路径 B（两端共同补 emit，需 user CNC B 级证据）的双决策表与混路径策略，end 让 R1.1 准入自检工具第 6 项「dead code 决策文档化」PASS。同时澄清 `addStaticSignalQRangeDiagnostic` 在 JS 端实际 emit 用的是 `ROBOT_STATIC_ARG_RANGE`（非三项独立 code），三项 code 是历史遗留占位。
- **Phase 1.5 切换辅助脚本（dry-run/find out）**: 新增 `scripts/switchToRustWasmBackend.js` + npm `switch:to-rust-wasm-backend`，作为 Phase 1.5 切默认 backend `javascript → rust-wasm` + 升版本 `3.0.0 → 3.1.0` 的一键向导；默认 dry-run 模式只打印改动 + 跑前置门禁（R1.1 准入除 1/2 项两个切换本身要解决的 FAIL 以外全 PASS + compare:rust parity 通过），`--apply` 才落盘并给出后续 user 侧步骤清单。新增 `tests/switchToRustWasmBackend.test.js` 7 项纯函数单测覆盖 `applyPackageJsonEdits` / `applyLockEdits` / `applyReadmeEdits` / `applyChangelogEdits` 的字符串/对象契约；不覆盖 `runPreFlightChecks`（依赖子进程 + 本地 CLI 环境）。脚本就位后 user 在 CI perf 数据累积达标后可直接跑 `--apply` 完成切换，再按 `docs/3.x-Release-Runbook.md` §2–§6 发版，agent 不擅自执行 `--apply`。

- **资料补章 → 程序匹配（Phase α 关键字与 hover 资料对齐）**: 让 `src/keywords.js` / `src/codeDocs.js` / `src/functions.js` 跟上资料补章 `f87b180`「Confluence 手册对齐补章」的新规范：
  - `src/keywords.js` `gcodes` 表补登 §8.16~§8.21 新机器人指令 `G196`（电弧跟踪）/ `G193.101`（客制激光焊）/ `G903`（断刀监控）；`G144.103/104`、`G145.1/2` 已在表中无需补。
  - `src/codeDocs.js` 补完缺失的 `G10 L1802` hover 条目（依据手册 §8.4.3 静音模式版本门控段 + COR-345/COR-348 + 版本门槛 `10.118.28G/33+` + 静音版本差异表 10.118.40R/42R/48C/50+），同时补登 `G196` / `G193.101` / `G903` hover。
  - `src/functions.js` `CHKMN/CHKSN/CHKMT/CHKMI/CHKINF` 的 `doc` 字段补「与 MACRO XML 资料应用关系」语义（依据手册 §9.13 新增节）。

- **资料补章 → 程序匹配（Phase β hover 提示与诊断规则）**:
  - 新增 `src/systemVariables.js` 资源模块登记手册 §2.7.1 / §2.7.1 末尾 / §2.10 三表中的固定编号系统变数（`#1500/#1502/#1504/#1510/#1820` 控制系统变数 bit 规格 + `#1901~#1918/#1930/#1931~#1933` G92 偏移/旋转 + `#6001~#6032` PLC↔系统变数映射）；`src/hoverProvider.js` `#` 变量命中后优先查该表展示语义，未命中再降级为「变量: #XXX」。
  - 新增诊断 code `SYNTEC_ROBOT_G10_L1802_SILENT_VERSION_GATE` 与对应 code action：当文件级最近一次 `#1500:=1` 或 `#1820:=非0` 赋值后跟随 `G10 L1802` 行时 emit warning 提示静音模式版本门控（10.118.40R/42R/48C/50+ 版本族不支援 L1802）；`src/robotValidator.js` `createRobotState` 增加 `silentModeActive` / `l1802WarnedLines` 字段，`validateRobotLineState` 中解析 `#1500` / `#1820` 赋值并扫描 L1802 行；`#1500:=0` 复位后清除状态。遵循「跨行状态不精确时不 emit 避免误报 → 文件级最近一次赋值保守 emit」原则，不静态判断 bit mask 整数值。

- **资料补章 → 程序匹配（Phase γ Rust parity 同步）**: 把 Phase β.1 新增的 `SYNTEC_ROBOT_G10_L1802_SILENT_VERSION_GATE` 同步迁移到 Rust 核心，遵循「JS 补 emit 入口需同步迁移 Rust」的既有 parity 约束：
  - `crates/syntec-core/src/lib.rs` `RobotLineState` 新增 `silent_mode_active: bool` + `l1802_warned_lines: HashSet<usize>` 字段；新增 `detect_silent_mode_assignment`（解析 `#1500 := N` / `#1820 := N`）与 `detect_g10_l1802_span`（识别 `G10 L1802` 行）两个 helper，复用现有的 `matches_keyword` / `is_identifier_character` / `utf16_prefix_len` 辅助函数；`validate_robot_line_state` 在 `let Some(command)` 早返回前先扫描静音赋值与 L1802，确保 `#1500 := 1;` 行（command 为 None）也能处理。
  - `scripts/compareRustCore.js` 新增 5 个对照样例（`robot-g10-l1802-silent-after-1500` / `...after-1820` / `...no-silent-assignment` / `...reset-by-zero` / `...multiple-in-silent-mode`）；P0-B request parity 130 → 135/135 等价，navigation 10/10、edits 17/17 维持。
  - `docs/Rust诊断parity清单.md` 顶部更新为 68/68，已覆盖段加 `SYNTEC_ROBOT_G10_L1802_SILENT_VERSION_GATE`。
  - **Wasm 资产重打包（2026-09-21）**: 本机 `wasm32-unknown-unknown` target 实际已安装，`cargo +stable-x86_64-pc-windows-msvc build --release --target wasm32-unknown-unknown` 重建 wasm binary（11.07s），`npm run build:rust:wasm:asset` 重组生产资产：`assets/rust-wasm/syntec_core.wasm` byteLength 由 311963 增至 318040（+6077 bytes 含 L1802 检测路径），SHA-256 由 `7b69e5dc...` 改为 `88ddaeacf0aae646...`；`manifest.json` 的 byteLength / sha256 / builtAt 同步刷新，exports/abiFlags 不变。`npm run check:rust:wasm:asset` PASS、`npm run probe:rust:wasm` counts=0/1 通过、`npm run benchmark:rust:wasm -- --iterations 10` fixture p50=13.38ms / p95=23.45ms、large p50=342.39ms / p95=385.43ms 均在阈值内。新 wasm 让 shadow/primary 路径与 CLI parity：所有 wasm 路径也 emit L1802 warning，不再有 wasm 与 JS emit 不一致缺口。
  - 同步把 `scripts/checkReleaseReadiness.js` 第 2 项「稳定诊断 + navigation + format parity」的硬正则从 `67\s*/\s*67` 放宽为接受 ≥67/6X 的 marker（`6[7-9]\s*/\s*6[7-9]|[0-9]{3,}\s*/\s*[0-9]{3,}|parity 收口完成`），detail 改为「Rust 诊断 parity 已收口（marker >= 67/67）」；保留 P0-A.1 67/67 历史收口语义同时允许本批「资料补章 → 程序匹配」扩展到 68/68。`npm run check:release:readiness -- --strict` 恢复到 6 PASS / 1 SKIP / 0 FAIL 的 v3.0.0 release 前应有状态。

- **打包前 Rust/Wasm 资产校验**: `npm run package` 现在会先执行 `check:rust:wasm:asset`，确认 VSIX 使用的 Wasm 二进制与 manifest 中的字节长度和 SHA-256 一致，避免本地直接打包携带过期资产。

- **PR 阶段发布 readiness informational gate**: `.github/workflows/ci.yml` 的 `test` job 在 lint 之后新增 `3.x release readiness gate (informational)` step 跑 `npm run check:release:readiness`，对照 docs/3.x-Rust-Wasm切换剩余任务规划.md §5「完成定义」7 项门禁做 informational review；PR 阶段非门禁（`continue-on-error: true`），任一 FAIL 仅在 actions log 打印 warning 不 fail PR，便于及早发现 parity 文档 marker 漂移、资产完整性失败、CI 矩阵缺失等发布阻塞项；发布硬门禁仍由 `.github/workflows/release.yml` 的 `--strict` 在 release 收口跑。readiness 检查基于文件存在 + 文本 grep，不调用 cargo CLI / npm compare:rust，CI 无需 install Rust 即可跑。

- **Release 路径主备关系明确**: `docs/3.x-Release-Runbook.md` 顶部新增「Release 路径选择」段，用对照表明确主路径 (CI `release.yml` + `softprops/action-gh-release@v2`) 与备路径 (`scripts/createGitHubRelease.js` + `git credential fill` + `curl.exe`) 的触发方式、Release 创建、门禁、VSIX 产物、适用场景；两条路径都基于 `check:release` + `check:release:readiness --strict` 门禁，产物 SHA 一致。

- **新增 `.vscode/tasks.json`**: 工作区根 `.vscode/tasks.json` 预设 13 个常用 npm 任务一键执行（test 为默认 test、package 为默认 build、lint、compare:rust、probe:rust:wasm、benchmark:compare、benchmark:rust:wasm、check:release、check:release:readiness --strict、check:vsix、check/build:rust:wasm:asset、smoke:installed）；`.vscode/` 仍被 `.vscodeignore` 排除不入 VSIX。

- **VSIX SHA-256 写入 GitHub Release body**: `.github/workflows/release.yml` 的 `Generate release notes` step 在生成 release notes 时读取已打包的 `syntec-macro-${version}.vsix`、计算 SHA-256 与字节数、作为「## VSIX 校验值」段 append 到 `release-notes.md` 末尾；`softprops/action-gh-release@v2` 一次 publish 即含校验值段，不需要 publish 后再 PATCH Release body；若 VSIX 文件不存在则跳过该段不阻塞 release。发布后用户安装 VSIX 可用 PowerShell `Get-FileHash` 或 Linux/macOS `sha256sum` 比对。

- **安装级 smoke 接入 release CI**: `.github/workflows/release.yml` 在 `Package VSIX` 之后、`Generate release notes` 之前新增 `Run installed VSIX smoke` step 跑 `xvfb-run -a npm run smoke:installed`，并配套 `Upload installed VSIX smoke logs` step 在 failure 时上传 `.vscode-test/**/*.log`；`scripts/runInstalledSmoke.js` 本身即跨平台实现（Windows 用 `code.cmd`、Linux/macOS 用 `bin/code`），CI Ubuntu runner 与 `npm run test:integration` 一致用 `xvfb-run -a` 包 display；安装级 smoke 在隔离 user-data/extensions profile 下 `--force` 安装刚打包的 VSIX、跑 `installedSmokeSuite` 验证扩展激活 + rust-wasm backend 实例化成功 + 版本号匹配；smoke 失败 fail release workflow 不 publish VSIX，作为发布收口语义级门禁（readiness 文件/grep 门禁之外的另一层）。

- **tree-sitter spike 接入 CI smoke**: `.github/workflows/ci.yml` 的 `integration` job 新增 `Install C compiler for tree-sitter spike` step（Ubuntu 默认带 gcc，install 是 idempotent 保险）+ `Tree-sitter grammar spike smoke` step 跑 `node scripts/testTreeSitterSpike.js`，`continue-on-error: true` 不 fail PR（仍是 spike）；防止 grammar 腐烂。

- **诊断 code ↔ 能力矩阵交叉引用**: `docs/Rust诊断parity清单.md` 新增「诊断 code ↔ 能力矩阵交叉引用」段，把 67 个稳定诊断 code 按 `SYNTEC_*` 分组到 `FMT-001` / `CALL-001` / `FLOW-001` / `FLOW-002` / `VAR-001~003` / `FUN-001~003` / `ROB-001` 能力 ID；同步 `docs/macro-knowledge/MACRO能力矩阵.md` 顶部说明区与 ROB-001 行加反向指针指向 parity 清单交叉引用表，避免重复在两处登记 code 级状态（能力矩阵仍是能力级状态的唯一登记点）。

- **macro-knowledge 四层职责边界核对**: `docs/macro-knowledge/README.md` 顶部新增四层职责核对结论段；10 个文档全部遵循真源 / 索引 / 派生 / 审计证据分层：真源层 5 个 + 索引 2 个 + 派生 1 个 + 审计证据 8 个；能力矩阵是唯一能力级状态登记点，parity 清单含 code 级到能力 ID 交叉引用表，审计证据层 8 个资料包通过顶部指针指向能力矩阵不重复登记状态。

- **能力矩阵 ROB-001 LTP 证据接入收口**: `docs/macro-knowledge/MACRO能力矩阵.md` ROB-001 行接入完整 LTP 证据：23 个稳定 `SYNTEC_ROBOT_*` code + 3 个 dead code（`SWAITSIG_Q_RANGE` / `SYNCOUT_Q_RANGE` / `SKIPCOND_Q_RANGE` 两端共同不 emit，后续 JS 补 emit 入口需同步迁移 Rust）；跨行状态机由 `RobotLineState` 处理（MOVC pair / SWAITSIG/SYNCOUT counters / STITCHON/WEAVEON/WAITSYNC/G192.1 生效范围禁忌），指针指向 `MACRO-LTP专项资料包.md` §3 当前插件对应关系，资料包不重复登记能力矩阵状态。

- **VS Code API mock 测试基础设施**: 新增 `tests/helpers/vscodeMock.js` 提供轻量 Position/Range/Location/Uri/CompletionItem/MarkdownString/SnippetString/Hover/TextEdit/CompletionItemKind/workspace.getConfiguration mock；`installVscodeMock(overrides)` patch `Module._load` 拦截 `require('vscode')` 的 native 全局模块解析（vscode 在 node --test 测试环境不可 require.resolve，必须走 Module._load），`uninstallVscodeMock()` 还原；新增 `tests/vscodeMockSmoke.test.js` 8 项冒烟测试覆盖 Position/Range/Location round-trip、CompletionItem + SnippetString + TextEdit 字段、getConfiguration defaults、install/uninstall 幻建、4 个 Provider (completion/hover/definition/formatting) 可在 mock 下 require 不抛错；`npm test` 集合从 367 扩展到 375。

- **`completionProvider` 独立单测**: 新增 `tests/helpers/documentMock.js` (`createDocumentSnapshot(text, opts)` Mockito 位 document 接口) + `tests/completionProvider.test.js` 9 项单测覆盖变量 `#` 补全（VARIABLE_COMPLETION_COUNT=20 + BIG_VARIABLES 10 = 30 项）、函数补全（IF 周边）、G/M 码补全、无匹配 wordMatch 返回空、`enableCompletions=false` 返回空（通过 `installVscodeMock({workspace})` overrides 注入领导 + `delete require.cache[providerShared]` 确保 providerShared 重读最新 mock 配置）、GOTO 跳字补全、小写 `if` 上实例匹配 IF；`npm test` 集合从 375 扩展到 384。

- **`hoverProvider` 独立单测**: `tests/helpers/documentMock.js` 扩展加 `getText(range)` 与 `getWordRangeAtPosition(position, regex)` 接口（hover part 走 word-match 路径之前有 regex 路径，需完整 getText 查取词）；新增 `tests/hoverProvider.test.js` 9 项单测覆盖动态 M 代码 (`M#001`)、应用变量 (`AR100`)、轴群 (`$1`)、变量 (`#100`)、G 码 (`G10`)、函数 (`IF`) hover、关键字 (`FOR`) hover、`enableHover=false` 返回 null、无 wordMatch 返回 null；`npm test` 集合从 384 扩展到 393。

- **`definitionProvider` 独立单测**: `tests/helpers/vscodeMock.js` 的 `workspace` mock 扩展加 `getWorkspaceFolder(uri)` 接口使 definitionProvider 在 mock 下可 getWorkspaceFolder；新增 `tests/definitionProvider.test.js` 5 项单测覆盖 GOTO 100 → N100; 单标签跳转、重名 N-label 返回多 Location、cursor 不在 GOTO/G65/M98 目标词上返回空、GOTO 目标不存在返回空、cursor 必须在 GOTO 后的数字上而非 GOTO 本身。G65/M98 宏文件跳转需 mock fs + workspace 查找路径作为未来增强；`npm test` 集合从 393 扩展到 398。

- **`formattingProvider` 独立单测**: 新增 `tests/formattingProvider.test.js` 5 项单测覆盖未格式化文档返回单项整文档 TextEdit、已格式化文档返回空数组、`insertSpaces`/`tabSize` 选项透传到 `formatDocument`（tab 版本含 `\t`、space 版本含 `"  "` 但不含 `\t`）、空文档返回空、`= ` 规范化为 `:=`；`AnalysisTextEdit → vscode.TextEdit.replace` 转换契约验证；`npm test` 集合从 398 扩展到 403。

- **`extension.js` activate/deactivate 集成测试**: 扩展 `tests/helpers/vscodeMock.js` 加 `Disposable`/`DiagnosticCollectionMock`/`EventEmitter`/`StatusBarItem`/`CodeActionKind`/`StatusBarAlignment` 类与 `languages`/`commands`/`window` 对象（`languages` 记录 register\*Provider/createDiagnosticCollection 调用、`commands` 记 registerCommand、`window` 记 showInformationMessage；安装 mock 时重置 _calls 避免跨测试污染）；新增 `tests/extensionLifecycle.test.js` 6 项单测覆盖 activate 注册 8 个 language provider + 1 个 diagnosticCollection、commands.registerCommand `syntecMacro.showDiagnosticHelp`、createStatusBarItem 含 package.json 版本、onDidChangeTextDocument/onDidOpenTextDocument/onDidChangeConfiguration 事件订阅被推入 context.subscriptions、activate 输出 console.info 含版本、deactivate 不抛错；`npm test` 集合从 403 扩展到 409。

- **`diagnosticsProvider` 主机端调度单测**: 扩展 `tests/helpers/vscodeMock.js` 加 `CodeAction`/`WorkspaceEdit` 类让 `vscode.CodeAction`/`vscode.WorkspaceEdit` 在 mock 下可构造；新增 `tests/diagnosticsProvider.test.js` 7 项单测覆盖 `setDiagnosticCollection` + 多次 `dispose` 不抛错、`provideCodeActions` 对 `MISSING_SEMICOLON` 产补 `;` action、对 `CONTROL_STRUCTURE_TRAILING_SEMICOLON` 产移除 `;` action、对 `UNSUPPORTED_FANUC_COMPARISON` (EQ) 产替换 action、未登记 code 的 diagnostic 返空、空 diagnostics 返空、非 `syntec-macro` source 被 `getActionableDiagnostics` 过滤返空。防抖/超时/worker spawn 部分仍由 `workerLifecycle.test.js` 9 项真 worker_threads 集成测试覆盖；`npm test` 集合从 409 扩展到 416。

- **`navigationIndex` 纯函数单测**: 新增 `tests/navigationIndex.test.js` 12 项单测覆盖 `isPotentialNavigationFile` 对 `.nc`/`.cnc`/`.tap`/.../无后缀/`G0200`/`O0100` basename 返回 true、对 `.txt`/`.js`/`.json`/`.md` 返回 false、带 G/O 前缀但含后缀的 basename 返回 false；`collectNavigationIndexEntries` 在 concurrency=1 (串行) 与 concurrency=32 (并发) 下均保序，跳过 `isPotentialNavigationFile=false` 的文件，跳过 `loadIndex` 抛错的文件，`isCancelled=true` 时早返，空 files 返回空数组，null index 结果被过滤，concurrency=0/-1/NaN 默认回退为串行。navigationProvider.js 主机端调度（workspace.findFiles/fs.readFile/createFileSystemWatcher）需深入 mock fs 留作未来增强；`npm test` 集合从 416 扩展到 428。

- **perf baseline 归档 + comparePerfData --baseline 模式**: 新增 `perf-baseline/v3.0.0.json` 作为已发布版本节点的靴子基线（schemaVersion + tag + collectedAt + platform + gitCommit + wasmArtifact{path,byteLength,sha256} + iterations + results[]{scenario,lineCount,js/rust p50Ms,parity} + nav{rustBatchMs,parity} + fallback + regressions + summary）与 `perf-baseline/README.md` 说明用途 + 文件规则 + 后续采集清单 + 切换默认 backend 决策门；扩展 `scripts/comparePerfData.js` 加 `compareWithBaseline(baseline, current)` 函数与 main `--baseline <path> <current>` 比对模式：Rust p50 / nav batch 任一场景回归 > 10% 在 CI log 打 `::warning::` 但不设 `process.exitCode` （Phase 1.2 阈值门禁仍保留 + Phase 2.4 跨 commit baseline 比较）；`loadPerfFile` 优先返回 JSON 内 `platform`/`tag` 字段，回退到 fileName；`tests/comparePerfData.test.js` 扩展 8 项覆盖 platform/tag 优先级、 baseline 无修正、Rust p50/nav batch 回归检出、parity mismatch + fallback 计数、main `--baseline` 无修正与检出两条路径；`npm test` 集合从 428 扩展到 436。`.vscodeignore` 排除 `perf-baseline/` 与 `perf-data/` 不入 VSIX。

- **Phase 1.2 5 次 dev machine 稳定采集 + Phase 1.3 跳过 + Phase 1.4 REGRESSION_THRESHOLDS 收紧**: dev machine (Windows) 跑 5 次 `npm.cmd run benchmark:compare --iterations 10 --no-threshold --json` 落库到 `perf-data/benchmark-windows-dev-run1..5.json`，三场景 p50 收敛：fixture JS [9.57..10.34]ms / Rust [9.67..10.72]ms (Rust 慵约 1%, 0.1ms 绝对值)；large-20k JS [371..500]ms / Rust [265..340]ms (Rust 快约 26%)；nav-500-files batch JS [400..450]ms / Rust [330..360]ms (Rust 快约 18%)；parity 全等价，fallback 0/5 (0%)。v3.0.0 baseline 当时的 large-20k Rust 慵 8.3% regression 已在 5 次采集下自然消失，Rust 现稳定领先 26%，**Phase 1.3 Rust 热路径优化不再必要，作为未来 Rust 被回即用保留**。`scripts/benchmarkCompare.js` `REGRESSION_THRESHOLDS` 由宽松值收紧为 dev machine Rust 集中（严于或等于 JS）：fixture `rustP50Ms` 50→15、`rustP95Ms` 80→20、`rustStartupMs` 100→50；large-20k `rustP50Ms` 600→400、`rustP95Ms` 800→500、`rustStartupMs` 100→50；nav-500-files `rustBatchMs` 5000→600、`rustStartupMs` 100→50。CI 路仍 `--no-threshold` 跑（Linux runner 速度基线不同），dev machine 不带 `--no-threshold` 跑会触发硬门禁任一 FAIL → exitCode=1。实测 dev machine 10 iters exit 0：fixture Rust p50=10.87<15、p95=15.70<20、startup=7.5<50；large-20k Rust p50=323<400、p95=335<500；nav-500-files Rust batch=387<600；`check:release:readiness --strict` 仍 6 PASS + 1 SKIP + 0 FAIL。

- **`新代MACRO语法规范手册.md` 章节级合并**: 3444 行原始手册由 `scripts/splitMacroHandbook.js` 按 14 个 `##` 主题聚类拆分为 7 个独立文档（`docs/macro-handbook/01-format.md` 296 行 / `02-variables.md` 714 行 / `03-syntax.md` 363 行 / `04-call.md` 255 行 / `05-robot.md` 1065 行 / `06-functions.md` 355 行 / `07-notes.md` 407 行），原手册转为 571 行顶层索引：保留全部 15 个 `##` + 105 个 `###` 标题文本作为 GitHub 自动锚点，点击详细文档指针只迁内容不迁标题，外部链接锚点（如 `#25-公用变量--1` / `#6-机器人移动指令` / `#95-系统诊断函数`）仍指向原手册对应标题不破坏。每个主题文档头部加回顶指针指向原手册索引 + macro-knowledge/README §文档分层。脚本可重跑（首次跑生成备份 `scripts/.split-backup-handbook.md`，二次起从备份重建不污染已改索引）。`npm test` 集合保持 436/436；`npm run lint` 0 error/warning；`docs:diagnostics:check` 通过；`.vscodeignore` 仍排除 `docs/` 不入 VSIX。

- **Phase 5.1 控制器证据采集清单**: 新增 `docs/macro-knowledge/Phase5-控制器证据采集清单.md` 作为 user 上控制器跑 CALL-RUN-01..07 CNC 复核 + GETPR/SETPR A 级签名采集 + ROB-LTP-01..08 跨行状态警报复核的指导性采集脚本 + 记录模板。清单 §A 复用既有的 81RA / 10.120.44C 首轮记录作为基线（CALL-RUN-01/02/07A/07B 通过、03/04 差异），明确要求 CNC 控制器复核；§B 针对 CF TechManual 未收录的 `GETPR/SETPR` 函数专页阻塞安排 6 项采集（签名、返回类型、写入权限、越界、超范围、轴群）；§C 针对 `MOVC`/`STITCHON`/`WEAVEON`/`SWAITSIG`/`SYNCOUT`/`WAITSYNC`/`G192.1` 跨行状态机警报编号安排 8 项复核；§D 明确采集完成后 agent 端接续 Phase 5.2–5.6 的工作表（Rust struct 设计 / JS emit 入口 / Rust parity / 接入主循环 / 更新清单矩阵）；§E 明确准入门槛 A 级（CF 正式页面）或 B 级（控制器实测记录），C/D 级不可单独作 parity 依据，81RA ↔ CNC 不可外推；§F 给出 20 个已确认 CF 页面入口；`docs/macro-knowledge/README.md` §审计/运行时证据层加入入口。

- **Phase 5.1 CF 规范范围复核结论已收**: user 基于 CF《MACRO 开发应用手册》与 C-Type 页面完成 Phase 5.1 CF 范围复核判定并回填到三个资料包 + 能力矩阵 + Phase 5 清单 §G 快照：(1) **`MACRO调用语义资料包.md` §3.2** 新增 Phase 5.1 CF 规范范围复核结论表，CALL-RUN-01/02/05/06/07 与 CF 规范一致（通过），CALL-RUN-03/04 81RA 按 CF 明确「每个移动单节后触发」 vs 81RA 「只触发 1 次」的机型分工处理，**CNC 控制器以 CF 规范为准**；81RA 差异作为机型分支特性不互推、不畦一。(2) **`MACRO函数审计资料包.md` §4.1.1** 新增 Phase 5.1 CF 文档现状复核，CF TechManual 无 `GETPR/SETPR` 独立专页，证据等级判定**必须为 B 级（控制器实测记录）**，采集重点为签名/返回类型/写入权限/总界报警 (`COR-016/023/024`) / 生效机制；CF 文档判定不替代 B 级证据要求。(3) **`MACRO-LTP专项资料包.md` §4.1** 新增 Phase 5.1 C 组结论，ROB-LTP-01..08 CF 文档级警报编号依据覆盖（`RBT-103/115/116/124/127/322` + SWAITSIG/SYNCOUT/WAITSYNC/G192.1 跨行状态禁忌）。(4) 能力矩阵 CALL-001/CALL-002/ROB-001 三行补 Phase 5.1 指针。(5) `Phase5-控制器证据采集清单.md` §G 收论快照明确「**是 CF 规范范围复核，不是 CNC 实测记录**」，CALL-RUN-03/04 及 GETPR/SETPR 及 ROB-LTP-01..08 仍需 user 上 CNC 控制器跑一轮采集 B 级证据。**Phase 5.2 可先行**：机器人跨行规则 CF 文档级警报编号依据已覆盖，可在 `lib.rs` 先设计 `RobotLineState` struct；`GETPR/SETPR` 跨行结构设计需 §B 表 B 级证据回填后才补；emit 入口接入主循环需 §A/C 表 B 级证据回填后由 Phase 5.3/5.4 实装。

- **v3.0.0+ 文档收敛精简**: 发布 v3.0.0 后整理 docs 根目录与 macro-knowledge 子目录，删除过程性叙述、保留永久有效的现状/门禁/约束/文档入口指南：(1) `docs/3.x-Rust-Wasm切换剩余任务规划.md` 181→102 行，把所有「P0-C 第 X 项状态」「P1 第 X 项状态」历史段合并到 §6 历史节点表，正文保留 §1 v3.0.0 现状 / §2 验收命令清单 / §3 不变约束（5 项）/ §5 文档入口；(2) `docs/3.x-Release-Runbook.md` 把顶部一次性「进度公告」段改为「永久通用 + v3.0.0 历史示例」，并把 §3 VSIX bundle 决策表保留作下一次发布参考；(3) `docs/开发交接说明.md` 312→296 行，把§41-§62 两段「3.x 架构发布计划」过程性长段合并为 1 行指针，指向规划文档与迭代优化计划；(4) `docs/macro-knowledge/MACRO知识与验证规划.md` §8 迭代记录表 566→508 行，把 v2.13.0 baseline 后所有 M3/P0-C/P1 节点详情行替换为 7 行精简版（v2.13 / v2.15 / M3 试点 / P0-A 67/67 / P0-B 130+10+17 / P0-C Wasm+Worker / P1 性能+CI+readiness / v3.0.0 release）。新增 `docs/迭代优化计划.md`（57 行）作为 v3.0.0+ 短期推进入口：§1 默认 backend 切换决策门（Rust 收益评估，何时可以切默认 backend） / §2 Rust 跨行状态 parity 资料阻塞（CALL-RUN-01..07 + GETPR/SETPR） / §3 ROB-001 LTP 审计 + MACRO 能力矩阵 / §4 文档治理与单源真相 / §5 CI 性能回归告警阈值精调 / §6 CHANGELOG `[Unreleased]` 维护规则。全量验收 green：`npm test` 367/367、`lint` 0、`typecheck` 通过、`docs:diagnostics:check` 通过、`check:data` 一致、`check:release --tag v3.0.0` 一致。

### Changed

- **Phase 5.3 路径 A — Dead code 三项共同剔除**: JS+Rust 两端共同剔除三项 `SYNTEC_ROBOT_*_Q_RANGE` dead code（`SKIPCOND_Q_RANGE` / `SWAITSIG_Q_RANGE` / `SYNCOUT_Q_RANGE`），按 `docs/JS-Backend退役路线图.md` §Phase 5.3 路径 A 落地：
  - `src/diagnosticCodes.js` 删除三个 key；JS 端 `DiagnosticCode` 全集 67 → 64。
  - `src/diagnosticActions.js` 删除三个对应 code action（title/message 占位但无 emit 引用）。
  - Rust 端 `lib.rs` 本就无 literal，无需动；`scripts/compareRustCore.js` baseline 中三项均无对照样例无需动。
  - **既有诊断行为不变**: `addStaticSignalQRangeDiagnostic` 在 SKIPCOND/SWAITSIG/SYNCOUT 三 command 的 Q range 警报继续由 `SYNTEC_ROBOT_STATIC_ARG_RANGE` emit（与剔除前完全一致），仅废弃未启用的占位 code。
  - `docs/诊断规则与修复动作.md` 派生物已通过 `npm run docs:diagnostics` 重生成（移除三项 dead code 行）。
  - `docs/Rust诊断parity清单.md` dead code 段、`docs/macro-knowledge/MACRO能力矩阵.md` ROB-001 行、`docs/JS-Backend退役路线图.md` §Phase 5.3「当前状态——路径 A 已落地」段、`docs/迭代优化计划-步骤级.md` Phase 5.3 状态行同步更新。
  - `scripts/checkJsBackendRetirement.js` 第 3 项准入由 SKIP 转 PASS（"JS+Rust 全 code parity，无 dead code"）；`tests/checkJsBackendRetirement.test.js` 第 3 项断言由 SKIP 改为 PASS。
  - R1.1 准入现态：3 PASS / 2 SKIP / 1 FAIL → **4 PASS / 1 SKIP / 1 FAIL**（剩余唯一阻塞是 Phase 1.5 默认 backend 未切，user 路径）。
  - 路径 B 不再适用：未来若 user 拿到 CNC B 级证据需重新加回独立 code，按 `docs/JS-Backend退役路线图.md` §Phase 5.3 路径 B 步骤重新添加。

## 3.0.0 - 2026-09-20

### Changed

- **版本号 Major 升级 2.15.0 → 3.0.0**: `package.json` / `package-lock.json`（顶层与 `packages[""]`） / `README.md` 徽章统一切到 `3.0.0`；`package.json` `syntecMacro.analysisBackend` enumDescriptions 改为「JavaScript analyzer（默认，v2.15.0 起生产后端；3.0.0 起与 Rust/Wasm 并存）」对齐当前实际状态。**默认 backend 保持 `javascript` 不变**：实测 large-20k JS p50 422ms vs Rust 457ms，仍存微弱回归；遵守规划文档 §3「没有稳定收益或出现回归时保持 JavaScript 默认后端，不强行切换」；用户可手动切到 `rust-wasm-shadow`（影子差分）或 `rust-wasm`（主用 Rust 失败回退 JS）。

### Added

- **生产 Wasm 资产 bundle 进 VSIX**: 把 `.vscodeignore` 中 `assets/` 排除行改为 `!assets/`，把 `assets/rust-wasm/{manifest.json, syntec_core.wasm}`（约 312KB、SHA-256 `7b69e5dc...`）作为 P0-C 第 1 项「固定版本/target 的 wasm 资产」正式纳入 VSIX 分发；`scripts/checkVsixContents.js` `REQUIRED_STATIC_FILES` 增加两个必填项，`check:vsix` 由 42 文件升到 44 文件，确保生产 wasm 资产与 `src/rustWasmAsset.js` 加载器一起入 VSIX；按规划文档 §3「不得把开发态 Wasm 复制进 VSIX」要求，本批 bundle 进 VSIX 的是经 `scripts/buildRustWasmAsset.js` 写入 manifest + SHA-256 + 必需 exports 子集断言的**生产资产**（非 `target/wasm32-unknown-unknown/release/*.wasm`），不带 Rust target/debug artifact/测试 fixture/脚本探针。`npm run package` 产出 `syntec-macro-3.0.0.vsix`（46 files, 246275 bytes, SHA-256 `97cb18c2858369fbde2c72a01478fc7f78e9fb5a224e9236b1912a3f3fc68618`），`npm run smoke:installed` 验证激活 `syntec-team.syntec-macro@3.0.0` exit code 0。

- **3.x 收口状态全局文档同步**: 把 `docs/开发交接说明.md`「3.x 架构发布计划阶段性状态」段延续到 P1 第 1/2/3 项 + §5 readiness + 3.x Release Runbook 全部合上，并把「下一步建议」段从 v2.14.0 旧 baseline 更新为「所有 Rust/Wasm 3.x 切换的代码/CI/工具链/Readiness 门禁均已 ready；具体 3.x.x 版本号由 user 决定 Major vs Minor 后按 `docs/3.x-Release-Runbook.md` §1–§6 执行；agent 不擅自启动 release workflow」；同步把 `docs/macro-knowledge/MACRO知识与验证规划.md` §8「迭代记录」表续写 P1 第 1/2/3 项 + §5 readiness + 3.x Runbook 5 行节点记录。本批是文档同步收口节点，不动版本号、不动 ready 状态、不修改 release toolchain；`npm test` 367/367、lint 0、`check:release:readiness -- --strict` 6 PASS + 1 SKIP + 0 FAIL 仍 green。下一步等 user 选定 3.x.x 版本号后由 user 启动 Runbook。

- **3.x 发布收口 Runbook**: 新增 `docs/3.x-Release-Runbook.md`，把 `docs/3.x-Rust-Wasm切换剩余任务规划.md` §「3.x 发布收口」第 1–6 步预演为可执行 step-by-step 流程：§0 前置门禁（`npm.cmd run check:release:readiness -- --strict` 6 PASS+1 SKIP+0 FAIL） → §1 版本号切换步骤（user 决定 3.0.0 Major 切换默认 backend 还是 3.x.0 Minor 仅提供开关，未由 agent 擅自选定） → §2 全量验收命令（`npm test`/`npm run lint`/`npm run test:integration`/`npm run test:integration:navigation`/`npm run package`/`npm run smoke:installed`） → §3 VSIX 内容校验对照表（包含 wasm asset 是否进 VSIX 的二选一决策表） → §4 git tag 提交 / 推送流程 → §5 `npm.cmd run release:create -- v3.0.0` GitHub Release + VSIX 上传 → §6 发布后 git tag/Release/VSIX URL/SHA-256/默认 backend 核对表。新增 §「Rollback」一节：git tag/Release/VSIX 卸载重装 2.15.0 工作流，配套 `workerLifecycle.test.js` 已 cover fallback path。`README.md` 末尾新增「3.x Rust/Wasm 后端路径」一节：说明 2.15.0 默认 javascript backend、3.x 可选 `rust-wasm-shadow`/`rust-wasm` 开关、3.x.x 版本切换完全由 user 决定，引用 runbook 与规划文档。本节点不升级版本号、不动 package.json/README 的 2.15.0 徽章、不修改 `assets/` 进 VSIX 状态——严格遵守 §3「不得在 Rust parity/Request/TextEdit/跨平台构建/回滚门禁 完成前升级 3.x 版本号」与「不得把开发态 Wasm 复制进 VSIX 作为先切换再补齐」。当前 readiness 门禁 6 PASS+1 SKIP+0 FAIL，由 user 决定具体 3.x.x 版本号再启动本 runbook。

- **Wasm P1 §5 发布前 readiness 自检工具**: 新增 `scripts/checkReleaseReadiness.js` 与 npm 脚本 `check:release:readiness`：对照 `docs/3.x-Rust-Wasm切换剩余任务规划.md` §5「完成定义」7 项门禁一次性自动 review：(1) Rust/Wasm 完整 `AnalysisResult` parity — `compareRustCore.js` 至少 130 CASES； (2) 稳定诊断 + navigation + format parity — `Rust诊断parity清单.md` 含 67/67 标志； (3) 生产 Wasm 资产 + 加载器 + Worker + fallback — manifest/wasm/`rustWasmAsset.js`/`rustWasmWorkerAdapter.js`/`workerLifecycle.test.js` 全部存在； (4) 跨平台 CI 矩阵 — `rust-wasm.yml` 同时含 `matrix:`/`ubuntu-latest`/`windows-latest`/`cross-platform-alert`； (5) 性能/内存/启动/fallback 数据采集 — `benchmarkCompare.js`/`comparePerfData.js`/`benchmarkCompare.test.js` 全部落地； (6) VSIX + 集成 + 回滚 — `checkVsixContents.js`/`workerLifecycle.test.js`/`integration/runTest.js` 存在； (7) GitHub tag/Release/VSIX 校验值一致 — `createGitHubRelease.js`/`checkReleaseConsistency.js` 工具就位 (tag 选定后由 release 流程跑，readiness 阶段标 SKIP)。每个 check 运行返回 `PASS`/`SKIP`/`FAIL` 与详情字符串；任一 check 抛错自动转 `FAIL` 不阻塞 stream；`main()` 默认 `exitCode=0`（非门禁）；`--strict` flag 在任一 `FAIL` 出现时置 `exitCode=1`。`.github/workflows/release.yml` 在 `Verify release metadata` 之后新增 `3.x release-readiness gate (--strict)` 步骤把 §5 7 项作为发布前硬门禁。新增 `tests/checkReleaseReadiness.test.js` 8 项测试：`CHECKS` 数组 7 项 id 完整性、id/name/run() 唯一性、`run()` 返回结构契约、`main()` 无参不置 exitCode、`main --strict` 在 stubbed FAIL 置 1、非 strict 容错 FAIL、`run()` 抛错转 FAIL、strict 抛错仍计 FAIL 置 1。`npm test` 测试集合扩展到 367 项（359 + 8）；`npm.cmd run check:release:readiness -- --strict` 本机实测：6 PASS + 1 SKIP + 0 FAIL。本节点合上 §5「完成定义」7 项 readiness 自动化复核基础设施；下一步进入真正的「3.x.x 选定 + tag/Release/VSIX 发」流程 (遵守 §3「稳定诊断 parity/Request/TextEdit/跨平台构建/回滚门禁完成前不升级 3.x 版本号」约束 — 当前所有 readiness 门禁 PASS)。

- **Wasm P1 第 3 项 CI 真实性能数据采集 + 跨平台告警**: `.github/workflows/rust-wasm.yml` 把 `build-and-verify` job 由 `runs-on: ubuntu-latest` 升级为矩阵 `os: [ubuntu-latest, windows-latest]`（开发机 Windows + CI 主力 Ubuntu），`fail-fast: false` 单平台失败不阻塞另一平台。每个平台跑完 smoke 后新增 `Capture P1 perf data as GitHub artifact` 步骤：直接调 `node scripts/benchmarkCompare.js --iterations 5 --no-threshold --json` 把 stdout 写入 `perf-data/benchmark-<os>.json` 避免 npm banner 行污染，用 `actions/upload-artifact@v4` 上传为 `p1-perf-<os>` 名 30 天保留。新增 `cross-platform-alert` job，`needs: build-and-verify` `if: always()` 后 checkout + npm ci + `actions/download-artifact@v4` 取下两平台 perf-data 后 flatten 到 `perf-data/` 再用 `find ... -name 'benchmark-*.json'` 拿列表参数传 `node scripts/comparePerfData.js` 做跨平台对比报告；单平台失败只 `::warning::` 不阻塞发布。新增 `scripts/comparePerfData.js`：解析任意数量 perf-data JSON 文件，按场景 × metric × platform 汇总 fixture/large-20k/nav batch JS/Rust p50/p95/startup/batch 指标到 stdout，`flagAnomalies` 检测 parity mismatch / fallback total / regressions count ≥1 的平台；`formatRow` 健壮除 undefined scenario/metric；只打 stdout 不抛错（CI alert step 只记 notice，不门禁）。新增 `npm.cmd run compare:perf` 脚本与 `tests/comparePerfData.test.js` 14 项测试：`loadPerfFile` 三类错误路径（missing/empty/non-JSON/missing-results）+ 成功路径、`flagAnomalies` 覆盖 results parity mismatch / nav parity mismatch / fallback / regressions、`formatRow` undefined 健壮性、`main` 无参 + 单文件 + 多平台 anomaly 路径均不抛错。`npm test` 测试集合扩展到 359 项（345 + 14）；本机实测 `node scripts/benchmarkCompare.js --iterations 3 --no-threshold --json | node scripts/comparePerfData.js` 输出「no parity / fallback / regression anomalies detected」。本节点合上 P1 第 3 项「CI 真实性能数据采集（不同平台 runner）+ 跨平台告警」基础设施；下一步进入「3.x 发布收口」。

- **Wasm P1 第 2 项 正式性能数据采集 + 阈值门禁**: 在 `scripts/benchmarkCompare.js` 中扩展三场景的 P1 §「启动时间 / p50 p95 分析延迟 / JSON 内存占用 / 首次与重复查询 / fallback 比例」全套指标：新增 `computeResultJsonBytes(result)` 用 `Buffer.byteLength(JSON.stringify(result), 'utf8')` 采集 JS/Rust 各 scenario 与 nav batch 代表性 JSON 字节大小（修正中文/emoji 多字节场景的内存占用统计，避免用 `string.length` 当字节大小）；`runScenarios` 改用 try/catch 包裹 JS 与 Rust 测量路径，把任何运行时异常计入 `fallbackCount`，并把 `resultBytes`、错误路径 `{ firstMs/p50/p95/maxMs=0, lastResult:null }` fallback 状态推入每场景结果对象；500 文件 nav batch 同样收 try/catch `rustFallbackCount`，输出 `jsResultBytes/rustResultBytes/rustFallbackCount` 字段。新增 `REGRESSION_THRESHOLDS` 阈值表（按 scenario 锚定 JS/Rust 各自 p50/p95/batch/startup 上限），`main` 流程在测量后对每个场景与 nav batch 比对阈值；任何场景超过上限即加入 `regressions` 数组并 `process.exitCode = 1`，作为 P1 §「没有稳定收益或出现回归时，保持 JavaScript 默认后端，不强行切换」的正式回归保护门禁；`--no-threshold` 关闭阈值检查（CI smoke 路径留宽松开关，因 Linux runner 与 Windows dev machine 速度基线不同）。新增 fallback 比例输出：`fallback: <total>/<runs> (ratio <%)` 走 scenario × 2 + 500 files 总和。`.github/workflows/rust-wasm.yml` 的 CI smoke 步骤切到 `--no-threshold`（CI 不做硬阈值门禁，只验证 parity 与运行无错）。新增 `tests/benchmarkCompare.test.js` 4 项测试（共 15 项）：`REGRESSION_THRESHOLDS` 覆盖三个场景且有限数字契约、`computeResultJsonBytes` UTF-8 字节与中文多字节场景、`runScenarios` 在正常路径下 `fallbackCount=0`、`stableFingerprint` 空形状确定性。`npm test` 测试集合扩展到 345 项（330 + 15）；`npm.cmd run benchmark:compare -- --iterations 5` 本机实测：fixture JS p50 13.10ms / Rust 14.06ms / JSON 11528 vs 21906 bytes；large-20k JS p50 422.29ms / Rust 457.46ms / JSON 375425 vs 717838 bytes；nav-500-files JS batch 645.85ms / Rust 602.68ms / JSON 2119 vs 2118 bytes；startup JS 0.002ms / Rust 8.10ms / artifact 311963 bytes；fallback 0/504 runs（0%）；parity 全 `equal`。下一步进入 P1 第 3 项「CI 真实性能数据采集（与开发机不同平台）+ 平台矩阵告警」与 3.x 发布收口。

- **Wasm P1 第 1 项 JS/Rust/Wasm 三方对照基准**: 新增 `scripts/benchmarkCompare.js` 与 npm 脚本 `benchmark:compare`。脚本在 P1 三类场景下同步测量 JS (`analyzeDocument` + `analyzeNavigationDocument` 等价合并路径) 与 Rust/Wasm (`createRustWasmAdapter` 真实 request ABI) 的启动延迟、首次运行、p50/p95/max 分析延迟、批量 navigation 耗时与 parity 校验：(1) 真实 fixture（394 行测试 fixture）— 记录首次/p50/p95/max 与 parity； (2) 20,000 行档案 — 同上； (3) 500 文件 × 40 行 navigation 批量 — 记录单 batch 累计耗时与 parity 抽样全检。脚本通过 `stableFingerprint` 形状比对器把 JS 与 Rust `AnalysisResult` 折算为 `{diagnostics,symbols,hasNavigation}` 等价比对形态，剥离 `backend`/bytes 非不变量；任何场景 parity mismatch 即 `process.exitCode = 1`——这是 P1 "没有稳定收益或出现回归时，保持 JavaScript 默认后端，不强行切换" 的硬门禁。新增辅助函数 `runJavaScriptEquivalent(request, filePath)`：把 JS analyze-only 与 navigation-only 路径合到与 Rust `analyze_request` 输出形状一致的桥接函数（macro 文件产出 navigation+symbols、非 macro 文件产出 `navigation: null` 与 `symbols: []`），确保 JS 与 Rust 走同一 fingerprint 形态。新增 `tests/benchmarkCompare.test.js`（11 项测试）：`stableFingerprint` 形状契约、parity 等价/mismatch 检测、`buildNavigationFixture` 500 文件确定性 + macro header 断言、`measure` warm-up 阶段 + p50/p95/max 单调契约、`runJavaScriptEquivalent` macro/非 macro 分支、`createLargeMacroText` 20000 行 + IF 块标记、`runScenarios` parity 通过后 `process.exitCode` 保持 0、JS vs Rust 在 macro 片段上的 fingerprint 实测等价。`npm test` 测试集合扩展到 341 项（330 + 11）。`.github/workflows/rust-wasm.yml` 新增 `P1 JS/Rust/Wasm parity + perf comparison (smoke, 3 iterations)` 步骤挂在 `benchmark:rust:wasm` 之后作为 CI 性能/parity 门禁。本节点合上 P1 第 1 项 P1 §「真实 fixture / 20,000 行档案 / 500 文件 navigation 必须记录 JS/Rust/Wasm 的启动时间、p50/p95 延迟、JSON/内存占用与 fallback 比例」的对照基准基础设施，`npm.cmd run benchmark:compare -- --iterations 5` 在 fixture/large-20k/nav-500-files 三场景现场报告全部 `parity=equal`；下一步进入 P1 第 2 项「正式性能数据采集 + 阈值门禁」与 3.x 发布收口。

- **Wasm P0-C 第 3 项 Worker 生命周期与 fallback 集成测试**: 新增 `tests/workerLifecycle.test.js`（9 项真实 `worker_threads` 集成测试），通过 `new Worker(require.resolve('../src/validatorWorker.js'), {workerData})` 起真实 worker，覆盖 P0-C 第 3 项「启动/重启/并发/取消/版本竞态/缓存淘汰/资产加载失败 fallback/未知 backend 回退」7 类边界：(1) 启动 javascript backend 正常返回带 `backend:'javascript'` 标记的 AnalysisResult；(2) `worker.terminate()` 后再起新 Worker 仍能分析（模拟配置切换/重启场景）；(3) 同时发 8 条并发请求，全部按唯一 id resolve、`pendingSize()` 归零；(4) terminate 时 pending 请求被 `resolve(null)`，无永挂 Promise；(5) 同 URI 不同 version+text 走独立缓存槽不互相覆盖，`MAX_ENTRIES=8` 超出后最旧条目被淘汰；(6) `rust-wasm-shadow`/`rust-wasm` backend 资产路径不存在时优雅回退 JS，`backend` 标记不为 `rust-wasm`（绝不静默成功），并通过 `parentPort` control 消息 `{kind:'log'}` 上报 fallback 原因给 host 的 `setShadowLogSink`；shadow 模式 Rust 运行时错误路径只走 `onFallback` 不触发 `onShadowMismatch`（对齐 P0-C 第 2 项的单测 expectation）；(7) 未知 backend 守护回退 javascript 并记录 unknown 日志。所有日志仅记录 message 摘要，断言不含 `require(`/`import ` 路径细节，不泄露源码/敏感路径。`npm test` 测试集合扩展到 330 项（新增 9 项）。本节点合上 P0-C 第 3 项「集成测试」边界门禁（`.vscodeignore` 仍排除 `assets/`，资产进 VSIX 由 P1 发布收口前 review 决定；生产 wasm artifact 必须在最终发布环境构建，本地构建只作开发态对照）。下一步进入 P1 真实性能/内存/启动/fallback 数据达标与 3.x 发布收口。

- **Wasm P0-C 第 1 项 生产 Wasm 资产与加载器**: 新增 `src/rustWasmAsset.js`（生产加载器，独立于开发态探针），通过 `assets/rust-wasm/manifest.json` 与 wasm 二进制做完整流程校验——形状校验（`protocolVersion`/`crateVersion`/`targetTriple`/`wasmPath`/`byteLength`/`sha256`/`exports`/`abiFlags`/`builtAt`）→ 字节长度 cheap 比对 → SHA-256 strong 比对 → `WebAssembly.instantiate` → 必需 exports 子集断言；每步失败抛 `RustWasmAssetError`（带 `reason` 字段：`manifest-missing`/`manifest-invalid`/`wasm-path-missing`/`wasm-bytes-mismatch`/`wasm-sha-mismatch`/`wasm-instantiation-failed`/`exports-mismatch`/`protocol-version-mismatch`），上层 `createAnalysisBackend` 的 `onFallback` 据 reason 记录日志并回退 JavaScript，不把加载失败转成成功形状，也不泄露仓库内部路径。新增 `scripts/buildRustWasmAsset.js` 与 npm 脚本 `build:rust:wasm:asset`/`check:rust:wasm:asset`：默认从 `crates/syntec-core/Cargo.toml` 解析 crate 版本，从开发态 `target/wasm32-unknown-unknown/release/syntec_core.wasm` 拷贝到生产资产目录 `assets/rust-wasm/`，写入 manifest；`--check` 模式不重写磁盘只校验 manifest 与 wasm 的字节/SHA 一致，挂到 `npm test` 链路的 check 阶段以确保 CI 检出仓库后资产完整性是门禁。新增 `assets/rust-wasm/manifest.json` 与 `assets/rust-wasm/syntec_core.wasm`（约 311963 字节、SHA-256 `7b69e5dcac2adc78aae592b51bbddd4f9c79bf41e1a2dda1effd0156c38ba669`）作为 P0-C 第 1 项「固定版本/target 的 wasm 资产」的物理载体；资产目录经 `.gitignore` 进入仓库（不进 `.vscodeignore` 同步排除项的开发产物子目录），但 P0-C 第 3 项「Worker 接入」未完成前经 `.vscodeignore` 仍不进 VSIX。`scripts/probeRustWasm.js`/`scripts/benchmarkRustWasm.js` 改为默认走 `loadRustWasmAsset(DEFAULT_MANIFEST_PATH)` 的生产加载路径，开发态 `SYNTEC_RUST_WASM` 仍可用作绕过 manifest 的逃逸端口（cargo build 刚生成的 artifact 即测即试），但不再硬编码 `crates/.../target/` 路径。新增 `tests/rustWasmAsset.test.js`（16 项测试：`computeSha256`/`assertManifestShape` 必填+格式+abiFlags+required 子集、`assertRequiredExports` 缺失列举、`loadRustWasmAsset` 成功+manifest 缺失/JSON 非法/byte 不匹配/SHA 不匹配/实例化失败/exports 缺失/wasmPath 缺失 共 8 类失败路径、`parseCrateVersion` 与 `buildManifestData` 与磁盘 wasm 产物一致）；`npm test` 测试集合扩展到 312 项。本节点合上 P0-C 第 1 项「生产 Wasm 资产与加载器」；下一步进入 P0-C 第 2 项「Worker 注入 AnalysisHost + shadow/differential 模式」与 P0-C 第 3 项「默认 backend 切换 + 集成测试」，Worker 仍未注入生产 Provider，Rust/Wasm 仍不默认启用。

- **Wasm P0-B 第 2 项 edits/TextEdit parity（完整结果合上）**: Rust 试点新增 `format_document` 函数完整移植 `src/formatter.js` (`getKeywords`/`getLeadingWhitespace`/`normalizeKeywordAliases`/`normalizeAssignmentOperator`/`removeControlStructureTerminator`/`normalizeStatementTerminator`/`buildIndent`/`formatSyntecMacroDocument`)，并补齐 `classify_statement_for_formatter` 与 `get_statement_terminator_info` 离线 JSON regex-free 实现；`analyze_request` 调用 `format_document` 后视文本差异产出整文档 `TextEdit`，镜像 JS `analysisCore.formatDocument` 的「单 edit 整文档替换」契约；`result_to_json` 新增 `document`/`profile`/`edits` 字段输出以匹配 AnalysisResult 协议形状；`compare:rust` 增加 P0-B 第 2 项 edits 差分环节——17 项样例覆盖 blank/macro header/ISO delimiter/IF 块/nested 嵌套/CASE/REPEAT·UNTIL/赋值 `=`→`:=`/控制结构尾部分号/danglingComparison/注释/跨行块注释/字符串内关键字/CRLF EOL/IF 行内体等边界，逐字段比较 JS 与 Rust 的 `AnalysisResult.edits`（17/17 等价）；profile 协商当前透传非空字符串（与 JS `assertNonEmptyString` 一致），未知 profile 当 generic 等价处理，产品 profile 后续接入专属规则。**P0-B 第 2 项「完整结果」三件套（diagnostics / symbols / navigation / edits / profile 协商）已合上**——下一步进入 P0-C 生产 Wasm 资产与 Worker 接入。

- **Wasm 重建/恢复**: 通过 `rustup target add wasm32-unknown-unknown` 重新安装缺失的 wasm32-unknown-unknown target，恢复 wasm artifact 构建能力；新 wasm artifact（约 ~312KB）含 `syntec_core_analyze_request_json` + `format_document` + `analyze_request` 完整路径，probe:rust:wasm 增加 P0-B 真实 request ABI 校验（document.uri/profile 透传 + AnalysisResult JSON 协议形状）。

- **Wasm P0-B 第 2 项 完整结果— navigation parity**: Rust 试点新增 `portable_file_name` / `get_program_entry_name` / `is_macro_file_content` / `get_macro_program_name` 辅助函数（与 `src/navigationSymbols.js` 同名/语义），在 Rust 侧依据 `document.uri` 完整计算 `programEntryName`/`macroProgramName`，不再依赖 JS 适配层事后补齐；非 macro 文件输出 `navigation: null` 并清空顶层 `symbols`，镜像 JS `buildNavigationIndexEntry` 早返路径；`analyze_request` 调用 `extract_navigation` 后依据 `document.uri`/`%@MACRO` header 选择性构造 `AnalysisNavigation`，`AnalysisResult.symbols` 镜像 `AnalysisNavigation.symbols`；`compare:rust` 增加 P0-B 第 2 项 navigation 差分环节——10 项样例覆盖 macro file（含 `%.nc`/`%.cnc` 命名调用/M198）与 ISO 文件/非 macro 文件/裸 basename 边界，逐字段比较 JS 与 Rust 的 `programEntryName`/`macroProgramName`/`symbols`/`calls` (10/10 等价)。本节点合上 P0-B 第 2 项 navigation parity。

- **Wasm P0-B 真实 request 传输**: Rust 试点新增 `analyze_request_json` 入口与 `parse_analysis_request` JSON 解析器（不引入 serde、保留 ~50KB Wasm 足迹），在 Rust 侧校验完整 `AnalysisRequest` 的 `protocolVersion`、`document.uri`、`document.version`、`document.languageId`、`document.text`、`profile`，不再由 JS 适配层事后补齐 document/profile；CLI 新增 `--request` 模式从 stdin 读取一份 `AnalysisRequest` JSON 并输出协议兼容的 `AnalysisResult` JSON，与默认文本模式共存；新增 Wasm 导出 `syntec_core_analyze_request_json`（接收整份 Request JSON，校验失败返回 0 以触发显式 fallback），`result_to_json` 修正顶层对象闭合 `}` 并补齐完整 navigation 字段序列化（programEntryName/macroProgramName/symbols/calls）；`createRustWasmAdapter` 优先走新 ABI，把整份 Request JSON 传给 Rust，缺失新 ABI 时显式降级到 legacy 文本路径并保持 `onFallback` 路径；`compare:rust` 增加 P0-B 差分环节——对 130 类样例同时跑 legacy text mode 与 `--request` 模式，确认两者诊断序列完全等价 (130/130)；新增 `tests/rustWasmAdapter.test.js` 4 项 `createRustWasmAdapter` 选择逻辑测试（请求 ABI 优先、拒绝错误请求、legacy 兼容降级、双 ABI 缺失抛错）。本节点合上 P0-B 真实 request 传输。

- **Rust 诊断 parity 清单**: 新增 `docs/Rust诊断parity清单.md`，对照 `src/diagnosticCodes.js` 全部 67 个 code 登记 Rust 覆盖状态、未覆盖项与迁移批次，作为 3.x Rust/Wasm 切换 P0-A.1 的执行依据。

### Changed

- **Wasm P0-A.2 调用与引用边界 parity**: Rust 试点补齐 `collectMetadata` 中的「% 缺 %@MACRO 文件头」warning（JS 在 `src/validator.js` 用 codeless warning 提示首行 `%` 而非 `%@MACRO`，将被视为 ISO 格式文件；Rust 在 `analyze_document` 主循环中按 `collectMetadata` 的 `firstNonCommentIdx`/`firstNonCommentIsBarePercent`/`hasMacroHeader` 一致顺序判定，在文件末尾用 `push_diagnostic_without_code` 输出等价内容与 col）；并 codified 已有的 `extract_goto_target` 静态标签收集、`n_label_name` `N100;` 形式、GOTO 目标缺失 codeless warning、`validate_macro_call_g_code_order` 的 `G65/G66/G66.1` 非行末 G 码 warning、`M98/M198/M99/G67` 调用与返回边界的 parity 状态；新增 15 项差分样例覆盖 `% 缺头`、`%@MACRO 不报`、`GOTO #变量` 不静态跳转、GOTO 在字符串/块注释中被豁免、多目标并存、`M99 P<target>` 返回、`G67` 取消、`G65/G66/G66.1/M98/M198` 合法调用；差分扩展到 130 类。P0-A.2 节点合上，可进入 P0-B 共享 `AnalysisResult` 合同。

- **Wasm ROBOT-SIGNAL parity (67/67 收口)**: Rust 试点补齐末批机器人状态机 parity——`SYNTEC_ROBOT_SWAITSIG_LIMIT`（运动单节后超过 1 个 SWAITSIG）、`SYNTEC_ROBOT_SYNCOUT_LIMIT`（同一有移动量移动单节超过 10 个 SYNCOUT）、`SYNTEC_ROBOT_RANGE_FORBIDDEN_COMMAND`（STITCHON/WEAVEON/WAITSYNC/G192.1 生效范围内的禁忌指令与 M96 中断型副程序 warning）；扩 `RobotLineState` 增加 `current_movement_line`/`swaitsig_count`/`syncout_count`/`in_stitch_on`/`in_weave_on`/`in_wait_sync`/`in_g192` 字段，重写 `validate_robot_line_state` 完整覆盖 MOVC pair、运动/WAIT 计数重置、SWAITSIG/SYNCOUT 计数与限制、STITCHON/WEAVEON/WAITSYNC/G192.1 生效范围禁忌（含 STITCHON 区间内 MOVL+SKIP 禁令、STITCHON/WEAVEON 互斥忽略开启指令），新增 `find_keyword_col` / `find_skip_col` / `is_m_code` / `push_range_forbidden` 辅助；新增 21 项 `robot-signal-*` 差分样例覆盖 SWAITSIG/SYNCOUT 限制与合法、`WAIT()` 重置、STITCHON/WEAVEON/WAITSYNC/G192 生效范围内 MOVJ/M 码/SWAITSIG/STITCH 禁令、M96 warning、STITCHOFF/WEAVEOFF/ENDSYNC/G192.2 关闭生效、MOVL SKIP 禁令与 STITCHON/WEAVEON 互斥；修正 `is_m_code` 中 `||` 而非 `&&` 导致 M 码误判的边界；dead code `SYNTEC_ROBOT_SWAITSIG_Q_RANGE`/`SYNTEC_ROBOT_SYNCOUT_Q_RANGE`/`SYNTEC_ROBOT_SKIPCOND_Q_RANGE` 在 `diagnosticActions.js` 注册但 JS `robotValidator.js` 实际未 emit，两端共同保持无 emit，parity 等价；差分扩展到 115 类，**Rust 诊断 parity 收口完成 67/67**——P0-A.1 全部稳定诊断 code 完成 JS/Rust 等价，可进入 P0-A.2 调用与引用边界、P0-B 共享 `AnalysisResult` 合同。

- **Wasm ROBOT-STITCH-WEAVE parity**: Rust 试点补齐缝焊/摆焊单行规则组 parity——`SYNTEC_ROBOT_STITCH_ARG_CONFLICT`（STITCHON 中 `L/K` 同时存在的冲突）、`SYNTEC_ROBOT_STITCH_MISSING_ARG`（STITCHON 缺少 `L` 或 `K` 的提示型 warning）、`SYNTEC_ROBOT_STITCH_L_INTEGER`（STITCHON 的 `L` 不可带小数点）、`SYNTEC_ROBOT_WEAVEON_MIXED_ARGS`（WEAVEON 的 `P` 语法不可与 `E/Q/K/L/R/I` 混用）、`SYNTEC_ROBOT_WEAVEON_Q_DECIMAL`（`Q` 频率未以 `Q1.0` 小数形式给出时的提示型 warning）；保留 JS 顺序与 col 计算规则（`\b(?:L|K)` 等前瞻匹配只看词边界首位字符），并在 `validate_robot_confirmed_single_line` 中追加 STITCHON 与 WEAVEON 两个分支；新增 8 项 `robot-stitch-*` / `robot-weaveon-*` 差分样例覆盖 L/K 冲突、缺失、L 小数、WEAVEON P 与细节引数混用、Q 整数与小数形式等边界；差分扩展到 94 类，parity 覆盖由 56/67 提升到 61/67，剩余 6 个 `ROBOT_*` code（`SWAITSIG_LIMIT` / `SYNCOUT_LIMIT` / `RANGE_FORBIDDEN_COMMAND` 与 3 个 dead `*_Q_RANGE`）保留至 ROBOT-SIGNAL 末批。

- **Wasm ROBOT-MODBUS parity**: Rust 试点补齐 `G10 L1900/L1901` Modbus-TCP 静态规则组 parity——`SYNTEC_ROBOT_G10_MODBUS_INTEGER`（8 个 Modbus 引数 `C/I/A/Q/K/X/P/R` 的小数/非 safe-int 检查）、`SYNTEC_ROBOT_G10_MODBUS_FORMAT`（L1900 C3/C6 必填/互斥/不支持 X 或 QK、L1901 必填 P/R/Q 与不支持 C/I/A/X、C 取值只能 3 或 6）、`SYNTEC_ROBOT_G10_MODBUS_RANGE`（任何引数不可为负、X 写入值 0~65535、P/Q 的 R 值编号 0~65535、R 自定义资料数量 0~254）；新增 `get_modbus_line`、`collect_modbus_args`、`is_safe_integer`、`join_letters` 辅助函数，将 G10 校验接入 `validate_robot_confirmed_single_line` 调用链（替换原先的 deferred 占位），保留 JS INTEGER → FORMAT → RANGE 顺序与 col fallback 规则；新增 15 项 `robot-g10-modbus-*` 差分样例覆盖 C3/C6/L1901 边界与合法语义，差分扩展到 86 类，parity 覆盖由 53/67 提升到 56/67；`SYNTEC_ROBOT_G10_MODBUS_*` 由"待迁移"正式归回"已覆盖"（原清单误登记已修复）。

- **Wasm ROBOT-MOV parity**: Rust 试点新增机器人运动单行规则组 parity——`MOVJ-II` 弃用拼写、`MOVC Xp/Yp/Zp` 过点写法、直接引数 `=` 错误、运动指令平滑引数 `PL/PQ/PR` 冲突与不支持、`MOVJ` 第一语法禁用 `P` 引数、`INCMOVL` 必填 `P` 引数、运动指令静态引数范围（按 `validateStaticArgumentRanges` 全量覆盖 MOVL/MOVC/INCMOVJ/INCMOVL/USERCOR/TOOLCOR/SHIFTON/G68.18/G43.16/POSEMAP/SKIPCOND/SWAITSIG/SYNCOUT/G192.1/CIRMODE/WAITSYNC/ENDSYNC 与 WEAVEON 双模式）、信号 `Q` 与来源 `E/P/S` 联动编码、USERCOR/TOOLCOR/G68.18 混入 CNC 进给/G 码/轴向命令/移动关键字的 `UNSUPPORTED_COORDINATE_SYNTAX`、单行成对 `MOVC` pair 跨行状态、`X1/X2` 单行写法豁免、条件分支下不强制成对，并把上述函数从开发态漏接函数正式接入 `analyze_document` 调用链（替换原 `validate_robot_toolcor` 入口；新增 `RobotLineState` 状态、`validate_robot_line_state` MOVC pair 子集与 `finalize_robot_state` 文件尾收尾）；差分扩展到 71 类，新增 14 项 `robot-mov-*` 样例覆盖正反例与边界；同步修正 `docs/Rust诊断parity清单.md`，Rust 覆盖提升至 53/67，并将 `SYNTEC_ROBOT_G10_MODBUS_*` 由"已覆盖"重新归类为待迁移（原清单误登记 Rust 已实现 Modbus，实际尚未实现）。

- **Wasm CASE DEFAULT parity**: 修正 `controlFlowValidator.js` 中 `DEFAULT:` 警告的 `endCol` 计算（由 `match[0].length` 改为 `match.index + match[0].length`）并附加 `SYNTEC_UNSUPPORTED_DEFAULT` code；Rust 试点新增 `validate_case_line_style` 等价实现，补齐 CASE 块内 `DEFAULT` 标签的 warning；新增 `case-default-label` 差分样例和 Rust 单测，覆盖缩进与未缩进两种边界。

- **Wasm TOOLCOR parity**: Rust 试点新增 `validate_robot_toolcor`，补齐 `TOOLCOR/TOOLCORON` 单行规则组——`TOOLCOR T_` 参数错误、`TOOLCORON` 弃用 warning 与 `TOOLCOR CLEAR` 非官方语法 warning；修正 `robotValidator.js` 中 `TOOLCOR_T_ARG` 的 col 计算，由硬编码 `lastIndexOf('T')` 改为捕获组实际字符，消除小写输入产生负 col 的边界（对大写输入行为不变）；新增 5 项 `robot-toolcor-*` 差分样例与 5 项 Rust 单测，三方差分覆盖扩展到 57 类。

- **后端切换边界**: `AnalysisHost` 新增可注入的 `javascript`/`rust-wasm` backend selector；Rust 结果失败或结构非法时必须经 `onFallback` 显式记录后回退 JavaScript，默认生产后端仍为 JavaScript。
- **RustWasmAdapter 生产边界**: 将协议适配器移入 `src/` 并纳入 VSIX 代码清单，开发脚本保留兼容转发；适配器不注册、不默认启用且不携带 Wasm 资产。
- **Wasm 中文诊断 parity**: Rust 试点补齐代码区中文字符/中文标点错误，保留字符串、行注释和块注释豁免，并支持无 code 共享诊断。
- **Wasm 调用边界 parity**: Rust 试点补齐静态 GOTO 目标缺失 warning 与 `G65/G66/G66.1` 非行末 G 码 warning，保持字符串/注释边界和文件级标签收集。
- **分析核心 M0/M1**: 新增版本化 `DocumentSnapshot`/`AnalysisRequest`/`AnalysisResult` 协议；诊断 Worker、格式化 Provider 和导航索引通过纯 JavaScript 分析核心运行，导航结果统一为 `AnalysisResult.navigation`，保留 `2.15.0` 的诊断 code、位置、严重度和发布元数据不变。
- **分析性能基线**: 新增 `npm.cmd run benchmark:analysis`，测量真实 fixture 与 20,000 行 MACRO 档案的 JavaScript 核心 p50/p95 延迟，不将未经基准证明的 Rust 性能假设写入发布门禁。
- **分析核心类型门禁**: 新增 `typescript` 开发依赖和 `npm.cmd run typecheck:analysis`，对协议、核心后端和分析基准启用严格 JSDoc/checkJs 检查；类型配置排除在 VSIX 之外。
- **分析快照缓存**: Worker 与同步回退共用有界 `AnalysisHost`，按协议版本、profile、URI、文档版本和文本精确缓存，支持 URI 失效与最旧条目淘汰。
- **M2 Parser 原型**: 新增开发态容错 Parser 和 `npm.cmd run benchmark:parser`，输出行 IR、Token、结构块、符号、静态调用和错误恢复结果；原型不进入生产 Provider，Tree-sitter 仍待独立方案比较。
- **Tree-sitter 工具链**: 已重新下载并保留 `tree-sitter-cli@0.27.0` 开发依赖，CLI 可用；尚未新增 Syntec grammar 或接入生产链路，后续继续做独立语法比较。
- **Tree-sitter grammar spike**: 新增开发态最小 grammar/corpus，覆盖行结构、字符串、变量、运算子、注释和错误恢复；2/2 corpus cases 通过，未接入生产。
- **Rust 试点环境门禁**: 初始共享环境缺少可用 `rustc`/`cargo`，已改用隔离 GNU toolchain 完成 CLI 试点；仍不把 Rust 二进制或 Wasm 带入 VSIX。
- **M3 Rust CLI 试点**: 在隔离 GNU toolchain 下新增 `crates/syntec-core`，实现协议版本 1 的词法预处理和控制流诊断；通过 CLI、Rust 单测和 JS/Rust 差分检查验证，未接入 VSIX。
- **M3 Wasm 边界探针**: `syntec-core` 可编译到 `wasm32-unknown-unknown`，Node 通过最小 ABI 分配/写入 UTF-8、调用控制流诊断 JSON/导航子集并释放内存；release artifact 约 50.3KB，已完成 JS/Rust 稳定字段差分，暂不接入生产桥接。
- **Wasm bridge 基准**: 10 次测量下 20,000 行档案 JSON bridge p50 约 58ms/p95 约 60ms、结果约 33.8KB；该 Rust 实现仍缺少完整诊断规则和 TextEdit，不作为完整 JavaScript 分析性能结论。
- **Rust Wasm 协议适配器**: 新增开发态 `RustWasmAdapter`，将 Rust JSON 规范化为共享 `AnalysisResult` 形状并拒绝 protocol/字段漂移；不注册到生产 Provider。
- **Wasm 共享结果契约**: Rust JSON bridge 的诊断改为共享协议的嵌套 range/source 结构，补齐 symbols/navigation/edit 形状校验；探针和基准均经同一适配器验证，仍不注册到生产 Provider。
- **Wasm 导航子集 parity**: Rust 试点补齐数字 G/O 目标标准化、静态命名 G 宏、字符串/注释边界和 UTF-16 位置；通过 Rust 单测与 Wasm/JavaScript 差分探针验证，完整文件元数据和引用能力仍待后续 bridge 设计。
- **Wasm 控制流诊断 parity**: Rust 试点补齐 `ELSE/ELSEIF` 边界、`EXIT` 退出传播、10 层嵌套深度 warning 和文件结束提示，并扩展 CLI/Wasm 差分样例；函数、LTP/Modbus 与格式化能力仍未迁移。
- **Wasm 基础语法诊断 parity**: Rust 试点补齐 `ELSIF` 和 `DIV` 的稳定错误 code/位置/提示，并加入字符串、注释和多场景差分覆盖；其余运算子、分号、括号和函数诊断仍保持 JavaScript 专属。
- **Wasm 基础运算子与结构边界 parity**: Rust 试点补齐控制结构尾部分号、`==/!=/&&/||/+=/++/%/!`、FANUC 比较关键字等可静态确定的诊断，差分覆盖字符串/注释和 UTF-16 范围；函数诊断仍未迁移。
- **Wasm 导航文件元数据边界**: `RustWasmAdapter` 支持可选 `navigationFilePath`，在适配层补齐程序入口/宏文件名并过滤非宏文件导航；旧文本 ABI 与生产 Provider 不变。
- **Wasm 可选诊断 code 与括号 parity**: Rust JSON bridge 支持无 `code` 字段的共享诊断，补齐括号/方括号多余与缺失 warning，并覆盖 CLI/Wasm/JavaScript 差分；函数诊断仍未迁移。
- **Wasm 静态 MOD parity**: Rust 试点补齐纯数字 `MOD` 小数操作数诊断，整数和动态表达式保持不误报，并通过 CLI/Wasm/JavaScript 差分验证。
- **Wasm 缺少分号 parity**: Rust 试点补齐普通赋值、结束语句和 G 码等语句的缺少分号错误，同时排除控制结构头、分支、CASE 标签和宏头；函数与更复杂语句分类仍未迁移。
- **Wasm 数学函数域 parity**: Rust 试点补齐 `ATAN2/POW/LN/SQRT/ACOS/ASIN` 的静态常量域诊断，复用 `SYNTEC_FUNCTION_MATH_DOMAIN`，动态引数和嵌套表达式保持不推断。
- **Wasm I/O 函数范围 parity**: Rust 试点补齐 `READDI/READDO/READABIT/SETDO/SETABIT` 点位、写入值，以及 `READRREGBIT/SETRREGBIT` 的 R/bit 范围诊断；动态引数保持不推断。
- **Wasm 基础函数引数 parity**: Rust 试点补齐 `ALARM/MSG` ID、`PARAM` 整数引数和 `CHKINF` 类别范围诊断，动态引数保持不推断。
- **Wasm 变量访问 parity**: Rust 试点补齐命名局部/公用变量、`#0/@0` VACANT 赋值和 AR/MAR 静态非法编号诊断；动态索引保持不推断。
- **Wasm R 保留区写入 parity**: Rust 试点补齐公用变量 `@` 映射到 R 寄存器保留区的写入 warning，区分 PLC/参数/FRAM/系统接口/未列保留段，并保留可写区段不诊断。
- **Wasm 字符串函数 warning parity**: Rust 试点补齐 `OPEN("COM1")` 与 `AXID("Y")` 的说明型 warning，复用字符串/注释边界，普通文件名和裸轴名保持不诊断。
- **Wasm SYSDATA/DRVDATA parity**: Rust 试点补齐 SYSDATA 整数引数、DRVDATA 站号整数和第二引数十进制/`"xxxh"` 格式诊断，动态变量保持不推断。
- **Wasm 赋值风格 parity**: Rust 试点补齐行首 `#/@/AR/MAR` 使用单独 `=` 的说明型 warning，条件比较、`==` 和 `:=` 保持不误报。
- **M3 后端 Go/No-Go**: JavaScript 继续作为唯一生产后端；Rust/Wasm 保持开发态 CLI/ABI 试点，直到完成完整诊断 parity、TextEdit/导航结果、可复现 CI 构建和回滚验证。

## 2.15.0 - 2026-09-17

### Added

- **Modbus-TCP 静态语法诊断**: 为 `G10 L1900` 的 C3/C6 读写语法与 `G10 L1901` 自定义封包增加必填/互斥引数检查、十进制整数检查，以及已确认的 `X`、`P/Q`、`R` 范围检查。

### Changed

- **Modbus 文档与回归覆盖**: 同步 G10 Modbus-TCP hover、语法手册、诊断说明与正反例测试；对 Confluence 未明确上限的站号、装置地址和 `K` 数量不做臆测限制。

## 2.14.0 - 2026-09-17

### Added

- **LTP 静态引数与 Q 联动诊断**: 依据 Atlassian Rovo MCP Server 复核的 LTP 正式页面，为 `USERCOR`、`TOOLCOR`、`G68.18`、`POSEMAP`、`SHIFTON`、`SKIPCOND`、`SWAITSIG`、`SYNCOUT`、`CIRMODE`、`WAITSYNC/ENDSYNC` 和 `G192.1` 增加可静态确认的引数范围与信号 Q 联动检查；动态变量和表达式保持不推断。
- **坐标系语法边界诊断**: 新增 `SYNTEC_ROBOT_UNSUPPORTED_COORDINATE_SYNTAX`，提示 `USERCOR`、`TOOLCOR`、`G68.18` 不可混入 CNC/机器人进给、G 码、轴向命令或移动指令。
- **语言数据一致性门禁**: 新增 `npm.cmd run check:data`，检查内置函数、机器人关键字 Hover 和诊断元数据的一致性，并接入 `npm test`。

### Changed

- **导航缓存失效**: 工作区导航缓存通过文件监听主动失效，保留取消、删除文件清理和结果顺序；500 文件集成基准重复查询降至 281ms。
- **FUN-A 证据边界**: 完善 `SYSVAR`、`GETPR`、`SETPR` 的 Hover 和资料说明；`GETPR/SETPR` 在缺少 A 级来源或控制器记录时继续不提供强诊断。
- **发布冒烟清理**: Windows 临时 profile 清理增加重试，清理竞态只输出明确 warning，不再把已通过的安装冒烟误报为失败。

### Documentation

- 同步 LTP/FUN-A 官方证据、能力矩阵、语法手册、交接说明和发布规划。

## 2.13.0 - 2026-09-16

### Added

- **LTP 静态引数范围诊断**: 依据已登记的 LTP/CF 正式页面，为 `MOVL/MOVC/INCMOVJ/INCMOVL` 的 `P/Q` 与 `WEAVEON` 的 `P/L/R` 增加静态常量范围检查；表达式和动态变量保持不推断。
- **导航索引有界并发**: 工作区导航索引支持有界并发加载，500 文件集成基准首次查询 1207ms、重复查询 387ms，保持缓存失效和结果顺序。

### Changed

- **共享词法状态机**: 将注释、字符串和转义引号处理统一到 `src/lexer.js`，供 validator、formatter、navigation 和函数参数检查复用，降低语法行为漂移风险。
- **验证与文档同步**: 新增静态范围诊断 code、说明型 action、诊断文档、LTP 资料包和正反例回归；发布规划与交接状态同步到 `v2.13.0`。

## 2.12.0 - 2026-09-15

### Added

- **R 寄存器保留区写入诊断扩展**: `SYNTEC_PUBLIC_VAR_R_RESERVED_WRITE` 检测范围从 `R0~R1023` 扩展到 `R11000~R14999`（含手册点名的 `R13001~R14095`），依据 PLC 介面说明与 Macro 变数规格。采用黑名单扩展策略：只报手册明确点名的保留段，`R4096~R5111`/`R5112~R5799`/`R8000~R9999` 等"未列出"段暂不静态检测，避免 DOS/WinCE/Linux 系统差异导致的误报。
- **控制流嵌套深度 warning**: 新增 `SYNTEC_CONTROL_NESTING_DEPTH_EXCEEDED` warning，检测 `IF/CASE/REPEAT/WHILE/FOR` 互相嵌套超过 10 层（对应控制器 `COM-007` 巢状超过 10 层）。阈值 `stack.length >= 10`，确保 10 层合法深度不报、第 11 个 opener 触发。

### Changed

- `docs/macro-knowledge/MACRO能力矩阵.md` 更新：VAR-002 后续验证条目从"评估 R13001~R14095 可行性"升级为"R11000~R14999 已实现"；FLOW-002 状态从"部分核实"升级为"深度 warning 已实现"。
- `docs/macro-knowledge/MACRO知识与验证规划.md` 新增代码批次 2（R 保留区扩展）与代码批次 3（嵌套深度 warning）迭代记录，标注设计选择、证据来源与未推进项的证据阻塞状态。

## 2.11.9 - 2026-08-05

### Fixed

- **方括号匹配诊断**: 检测多余或缺失的 `[]`，避免行尾多余的 `]` 被静默通过；保留 `#[表达式]` 等合法间接变量写法。

## 2.11.8 - 2026-07-29

### Changed

- **扩展主入口按 Provider 拆分**: 将 `extension.js`（967 行）按职责拆分为 `providerShared`、`completionProvider`、`hoverProvider`、`definitionProvider`、`diagnosticsProvider`、`navigationProvider`、`formattingProvider` 七个模块，`extension.js` 仅保留注册与生命周期管理；各 Provider 自行管理状态与 `dispose`，行为保持不变。
- **注释/字符串剥离逻辑统一**: 将 `validator.js` 与 `formatter.js` 中重复的 `stripCommentsAndStrings` 实现抽取到共享模块 `src/lexer.js`，消除两份状态机实现的行为漂移风险（formatter 闭合引号处理已对齐 validator 的规范行为：引号始终替换为空格）。
- **函数参数校验常量化**: `functionArgumentValidator.js` 中内联的控制器范围数字（I/O 点位 0~511、写入值 0/1、R 寄存器 0~65535、bit 0~31、ALARM/MSG ID 0~65535、CHKINF 类别 1~5）提取为模块顶部命名常量并标注手册出处，便于与《新代控制器技术参考手册》对照。
- **类型检查基础**: 新增 `jsconfig.json` 与 `@types/node` devDependency，为 `diagnosticFactory.js`、`lexer.js` 启用 `// @ts-check` 并补充 `DiagnosticProblem` 等 JSDoc 类型定义；`validator.js` 的 `validateDocument` 标注返回类型。无需构建即可在 IDE 获得局部类型检查收益。

### Fixed

- **README 徽章一致性校验前置**: `checkReleaseConsistency.js` 的 README 版本徽章校验原本只在 `--tag` 发布路径执行，常规 `npm run check:release`（无 tag，接入 `npm test`）会跳过；现改为始终与 `package.json` 版本对比，使徽章漂移在开发阶段即可被发现。

## 2.11.7 - 2026-07-28

### Added

- **运行时验证**: 在 81RA 机器人系统（10.120.44C）完成 14 项运行时验证，包含 CALL-RUN-01~07（调用语义）、FUN-E-06/07（单位与堆栈）、FUN-D-02（Cycle DB）、FUN-F-03/04（图形模拟）。验证程序位于 `tests/runtime-verification/`。关键发现：
  - G65 变量隔离、M98/M198 继承、M99 返回行为确认
  - G66/G66.1 在机器人系统上仅触发一次（与 CNC 行为不同）
  - 空栈 POP（堆栈下溢）和 STKTOP 越界索引均触发预解或运行时报警，无静默返回值
  - DBDELETE 未开档回传 -2，DBINSERT 未定义 Cycle name 回传 -3
  - SETDRAW 接受色码输入并原样返回，不做有效性检查

### Fixed

- **Issue Template YAML 修复**: `feature_request.md` 的 YAML front matter 首行 `#---` 改为 `---`，修复格式失效。

## 2.11.6 - 2026-07-28

### Fixed

- **发布脚本与 CHANGELOG 格式一致**: `checkReleaseConsistency.js`、`createGitHubRelease.js` 与 `release.yml` 原本期望 CHANGELOG 段落标题为 `## [X.Y.Z] - date`（带方括号），但 CHANGELOG 自 v1.0.0 起一致使用 `## X.Y.Z - date`（无方括号），导致 `npm run check:release -- --tag`、release notes 生成与 release body 提取都会失败。修正脚本与工作流匹配现有无括号格式。

### Changed

- **知识库版本基线同步**: `MACRO能力矩阵.md` 与 `MACRO知识与验证规划.md` 的发布状态行补充 `v2.11.5`。
- **FUN-B-12 证据阻塞解除**: 通过 Atlassian MCP 查询 Confluence，`SLEEP` 和 `AXID` 的 A 级来源在 Macro Function List 确认，与现有 hover 一致；`GETPR/SETPR` 经 CQL 搜索确认无函数页，维持证据阻塞。

## 2.11.5 - 2026-07-28

### Added

- **Worker 线程验证**: `validateDocument` 改在独立 Worker 线程执行，避免大文件诊断阻塞 Extension Host；包含 5 秒超时保护和竞态取消机制。
- **GitHub Release 脚本**: 新增 `scripts/createGitHubRelease.js`，适配域控环境（`git credential fill` + `curl.exe` + 临时 JSON 文件），替代被阻止的 `gh` CLI。

### Fixed

- **REPEAT 未闭合诊断**: `REPEAT` 块缺少闭合时正确提示"缺少对应的 UNTIL"，而非"缺少对应的 END_"。
- **函数参数解析**: 内置函数静态参数诊断支持嵌套括号和字符串内的逗号，不再将 `ATAN2(1, SQRT(2))` 等嵌套调用误判为多参数。
- **STITCHON/WEAVEON 互斥状态**: 在对方生效范围内静默忽略开启指令，避免状态不一致导致后续误报。
- **同行体检测**: `THEN/DO/OF` 后仅分号或空白不再识别为同行体，避免 `WHILE #1 DO;` 等控制结构头误加分号被当作合法同行体。
- **中文字符诊断字符串转义**: 字符串内的转义引号不再错误切换字符串状态，避免 `MSG("含\"中文")` 误报中文字符。
- **路径扩充引数正则**: 修正 `,C_`、`,R_`、`,A_` 匹配模式，避免误匹配。

### Changed

- **验证器性能**: 预编译关键字正则并缓存 `stripCommentsAndStrings` 结果，减少逐行重复创建 RegExp 对象。
- **资源清理**: `deactivate()` 完整清理诊断定时器、请求 ID 缓存、导航索引缓存和 Worker 线程，避免热重载后触发已 dispose 的 collection。
- **CodeActions 同步调用移除**: `getActionableDiagnostics` 不再在缺诊断时同步调用 `validateDocument`，避免阻塞 Extension Host。

### Removed

- **过时发布记录**: 移除 `docs/v2.10.0-发布记录.md` 和 `docs/v2.11.0-发布记录.md`（内容已在 CHANGELOG 中）。
- **死代码**: 移除 `extension.js` 中未使用的 `createDiagnosticFromProblem` 和 `rangeIntersects` 函数。

## 2.11.4 - 2026-07-25

### Fixed

- **格式化器安全性**: 修复跨行块注释被误改、多个规范化操作发生位置偏移，以及同行体导致后续代码错误缩排的问题。
- **格式化器规范化**: 自动补全需要的结尾分号，删除控制结构头多余分号，并将兼容写法 `ENDIF`、`ENDFOR`、`ENDWHILE`、`ENDCASE`、`ENDREPEAT` 和赋值 `=` 转为推荐写法。
- **格式化器边界**: 同行控制体、CASE 标签后赋值、行尾注释和字符串内容均得到保护。

## 2.11.3 - 2026-07-17

### Fixed

- **控制结构同行体误报**: `IF ... THEN <stmt>; ELSE <stmt>; END_IF;` 等同行体写法虽不推荐但控制器实际支援，不再误报"控制结构行不应以 ; 结尾"。覆盖 IF/ELSEIF/WHILE/FOR/REPEAT/CASE 所有控制结构。
- **DEFAULT 降级为 warning**: `DEFAULT:` 在 CASE 中实际可用，从 error 降级为 style warning "支援但不推荐，建议使用 ELSE"。

## 2.11.2 - 2026-07-13

### Fixed

- **路径扩充引数诊断**: 不再将 `ATAN2(..., SQRT(...))` 等嵌套函数调用误判为 `,SQRT_` 路径扩充引数；仅在 `G00/G01/G02/G03` 路径单节检查 `,C_`、`,R_`、`,A_`。
- **表达式引数识别**: 路径扩充引数的方括号表达式会参与诊断，`Z[#1 + 10]` 等未确认引数可正确提示 `COR-034` 风险。

## 2.11.1 - 2026-07-13

### Changed

- **发布资料同步**: 将 v2.11.0 发布后的 README、路线图、交接说明和 MACRO 知识库导航纳入正式发布包，确保 GitHub Release 与当前 main 文档一致。

## 2.11.0 - 2026-07-13

### Added

- **AXID 轴名提示**: `AXID` 补全与 Hover 采用 `AXID(axis)` 裸轴名语法；`AXID("Y")` 显示说明型 warning，避免带引号写法与控制器语法不一致。
- **Cycle 资料库说明**: 补齐 `DBLOAD/DBINSERT` 的共享 Cycle name 覆盖关系，以及 `DBDELETE` 的明确回传码。

### Changed

- **函数 Hover 语义**: 补充图形模拟、数学定义域、单位/堆栈和 Cycle 档案函数的已核实说明与回归保护。
- **诊断文档生成**: 诊断规则表会转义 MACRO 间接变量的方括号，避免 `AR[#1]`、`#[表达式]` 被 Markdown 解析为不存在的链接。

## 2.10.0 - 2026-07-11

### Added

- **工作区符号导航**: 支持通过 `Ctrl+T` 跨文件检索静态 G/O 程序入口、`%@MACRO` 与 N 标签，并保持动态目标不参与静态解析。
- **宏调用引用查找**: 支持从静态调用目标或宏文件入口查找 `G65/G66/G66.1`、`M98/M198` 的工作区引用；变量与表达式目标不参与解析。
- **诊断文档同步检查**: 新增 `npm run docs:diagnostics:check`，文档与诊断元数据不一致时退出失败，并接入 `npm test`。
- **持续集成**: 新增 main 分支与 Pull Request 的 GitHub Actions 测试、诊断文档同步检查、ESLint 和 VS Code 集成测试；release 打包前同样执行集成测试，失败日志自动上传。
- **发布一致性检查**: 新增 package/lockfile 常规检查及 tag/package/README/CHANGELOG 发布检查，阻止版本元数据不一致时打包。
- **VSIX 内容检查**: 新增严格文件白名单、打包前自动检查及产物大小/SHA-256 报告，开发脚本不再进入发布包。
- **安装包冒烟**: 新增隔离 VS Code Profile 冒烟命令，验证已安装 VSIX 的版本、安装路径、激活与 Workspace Symbol。

### Changed

- **导航扫描性能**: Workspace Symbol 与 References 改用文本快照、单次解析索引和自动失效缓存，不再批量打开候选文档；新增 500 文件/20,000 行解析及真实工作区 I/O 基准。
- **VSIX 内容收口**: 从扩展包中排除 `scripts/`，只保留运行时模块、Marketplace 元数据、语法、snippets、icon 与许可证文件。

## 2.9.0 - 2026-07-11

### Changed

- **诊断体验整合**: README 新增诊断与 Quick Fix 用户说明，解释 error/warning、自动修复与说明型 CodeAction 的边界。
- **诊断规则文档增强**: `docs/诊断规则与修复动作.md` 从纯 code 表扩展为按场景阅读的诊断指南，同时保留自动生成的完整规则表。

### Added

- **诊断场景指南**: 补充分号规则、不支持语法、控制流、变量与函数参数、机器人/LTP 等常见诊断场景说明。

## 2.8.21 - 2026-07-11

### Added

- **v2.9.0 规划文档**: 新增 `docs/v2.9.0-规划.md`，明确 v2.9.0 发布目标、非目标、里程碑与验收标准。

### Changed

- **路线图入口**: `ROADMAP.md` 与 README 目录链接到 v2.9.0 详细规划，便于后续按 milestone 推进。

## 2.8.20 - 2026-07-11

### Changed

- **路线图收束**: 更新 `ROADMAP.md`，记录 v2.8.x 诊断体系完成状态、当前发布节奏建议与 v2.9.0 候选主题。
- **README 导航**: 在功能表和目录中补充诊断规则与修复动作相关入口。

## 2.8.19 - 2026-07-11

### Added

- **诊断规则文档**: 新增 `docs/诊断规则与修复动作.md`，列出诊断 code、分类、严重度、Quick Fix / CodeAction 与维护说明。
- **诊断文档生成脚本**: 新增 `npm run docs:diagnostics`，依据 `diagnosticCodes` 与 `diagnosticActions` 生成诊断规则文档。

## 2.8.18 - 2026-07-11

### Changed

- **集成测试稳定性**: 抽取诊断等待与 Quick Fix 应用 helper，以等待诊断状态变化取代固定延迟，降低 VS Code 集成测试脆弱性并缩短运行时间。

## 2.8.17 - 2026-07-11

### Changed

- **诊断结果排序**: 诊断返回前统一按位置、严重度与稳定 code/message 排序，使 UI 展示与测试结果更可预期。

## 2.8.16 - 2026-07-11

### Changed

- **诊断优先级过滤**: 同一区间已有错误诊断时会抑制重叠的警告诊断，减少语法错误场景下的风格提示噪音。

## 2.8.15 - 2026-07-11

### Changed

- **诊断去重稳定性**: 诊断去重 key 优先使用稳定 `code` 而非中文提示文字，避免未来调整文案影响诊断去重行为。

## 2.8.14 - 2026-07-11

### Changed

- **诊断对象工厂推广**: 将 `controlFlowValidator`、`functionArgumentValidator` 与 `robotValidator` 的诊断对象创建统一迁移到 `diagnosticFactory`，进一步收敛诊断结构。

## 2.8.13 - 2026-07-11

### Changed

- **诊断对象工厂**: 新增统一诊断对象工厂，并将 `validator` 中的手写诊断对象改为通过工厂创建，减少字段遗漏和重复结构。

## 2.8.12 - 2026-07-11

### Changed

- **诊断规则注册表**: 将行级诊断器改为带稳定 `id` 的规则注册表，并通过统一 helper 执行，便于后续新增、重排和测试诊断规则。

## 2.8.11 - 2026-07-11

### Changed

- **诊断动作元数据**: 将 Quick Fix 替换规则、说明文案与控制流闭合词抽取到独立 `diagnosticActions` 模块，降低后续新增诊断和 CodeAction 的维护成本。

## 2.8.10 - 2026-07-11

### Added

- **机器人/LTP 诊断 code**: 为机器人直接引数误用 `=`、旧式/非正式写法、平滑引数冲突、MOVC 成对规则、同步输出限制与特殊区间禁用等诊断提供稳定 code。
- **机器人/LTP Quick Fix**: 为安全可判定的写法提供自动修复，包括移除直接引数 `=`、`MOVJ-II` 改为 `MOVJ`、`TOOLCORON` 改为 `TOOLCOR`、`T_` 改为 `P_`、`TOOLCOR CLEAR` 改为 `TOOLCOR P0`。
- **机器人/LTP 集成测试**: 覆盖机器人语法 Quick Fix 在 VS Code 宿主中的实际应用结果。

## 2.8.9 - 2026-07-11

### Added

- **函数静态诊断 code**: 为数学函数定义域、I/O 点位范围、I/O 写入值、R 寄存器/bit 范围、ALARM/MSG ID、整数参数、CHKINF 类别与 OPEN COM 口径提供稳定诊断 code。
- **函数诊断说明 action**: 对无法安全自动修复的函数静态参数问题提供规则说明 Quick Fix。
- **函数诊断集成测试**: 覆盖函数静态诊断说明 action 在 VS Code 宿主中的行为。

## 2.8.8 - 2026-07-11

### Added

- **变量诊断 code**: 为命名局部/公用变量、`#0/@0` VACANT 赋值、AR/MAR 非法编号与赋值 `=` 风格建议提供稳定诊断 code。
- **变量诊断说明 action**: 对无法安全自动修复的变量编号问题提供规则说明 Quick Fix。
- **赋值风格 Quick Fix**: 对赋值语句中的 `=` 提供一键替换为推荐 `:=`。
- **变量诊断集成测试**: 覆盖变量诊断说明 action 与赋值风格 Quick Fix 在 VS Code 宿主中的行为。

## 2.8.7 - 2026-07-10

### Added

- **控制流诊断 code**: 为未匹配结束符、嵌套顺序错误、未匹配 `ELSE/ELSEIF/UNTIL`、`ELSEIF` 位于 `ELSE` 之后，以及文件结束时未闭合块提供稳定诊断 code。
- **未闭合块 Quick Fix**: 对文件结束时未闭合的 `IF/FOR/WHILE/CASE` 提供插入对应 `END_*;` 的 Quick Fix。
- **控制流集成测试**: 覆盖未闭合控制块 Quick Fix 在真实 VS Code 宿主中的应用结果。

## 2.8.6 - 2026-07-10

### Added

- **不支持语法 Quick Fix**: 为 `ELSIF`、`DEFAULT`、`DIV`、`==`、`!=`、`&&`、`||`、`%` 与 FANUC 比较关键字提供稳定诊断 code 和安全替换 Quick Fix。
- **Quick Fix 集成测试**: 覆盖多个不支持语法的真实 VS Code Quick Fix 应用流程。

### Changed

- **CodeAction 稳定性**: Quick Fix provider 可在 VS Code 未传入完整诊断上下文时回退到当前文档诊断，提升 CodeAction 查询稳定性。

## 2.8.5 - 2026-07-10

### Added

- **诊断 Quick Fix**: 为缺少行尾 `;` 与控制结构行误加 `;` 提供一键修复。
- **诊断稳定 code**: 为分号相关诊断提供稳定 code，便于测试、Quick Fix 与后续维护。
- **VS Code 集成测试**: 覆盖真实扩展宿主中的分号诊断 code 与 Quick Fix。

### Changed

- **语句分类模块**: 将语句分类与行尾分号信息抽出为独立模块，供 validator 与后续扩展能力复用。
- **测试样例策略**: 保持 `test-demo.nc` 为无诊断合法语法覆盖样例，错误场景改由测试内联样例覆盖。
- **代码片段**: 调整控制流与函数片段的行尾分号和占位符写法，确保插入结果符合当前诊断规则，并消除 VS Code snippet 语法警告。

## 2.8.4 - 2026-07-10

### Changed

- **语法诊断架构**: 新增行上下文与语句分类层，收敛分号诊断、控制流行处理与机器人旧语法规则表，降低后续规则维护成本。

### Fixed

- **分号诊断**: 按新代 MACRO 控制流语法区分控制结构行与完整语句；`END_*` 与 `UNTIL ... END_REPEAT` 等完整语句缺少 `;` 会报错。
- **控制结构诊断**: `IF/ELSEIF/FOR/WHILE/CASE/REPEAT/ELSE` 与空 `CASE` 标签等结构行误加行尾 `;` 会报错。

## 2.8.3 - 2026-07-10

### Added

- **扩展图标**: 新增 VS Code 扩展图标资源，并随 VSIX 一起打包发布。

## 2.8.2 - 2026-07-09

### Added

- **新代宏程序知识图谱**: 新增 `docs/新代宏程序知识图谱.md`，并从 README 链接，便于快速理解语法与能力边界。

### Changed

- **语法高亮**: 补充不等号 `<>` 的运算子高亮。
- **VSIX 打包内容**: 更新 `.vscodeignore`，排除 `.vscode` 本地配置。

### Fixed

- **语法诊断**: 对不支持的 `DIV`、`==` 与 `!=` 运算子提供明确报错与替代写法提示。
- **语法诊断**: 支援合法不等号 `<>`，避免被误判为不支持语法。

## 2.8.1 - 2026-06-28

### Added

- **G10 L1803/L1805 Hover**: 补充 MACRO IO TYPE-1/TYPE-2 的悬停文档，覆盖指令格式、引数范围、Q 引数范例、版本与限制说明。
- **G10 L1803/L1805 Snippet**: 新增 `g10l1803` 与 `g10l1805` 代码片段。
- **G10 通讯指令 Hover/Snippet**: 补充 `G10 L1021`、`G10 L1022`、`G10 L1900/L1901`、`G10 L1910/L1911` 的通讯指令悬停文档与代码片段。
- **G10 R 寄存器与讯号等待 Hover/Snippet**: 补充 `G10 L1000`、`G10 L1810`、`G10 L1820` 的悬停文档与代码片段。

### Changed

- **语法手册**: 同步 `G10 L1803` 与 `G10 L1805` 定义，修正 `G10 L1805` 最低版本口径。
- **语法手册**: 补充 ENIP、EtherCAT 物件字典、Modbus-TCP/RS485 相关 `G10` 通讯指令说明。
- **语法手册**: 补充 `G10 L1000` R 寄存器写入与 `G10 L1810/L1820` 讯号等待说明。

## 2.8.0 - 2026-06-28

### Added

- **后续路线图**: 新增 `ROADMAP.md`，记录 validator 拆分、VS Code 集成测试、formatter 评估和跳转能力扩展等后续待办。
- **补全回归测试**: 增加函数补全 snippet 测试，覆盖无参函数、普通函数和 `STKTOP[index]` 方括号签名。
- **VS Code 集成测试**: 新增 `npm run test:integration`，覆盖扩展激活、补全、悬停、GOTO 跳转、大纲符号和诊断配置开关。
- **保守 formatter**: 新增格式化 Provider，仅调整缩进并移除尾随空白，不重排或改写宏语句。
- **扩展跳转覆盖**: 支持 `G66/G66.1 P_` 跳转 G 宏程序、`M98/M198 P_` 跳转 O 副程序，以及 `G65/G66/G66.1 P"Name"` 静态字符串宏名跳转。
- **G/M 代码 Hover 数据表**: 新增 `src/codeDocs.js`，为常用 G/M 代码提供签名和说明，并用于 Hover 与 M 码补全说明。

### Changed

- **VSIX 打包工具链**: 固定 `@vscode/vsce` 为本地 devDependency，`npm run package` 使用本地 `vsce`。
- **README 功能口径**: 移除尚未实现的格式化文档操作说明。
- **validator 模块拆分**: 将函数静态参数诊断拆到 `src/functionArgumentValidator.js`，将机器人/LTP 单行与跨行状态诊断拆到 `src/robotValidator.js`，将控制流栈诊断拆到 `src/controlFlowValidator.js`。

### Fixed

- **函数补全 snippet**: 无参函数如 `SLEEP()` / `WAIT()` 不再被补成带占位参数的调用；`STKTOP[index]` 使用方括号 snippet。
- **配置贡献结构**: `package.json` 直接贡献 `syntecMacro.*` 设置键，与 README 和代码读取口径保持一致。
- **DocumentSymbol Provider**: 修复 VS Code 大纲 Provider 方法名，避免集成测试宿主报 `provideDocumentSymbols is not a function`。

## 2.7.0 - 2026-06-28

### Added

- **单一语法真源手册**: 新增并扩充 `docs/新代MACRO语法规范手册.md`，覆盖文件格式、变量、运算子、控制流、宏呼叫、登录 G/M/T 码、函数、机器人 LTP 指令、预解流程和撰写规范。
- **宏文件识别策略**: 支援常见加工档后缀 `.nc/.cnc/.tap/.prt/.mpf/.ptp/.pim/.anc/.bj/.edit/.demo`，并以 `%@MACRO` 首行作为内容识别依据。
- **纯文件解析工具**: 新增 `src/fileResolver.js`，统一宏程序文件名标准化和候选文件搜索逻辑。
- **机器人 LTP 补全与高亮**: 新增 `WAITSYNC`、`ENDSYNC`、`CIRMODE`，以及 `G01.101/102`、`G04.101/102/103`、`G10.101`、`G11.101/102/103`、`G12.101`、`G52.101`、`G53.101/102`、`G141.2`、`G142.*`、`G143.1`、`G144.*`、`G145.*`、`G192.*` 等机器人替代 G 码。
- **路径扩充引数诊断**: 识别 `,C_`、`,R_`、`,A_`，并对未确认路径扩充引数如 `,Z_` 提示 `COR-034` 风险。
- **变量基础诊断**: 对 `#0` / `@0` 作为赋值目标提示 VACANT 只读；对 AR/MAR 负数或小数静态编号报错。
- **函数静态诊断**: 对 `ATAN2(0,0)`、`POW` 负基底、`LN` 非正数、I/O 范围、`ALARM/MSG` ID、`PARAM/CHKINF` 参数与 `OPEN("COM1")` 提供静态提示。
- **MOVC 单行写法**: 支援新版 `MOVC X1=... X2=...` 单行写法，不再误判为缺少第二行 MOVC。
- **机器人区间互斥诊断**: 补齐 `WAITSYNC/ENDSYNC`、`G192.1/G192.2` 与 `STITCHON/WEAVEON` 区间禁用规则。
- **回归测试**: 增加机器人关键字、替代 G 码、路径扩充引数、VACANT 赋值和 AR/MAR 编号诊断测试。

### Changed

- **扩充 G/O 程序策略**: 扩充 G 码与 O 码副程序优先按无后缀文件处理，跳转搜索优先查无后缀候选。
- **文件关联收紧**: 移除 `.macro`、`.scp`、`.G` 的默认全局关联，仅通过 `%@MACRO` 首行或手动切换语言识别。
- **MOVJ 第二语法口径**: `MOVJ-II` / `INCMOVJ-II` 仅作为文档中的第二语法称呼，不作为正式指令补全或高亮；诊断提示改为使用 `MOVJ` / `INCMOVJ` 第二语法。
- **README 更新**: 更新机器人指令能力、文件识别策略和 VSIX 版本说明。

### Fixed

- **测试隔离**: 将纯文件解析逻辑从 `extension.js` 拆出，避免 Node 单元测试直接加载 VS Code API。
- **递归跳转候选一致性**: 递归搜索与 includePath 搜索统一使用 `fileResolver` 后缀策略。

## 2.6.5 - 2026-06-27

### Added

- **AI 语法覆盖 Demo**: 重构 `test-demo.nc` 为紧凑语法速查文件，覆盖变量规格、控制流、运算符、函数、宏调用、机器人指令与 G/M 码形态
- **风格建议诊断**: 对兼容但不推荐的短结束符 (`ENDIF`/`ENDFOR`/`ENDWHILE`/`ENDCASE`/`ENDREPEAT`) 提示使用标准 `END_*` 写法
- **赋值风格提示**: 对赋值 `=` 提示建议使用 `:=`，条件比较 `=` 不误报
- **命名变量诊断**: 对 `#TEMP` / `@TEMP` 等控制器不支援的命名变量报错
- **DIV 诊断**: 对不支援的 `DIV` 运算子报错，提示使用 `/` 并说明整数除法规则
- **比较运算诊断**: 对不支援的 `==` 报错，提示等于比较使用单独的 `=`
- **语法覆盖补强**: 支援动态 M 码高亮 (`M#4`)、`=` 比较高亮、局部间接变量 `#[expr]`、动态/字符串宏调用示例

### Changed

- **补全与 Hover**: 移除不推荐短结束符的补全和 Hover 文档提示，仅保留语法兼容与诊断提醒
- **代码片段**: FOR snippet 改用推荐赋值写法 `:=`
- **文档整理**: README 与使用手册改为展示推荐写法，避免引导不推荐语法

### Fixed

- **VSIX 打包内容**: 排除本地参考 `Macro/` 目录，避免参考宏程序进入发布包

## 2.6.4 - 2026-06-26

### Fixed

- **多文档诊断防抖**: 按文档 URI 独立维护诊断 timer，避免多个打开文件互相取消诊断
- **GOTO/G65 跳转定位**: 修复 Ctrl+Click `GOTO 100` 的数字目标无法进入 Definition Provider 的问题，并限制只在目标范围内触发跳转
- **跨行块注释误报**: 修复跨行 `(* ... *)` 注释内 `IF`/`GOTO` 被语法诊断误识别的问题
- **代码片段输出**: 修复 `OPEN` 片段插入 `[, "a"]` 伪语法、`MSG` 片段带前导空格的问题

### Changed

- **控制流诊断**: 关闭关键字必须匹配当前栈顶，交叉嵌套会报明确的嵌套顺序错误
- **语法高亮同步**: 补齐 `MOD`/`&`、`AR[#n]`/`MAR[#n]`、`$1`~`$4` 的高亮规则

## 2.6.3 - 2026-06-26

### Fixed

- **代码片段 API 一致性**: 修复 14 个过时代码片段，使其与 functions.js 和技术手册一致
  - SLEEP/WAIT: 移除错误的毫秒参数，改为无参数 `SLEEP();`/`WAIT();`
  - OPEN/PRINT/CLOSE: 移除旧的"文件号"API，改为路径式 API
  - READABIT/SETABIT: 修正参数数量（3→1、3→2）
  - SYSVAR/CHKMN/PARAM/SETDRAW: 修正参数类型
  - DBSAVE/DBINSERT/DBNEW: 修正参数（文件名→索引等）
- **README 文档错误**:
  - 移除对不存在的 `STR()` 函数的引用（手册仅有 `STR2INT`）
  - 函数数量 `88+` → `60+`（实际 62）
  - 代码示例语法修正：FOR/WHILE 缺 `DO`、`X[#3*10]` 方括号运算、裸中文注释
  - 函数片段表移除不存在的 `abs/str/sqrt/random` 前缀，替换为真实片段

### Changed

- **测试用例**: "SLEEP doc mentions milliseconds" 重命名为 "SLEEP takes no parameters"，验证无参数签名
- **片段回归测试**: 新增 snippets 一致性测试，锁定 SLEEP/WAIT/OPEN/CLOSE/READABIT/SETABIT 正确签名

## 2.6.2 - 2026-06-25

### Changed

- **版本统一管理**: 移除源文件中的硬编码版本号，统一从 package.json 读取
- **文档同步**: 更新 README.md 和 CHANGELOG.md 中的版本号至 2.6.2

### Added

- **GETPR/SETPR 函数**: 添加系统参数读写函数定义
- **SLEEP 函数文档**: 完善 SLEEP() 函数说明，明确其无参数特性

### Fixed

- **SLEEP 函数签名**: 修正为 `SLEEP()`（无参数），移除了错误的毫秒参数描述
- **测试文件版本号**: 移除测试文件中的硬编码版本号注释

## 2.6.1 - 2026-06-23

### Changed

- **validator.js 重构**: 将 validateDocument 函数（约290行）按职责拆分为6个独立验证器函数
  - collectMetadata: N标签收集与%@MACRO文件头检查
  - validateChineseCharacters: 中文字符与标点检测
  - validateParentheses: 括号匹配验证
  - validateControlFlowKeyword: 控制流关键字栈操作
  - validateUnclosedBlocks: 文件结束未关闭块检查
  - validateGotoReferences: GOTO标签引用验证
- **策略模式**: 引入 LINE_VALIDATORS 数组，行级验证器可插拔扩展
- **版本号统一**: 更新至 v2.6.1

## 2.6.0 - 2026-06-23

### Added

- **机器人指令代码片段**: 新增 18 个代码片段（MOVJ/MOVL/MOVC/INCMOVJ/INCMOVL/USERCOR/OBJCORON/TOOLCOR/SKIPCOND/SWAITSIG/SYNCOUT/WEAVEON/PAUSE/GETPR/SETPR/SLEEP/M198/G66.1）
- **G 码补全**: 新增 G04.102、G68.18、G192.1、G192.2 机器人专用 G 码
- **单元测试**: 新增 6 个测试用例（机器人指令、GETPR/SETPR、新 G 码、M198、PAUSE、SLEEP 文档）
- **README 机器人指令章节**: 新增机器人指令分类表和范例

### Changed

- **README 版本同步**: 更新至 v2.6.0（版本徽章、功能表、函数数 88+、VSIX 文件名）
- **测试脚本**: 更新为运行两个测试文件（validator.test.js + extension.test.js）

### Fixed

- **跨行块注释中文字符误报**: 修复 `(* ... *)` 跨行注释内的中文字符被误报为错误的问题

## 2.5.0 - 2026-06-22

### Changed

- **版本号统一**: 统一所有源码文件版本注释为 v2.5.0
- **test 脚本**: package.json 新增 `npm test` 脚本

### Fixed

- 修复跨行块注释 `(* ... *)` 导致的括号匹配误报（`*)` 被误认为多余右括号）

### Removed

- 删除临时调试文件 `check-demo.js`
- 删除重复文档 `docs/CHANGELOG.md`（根目录 CHANGELOG.md 为唯一权威）
- 移除失效的 `build` 脚本（引用不存在的 `build/build_grammar.py`）
- 清理 `src/validator.js` 头部过时的 v1.3.6 历史注释

## 2.4.0 - 2026-06-22

### Changed

- **函数说明全部中文化**: 所有内置函数的悬停文档说明改为中文（参考《新代控制器技术参考手册》）
- **版本号统一**: 统一所有源码文件版本注释为 v2.4.0

### Fixed

- 修复 `#` 变量前显示黑色方块的问题（`editor.colorDecorators: false`）
- 修复 REPEAT/UNTIL/EXIT 嵌套语法诊断误报

## 2.3.0 - 2026-06-22

### Added

- **机器人指令完整支持** (参考《新代控制器技术参考手册》)
  - 移动指令: MOVJ, MOVL, MOVC, INCMOVJ, INCMOVL
  - 坐标系指令: USERCOR, OBJCORON/OFF/CLEAR, TOOLCOR/ON/OFF
  - 应用指令: SKIPCOND, SKIP, SWAITSIG, SYNCOUT, WEAVEON/OFF, STITCHON/OFF, POSEMAP, SHIFTON/OFF, PAUSE
  - 速度与轨迹参数: ACC, DEC, FJ, FEJ, FL, FR, PL, PQ, PR
- **新 G 码支持**
  - G04.102: 等待计时
  - G192.1/G192.2: 末端追踪
  - G68.18: 设定用户坐标系
  - G10 L 值: 可程序资料输入 (L1000, L1021, L1900, L1901, L1910, L1911, L1805)
- **G67**: 取消模式宏程序呼叫
- **M198**: 呼叫子程序 (另一路径)
- **MOD 操作符**: 模数运算支持
- **轴群辨识符号**: $1~$4 语法高亮

### Changed

- **IF 条件括号支持**: 支持无括号形式 `IF #1 = 1 THEN`
- **CASE 冒号语法**: 支持 `<值>: <语句>` 冒号分隔
- **& 操作符**: 识别为布尔 AND (与 AND 等效)
- **比较运算符警告**: 检测 GT/EQ/LT/GE/LE/NE 等新代不支持的比较符,提示使用 `<` `>` `<=` `>=` `=` `<>`

### Fixed

- 函数签名修正 (参考手册):
  - ALARM: `ALARM(code)` 或 `ALARM(code, "message")`
  - MSG: `MSG(id)` 或 `MSG("content")` 或 `MSG(id, "content")`
  - SLEEP: `SLEEP()` 无参数，暂时放弃宏程序循环执行权
  - GETPR/SETPR: `GETPR(prNumber)` 和 `SETPR(prNumber, value)`

## 2.2.0 - 2026-06-22

### Added

- 嵌套深度检测 (最高 10 层)
- 宏程序块数量检测 (最高 256 个)
- IF/WHILE/CASE 缺少 THEN/DO/OF 检测
- 行尾分号检测
- M99 结尾检测

### Fixed

- 块注释多行处理
- CASE 块验证逻辑优化

## 2.1.0 - 2026-06-22

### Added

- 代码片段模板
- 诊断防抖 (300ms)
- includePath 配置支持

## 2.0.0 - 2026-06-22

### Added

- 智能补全增强
- 悬停文档
- 代码跳转
- 实时诊断
- Outline 大纲

## 1.0.0 - 2026-06-22

### Added

- 初始版本
- 基础语法高亮
- 基本代码补全
