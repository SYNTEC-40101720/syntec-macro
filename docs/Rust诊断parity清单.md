# Rust 诊断 parity 清单

本清单对照 [`src/diagnosticCodes.js`](../src/diagnosticCodes.js) 中登记的全部诊断 code，记录 Rust 核心（`crates/syntec-core/src/lib.rs`）的覆盖状态、迁移批次和验证入口。它是 [Rust/Wasm 切换验收门禁](Rust-Wasm切换验收门禁.md) P0-A.1 "诊断 code 收口" 的执行依据；每次迁移批次必须同步更新本清单、差分样例和对应单测。

更新日期：2026-09-22
当前 Rust 覆盖：73 / 73（按 code 字符串去重后为 70 个稳定 code；`SYNTEC_CORE_*` 为 ABI 符号，不计入诊断 code）。
未覆盖：0 个 code。本批新增 4 个区间禁忌独立 code（Phase 5.3 第 2 项 ROB-LTP-03/04/07/08）：`SYNTEC_ROBOT_STITCHON_FORBIDDEN_COMMAND` (RBT-115)、`SYNTEC_ROBOT_WEAVEON_FORBIDDEN_COMMAND` (RBT-322)、`SYNTEC_ROBOT_WAITSYNC_FORBIDDEN_COMMAND` (RBT-257，RBT-118 暂不 emit)、`SYNTEC_ROBOT_G192_FORBIDDEN_COMMAND` (RBT-123)，将原 `SYNTEC_ROBOT_RANGE_FORBIDDEN_COMMAND` 在 4 个运动辅助区间的 error emit 拆分为按区间式独立 code，M96 warning 仍保留 `SYNTEC_ROBOT_RANGE_FORBIDDEN_COMMAND` 兜底。同时把既有 RBT-110（`SYNTEC_ROBOT_SYNCOUT_LIMIT`）、RBT-154-2（`SYNTEC_ROBOT_SWAITSIG_LIMIT`）与 RBT-115/322/257/123/127/124 在交叉引用表上编号关联收口。Compare:rust 既有 12 个区间禁用 case 仅更新 `expected.code` 全部等价（139/139 不变），wasm 资产重打包（byteLength 322188 → 322575；SHA-256 由 `8a6ac901...` → `02bcb398...`）。

**Phase 5.1 控制器实测复核已落地（2026-09-22，user 张颖，Syntec 81RA / 11MA, 10.120.44C / 10.120.52）**：CALL-RUN-01..07 / FUN-A-13A..F / ROB-LTP-01..08 共 23 个采集块全部回填至对应资料包（详见 [调用语义资料包 §3.3/§4.1](macro-knowledge/MACRO调用语义资料包.md#33-phase-51-控制器实测复核结论2026-09-22) / [函数审计资料包 §4.2](macro-knowledge/MACRO函数审计资料包.md#42-phase-51-控制器实测复核结论2026-09-22) / [LTP 专项资料包 §4.2](macro-knowledge/MACRO-LTP专项资料包.md#42-phase-51-控制器实测复核结论2026-09-22)）。能力矩阵 CALL-001 / CALL-002 / FUN-001 / ROB-001 状态升级为 «实测复核»。本批未新增诊断 code（Phase 5.1 仅复核 + 资料回填），Phase 5.2-5.3 Rust 端跨行 emit 入口已解锁，后续新增 `SYNTEC_*` code 时按四件套登记同步更新本清单。

**Phase 5.2 RobotLineState 跨行状态字段扩展已落地（2026-09-22）**：`crates/syntec-core/src/lib.rs` `RobotLineState` struct 按 `Phase5-控制器证据采集清单.md` §D 表新增 4 个字段：`movc_pair_count`（ROB-LTP-02 中间点 >10 计数，阈值 10，emit 编号 RBT-127 留 5.3）/ `wait_pending`（CALL-RUN-05 WAIT() 完成保证）/ `m198_reread_required`（CALL-RUN-06 Pr3601~3610 注册后强制重读）/ `g65_call_scope_active`（CALL-RUN-01/02 G65 隔离 vs M98/M198 共享 `#27` 生命周期）。本阶段**仅扩 struct 不接入 emit**，struct 顶部挂 `#[allow(dead_code)]` 防 5.3 emit 落地前的 dead code 警告。`cargo build --lib` 与 `cargo build --lib --release --target wasm32-unknown-unknown`（发布 wasm 资产实际路径）均通过，未引入新 warning。测试模块加 `phase5_2_robot_line_state_default_inits_phase5_fields_zero_or_false` 单测验证 4 字段在 `#[derive(Default)]` 路径下 0/false 起步，为 5.3 emit 接入留断言锚点。Phase 5.3 将在 `validate_robot_line_state` / `finalize_robot_state` 增量补 emit 并走四件套登记（JS 注册 + Rust emit + 本清单 + DIAGNOSTIC_HELP 文案）。

**Phase 5.3 第 2 项 ROB-LTP-03/04/07/08 区间禁忌独立 code 已落地（2026-09-22）**：按第一性原理「现场使用者看到 code 应能精确定位 RBT 编号」，把通用区间禁用 `SYNTEC_ROBOT_RANGE_FORBIDDEN_COMMAND` 在 4 个运动辅助区间的 error emit 拆分为 4 个独立 code：STITCHON 区间 → `SYNTEC_ROBOT_STITCHON_FORBIDDEN_COMMAND` (RBT-115 连续脉冲输出不支援此指令) / WEAVEON 区间 → `SYNTEC_ROBOT_WEAVEON_FORBIDDEN_COMMAND` (RBT-322 摆动不支援此指令) / WAITSYNC 区间 → `SYNTEC_ROBOT_WAITSYNC_FORBIDDEN_COMMAND` (RBT-257 履带追踪不支援此指令，RBT-118 点位偏移 CF 实测优先报 257 故暂不 emit) / G192.1 末端跟踪区间 → `SYNTEC_ROBOT_G192_FORBIDDEN_COMMAND` (RBT-123 末端跟踪不支援此指令)。M96 中断型副程序 warning 不区分 RBT，仍保留 `SYNTEC_ROBOT_RANGE_FORBIDDEN_COMMAND` 兜底。同时把既有 RBT-110（`SYNTEC_ROBOT_SYNCOUT_LIMIT`·同一运动单节 SYNCOUT >10）、RBT-154-2（`SYNTEC_ROBOT_SWAITSIG_LIMIT`·运动单节后 >1 个 SWAITSIG）在交叉引用表上明确编号关联，不需要 emit 逻辑变更。`push_range_forbidden` helper 函数保留以服务 M96 warning，4 个区间 error emit 改为直接 `push_diagnostic` 零串。四件套登记完成：JS `src/diagnosticCodes.js` 新增 4 key（总 code 65→69）；`src/diagnosticActions.js` `DIAGNOSTIC_HELP` 新增 4 项文案含 RBT 编号 + 规避策略；Rust lib.rs literal emit；本清单 §已覆盖列表 + §交叉引用表 ROB-001 行新增 4 code。Compare:rust 既有 12 个区间禁用 case（`robot-signal-stitchon-forbids-movj/weaveon/stitchon-movl-skip-forbidden` / `...-weaveon-forbids-movj/stitchon` / `...-waitsync-forbids-movj/mcode` / `...-g192-forbids-swaitsig` / `...-mutual-exclusion-stitch-in-weave/weave-in-stitch`）只更新 `expected.code` 不改 `text/line/col`，139/139 等 价不变；wasm 资产重打包 322188→322575 (+387 B)，SHA-256 `8a6ac901...` → `02bcb398...`。ROB-LTP-05 RBT-154-2 、ROB-LTP-06 RBT-110 仅在交叉引用表编号收口，无 emit 逻辑变更。

**Phase 5.3 第 1 项 ROB-LTP-02 / RBT-127 emit 已落地（2026-09-22）**：`crates/syntec-core/src/lib.rs` `validate_robot_line_state` 在 `pending_movc_line > 0` 且 `!in_conditional_branch`、当前指令非 MOVC 且非运动指令时，对 `G10 L*` 行（新增辅助函数 `is_g10_l_line`）/ `SYNCOUT` / 非运动辅助 M 码 / 辅助 G 码四类中间单节推进 `movc_pair_count`；第 11 笔即时在本行 emit `SYNTEC_ROBOT_MOVC_INTERMEDIATE_LIMIT`（错误，行起始 col..clean_end），对应控制器 RBT-127【圆弧运动单节间的指令数量已超过上限】。MOVC 配对完成（第二笔双行写法 MOVC 到达）或运动指令截断圆弧对时 `movc_pair_count` 与 `pending_movc_line` 同步归零。X1/X2 单行写法不触发 `pending_movc_line`，自然不进入计数路径（豁免）。Macro 变量赋值 / 流程控制 / 注释 `get_command` 返回 None 在 `validate_robot_line_state` 顶部 early return，亦不计数（豁免）。计入/豁免/禁忌三类划分依据 user 2026-09-22 CF 复核 + 现场实测记录单 §C-02：插入 11 笔 `G10 L1000 P1 R1` 触发 RBT-127，计数器 `movc_pair_count=11`。四件套登记完成：JS `src/diagnosticCodes.js` `ROBOT_MOVC_INTERMEDIATE_LIMIT` key + `src/diagnosticActions.js` `DIAGNOSTIC_HELP` 文案 + Rust lib.rs literal emit + 本清单 §交叉引用表新增 `SYNTEC_ROBOT_MOVC_INTERMEDIATE_LIMIT` (ROB-001 行)。Compare:rust 新增 4 个差分样例全部等价（139/139），wasm 资产重打包通过 `check:rust:wasm:asset`，probe/benchmark 通过。

`SYNTEC_ROBOT_SWAITSIG_Q_RANGE` / `SYNTEC_ROBOT_SYNCOUT_Q_RANGE` / `SYNTEC_ROBOT_SKIPCOND_Q_RANGE` 在 JS `diagnosticActions.js` 注册了 code action 但 `robotValidator.js` 实际从未 emit，属 dead code——**Phase 5.3 路径 A 已于 2026-09-21 落地**：JS+Rust 两端共同剔除上述三项 dead code 与对应 code action，JS 端 `src/diagnosticCodes.js` 与 `src/diagnosticActions.js` 已移除三项 key 与 code action；Rust 端本就无 literal 无需动；JS 总 code 数 67→64；既有诊断行为不变（`SYNTEC_ROBOT_STATIC_ARG_RANGE` 覆盖三 command 的 Q range 警报）。至此 P0-A.1 "诊断 code 收口" 全部稳定诊断 code 完成迁移，P0-A.2 调用与引用边界 parity 已合上，P0-B 第 1 项「真实 request 传输」已合上（`parse_analysis_request`/`analyze_request_json`/CLI `--request`/Wasm `syntec_core_analyze_request_json`/`createRustWasmAdapter` 切换 + P0-B 139/139 等价），P0-B 第 2 项「完整结果」已合上：navigation parity 10/10 等价（`portable_file_name`/`get_program_entry_name`/`is_macro_file_content`/`get_macro_program_name` 依据 `document.uri` 完整计算）+ edits/TextEdit parity 17/17 等价（`format_document` 完整移植 `formatter.js`，整文档 `TextEdit` 契约一致）+ profile 协商透传非空字符串与 JS 一致；下一步进入 P0-C 生产 Wasm 资产与 Worker 接入。

## 状态定义

| 状态 | 含义 |
| --- | --- |
| 已覆盖 | Rust 在与 JavaScript 相同的输入下产出相同的 `line / col / endCol / severity / code` 序列，并由 `compare:rust` 差分样例覆盖。 |
| 待迁移 | code 已在 JS 登记，Rust 尚未实现等价诊断。 |
| 无 code warning | JS 当前产出无 `code` 的 warning；需逐项决定是否补登记 code，再决定 Rust 是否跟随。 |

## 已覆盖（73）

基础语法与控制流：

- `SYNTEC_MISSING_SEMICOLON`
- `SYNTEC_CONTROL_STRUCTURE_TRAILING_SEMICOLON`
- `SYNTEC_UNSUPPORTED_ELSIF`
- `SYNTEC_UNSUPPORTED_DIV`
- `SYNTEC_UNSUPPORTED_EQUALITY_OPERATOR`
- `SYNTEC_UNSUPPORTED_INEQUALITY_OPERATOR`
- `SYNTEC_UNSUPPORTED_LOGICAL_AND_OPERATOR`
- `SYNTEC_UNSUPPORTED_LOGICAL_OR_OPERATOR`
- `SYNTEC_UNSUPPORTED_PERCENT_OPERATOR`
- `SYNTEC_UNSUPPORTED_LOGICAL_NOT_OPERATOR`
- `SYNTEC_UNSUPPORTED_COMPOUND_ASSIGNMENT`
- `SYNTEC_UNSUPPORTED_INCREMENT`
- `SYNTEC_UNSUPPORTED_FANUC_COMPARISON`
- `SYNTEC_CALL_MACRO_NOT_LAST_G_CODE`
- `SYNTEC_CONTROL_UNMATCHED_END`
- `SYNTEC_CONTROL_NESTING_ORDER`
- `SYNTEC_CONTROL_UNMATCHED_ELSE`
- `SYNTEC_CONTROL_UNMATCHED_ELSEIF`
- `SYNTEC_CONTROL_ELSEIF_AFTER_ELSE`
- `SYNTEC_CONTROL_UNMATCHED_UNTIL`
- `SYNTEC_CONTROL_UNCLOSED_BLOCK`
- `SYNTEC_CONTROL_NESTING_DEPTH_EXCEEDED`
- `SYNTEC_UNSUPPORTED_DEFAULT`

变量与赋值：

- `SYNTEC_NAMED_LOCAL_VARIABLE`
- `SYNTEC_NAMED_GLOBAL_VARIABLE`
- `SYNTEC_VACANT_ASSIGNMENT`
- `SYNTEC_PUBLIC_VAR_R_RESERVED_WRITE`
- `SYNTEC_INVALID_APP_VARIABLE_NUMBER`
- `SYNTEC_ASSIGNMENT_STYLE_EQUALS`

函数参数：

- `SYNTEC_FUNCTION_MATH_DOMAIN`
- `SYNTEC_FUNCTION_IO_POINT_RANGE`
- `SYNTEC_FUNCTION_IO_VALUE_RANGE`
- `SYNTEC_FUNCTION_R_REGISTER_RANGE`
- `SYNTEC_FUNCTION_R_BIT_RANGE`
- `SYNTEC_FUNCTION_ID_RANGE`
- `SYNTEC_FUNCTION_INTEGER_ARGUMENT`
- `SYNTEC_FUNCTION_DRVDATA_ARGUMENT_FORMAT`
- `SYNTEC_FUNCTION_CHKINF_CATEGORY_RANGE`
- `SYNTEC_FUNCTION_OPEN_COM_PORT`
- `SYNTEC_FUNCTION_AXID_QUOTED_AXIS`

机器人/TOOLCOR + ROBOT-MOV + G10 Modbus（已覆盖）：

- `SYNTEC_ROBOT_TOOLCOR_T_ARG`
- `SYNTEC_ROBOT_TOOLCORON_DEPRECATED`
- `SYNTEC_ROBOT_TOOLCOR_CLEAR`
- `SYNTEC_ROBOT_DEPRECATED_MOVJ_II`
- `SYNTEC_ROBOT_DIRECT_ARG_EQUALS`
- `SYNTEC_ROBOT_UNSUPPORTED_MOVC_POINT_ARG`
- `SYNTEC_ROBOT_UNSUPPORTED_MOVJ_P_ARG`
- `SYNTEC_ROBOT_UNSUPPORTED_SMOOTH_ARG`
- `SYNTEC_ROBOT_SMOOTH_ARG_CONFLICT`
- `SYNTEC_ROBOT_STATIC_ARG_RANGE`
- `SYNTEC_ROBOT_MISSING_REQUIRED_ARG`
- `SYNTEC_ROBOT_MOVC_PAIR_REQUIRED`
- `SYNTEC_ROBOT_MOVC_INTERMEDIATE_LIMIT`
- `SYNTEC_ROBOT_UNSUPPORTED_COORDINATE_SYNTAX`
- `SYNTEC_ROBOT_G10_MODBUS_FORMAT`
- `SYNTEC_ROBOT_G10_MODBUS_INTEGER`
- `SYNTEC_ROBOT_G10_MODBUS_RANGE`
- `SYNTEC_ROBOT_STITCH_ARG_CONFLICT`
- `SYNTEC_ROBOT_STITCH_MISSING_ARG`
- `SYNTEC_ROBOT_STITCH_L_INTEGER`
- `SYNTEC_ROBOT_WEAVEON_MIXED_ARGS`
- `SYNTEC_ROBOT_WEAVEON_Q_DECIMAL`
- `SYNTEC_ROBOT_SWAITSIG_LIMIT`
- `SYNTEC_ROBOT_SYNCOUT_LIMIT`
- `SYNTEC_ROBOT_RANGE_FORBIDDEN_COMMAND`
- `SYNTEC_ROBOT_STITCHON_FORBIDDEN_COMMAND`
- `SYNTEC_ROBOT_WEAVEON_FORBIDDEN_COMMAND`
- `SYNTEC_ROBOT_WAITSYNC_FORBIDDEN_COMMAND`
- `SYNTEC_ROBOT_G192_FORBIDDEN_COMMAND`
- `SYNTEC_ROBOT_G10_L1802_SILENT_VERSION_GATE`

## 诊断 code ↔ 能力矩阵交叉引用

每个诊断 code 对应 [MACRO能力矩阵](macro-knowledge/MACRO能力矩阵.md) 的能力 ID，便于规则与证据双向可追溯。能力矩阵是唯一状态登记点；本表是 code 级到能力级的指针，不重复状态字段。

| 诊断 code | 能力 ID | 主题 |
| --- | --- | --- |
| `SYNTEC_MISSING_SEMICOLON` | FMT-001 | `%@MACRO` 格式与分号 |
| `SYNTEC_CONTROL_STRUCTURE_TRAILING_SEMICOLON` | FMT-001 | `%@MACRO` 格式与分号 |
| `SYNTEC_UNSUPPORTED_ELSIF` | FLOW-001 | 范围控制流 |
| `SYNTEC_UNSUPPORTED_DEFAULT` | FLOW-001 | 范围控制流 |
| `SYNTEC_UNSUPPORTED_DIV` `SYNTEC_UNSUPPORTED_EQUALITY_OPERATOR` `SYNTEC_UNSUPPORTED_INEQUALITY_OPERATOR` `SYNTEC_UNSUPPORTED_LOGICAL_AND_OPERATOR` `SYNTEC_UNSUPPORTED_LOGICAL_OR_OPERATOR` `SYNTEC_UNSUPPORTED_PERCENT_OPERATOR` `SYNTEC_UNSUPPORTED_LOGICAL_NOT_OPERATOR` `SYNTEC_UNSUPPORTED_COMPOUND_ASSIGNMENT` `SYNTEC_UNSUPPORTED_INCREMENT` `SYNTEC_UNSUPPORTED_FANUC_COMPARISON` | FLOW-001 | 范围控制流（不支持运算符） |
| `SYNTEC_CALL_MACRO_NOT_LAST_G_CODE` | CALL-001 | `G65/G66/G66.1/G67` |
| `SYNTEC_CONTROL_UNMATCHED_END` `SYNTEC_CONTROL_NESTING_ORDER` `SYNTEC_CONTROL_UNMATCHED_ELSE` `SYNTEC_CONTROL_UNMATCHED_ELSEIF` `SYNTEC_CONTROL_ELSEIF_AFTER_ELSE` `SYNTEC_CONTROL_UNMATCHED_UNTIL` `SYNTEC_CONTROL_UNCLOSED_BLOCK` | FLOW-001 | 范围控制流 (块配对) |
| `SYNTEC_CONTROL_NESTING_DEPTH_EXCEEDED` | FLOW-002 | 控制流深度与性能 |
| `SYNTEC_NAMED_LOCAL_VARIABLE` `SYNTEC_NAMED_GLOBAL_VARIABLE` `SYNTEC_VACANT_ASSIGNMENT` `SYNTEC_PUBLIC_VAR_R_RESERVED_WRITE` `SYNTEC_INVALID_APP_VARIABLE_NUMBER` `SYNTEC_ASSIGNMENT_STYLE_EQUALS` | VAR-001 / VAR-002 / VAR-003 | `#`/`@`/AR/MAR 变量 |
| `SYNTEC_FUNCTION_MATH_DOMAIN` `SYNTEC_FUNCTION_IO_POINT_RANGE` `SYNTEC_FUNCTION_IO_VALUE_RANGE` `SYNTEC_FUNCTION_R_REGISTER_RANGE` `SYNTEC_FUNCTION_R_BIT_RANGE` `SYNTEC_FUNCTION_ID_RANGE` `SYNTEC_FUNCTION_INTEGER_ARGUMENT` `SYNTEC_FUNCTION_DRVDATA_ARGUMENT_FORMAT` `SYNTEC_FUNCTION_CHKINF_CATEGORY_RANGE` `SYNTEC_FUNCTION_OPEN_COM_PORT` `SYNTEC_FUNCTION_AXID_QUOTED_AXIS` | FUN-001 / FUN-002 / FUN-003 | 62 内置函数 / SYSDATA/DRVDATA / 系统控制 |
| `SYNTEC_ROBOT_DEPRECATED_MOVJ_II` `SYNTEC_ROBOT_DIRECT_ARG_EQUALS` `SYNTEC_ROBOT_UNSUPPORTED_MOVC_POINT_ARG` `SYNTEC_ROBOT_UNSUPPORTED_MOVJ_P_ARG` `SYNTEC_ROBOT_SMOOTH_ARG_CONFLICT` `SYNTEC_ROBOT_UNSUPPORTED_SMOOTH_ARG` `SYNTEC_ROBOT_STATIC_ARG_RANGE` `SYNTEC_ROBOT_MISSING_REQUIRED_ARG` `SYNTEC_ROBOT_MOVC_PAIR_REQUIRED` `SYNTEC_ROBOT_MOVC_INTERMEDIATE_LIMIT` `SYNTEC_ROBOT_UNSUPPORTED_COORDINATE_SYNTAX` `SYNTEC_ROBOT_TOOLCOR_T_ARG` `SYNTEC_ROBOT_TOOLCORON_DEPRECATED` `SYNTEC_ROBOT_TOOLCOR_CLEAR` `SYNTEC_ROBOT_G10_MODBUS_FORMAT` `SYNTEC_ROBOT_G10_MODBUS_INTEGER` `SYNTEC_ROBOT_G10_MODBUS_RANGE` `SYNTEC_ROBOT_STITCH_ARG_CONFLICT` `SYNTEC_ROBOT_STITCH_MISSING_ARG` `SYNTEC_ROBOT_STITCH_L_INTEGER` `SYNTEC_ROBOT_WEAVEON_MIXED_ARGS` `SYNTEC_ROBOT_WEAVEON_Q_DECIMAL` `SYNTEC_ROBOT_SWAITSIG_LIMIT` `SYNTEC_ROBOT_SYNCOUT_LIMIT` `SYNTEC_ROBOT_RANGE_FORBIDDEN_COMMAND` `SYNTEC_ROBOT_STITCHON_FORBIDDEN_COMMAND` `SYNTEC_ROBOT_WEAVEON_FORBIDDEN_COMMAND` `SYNTEC_ROBOT_WAITSYNC_FORBIDDEN_COMMAND` `SYNTEC_ROBOT_G192_FORBIDDEN_COMMAND` | ROB-001 | LTP 机器人专项语法 |
| Dead code（已于 2026-09-21 Phase 5.3 路径 A 删除）：`SYNTEC_ROBOT_SWAITSIG_Q_RANGE` `SYNTEC_ROBOT_SYNCOUT_Q_RANGE` `SYNTEC_ROBOT_SKIPCOND_Q_RANGE` | ROB-001 | LTP 机器人专项语法 (两端均不 emit，已两端共同剔除) |
| 无 code warning: CASE 分支标签后同行陈述 / CASE ELSE 后同行陈述 / 中文标点字符 / `%` 缺 `%@MACRO` / GOTO 目标不存在 | FLOW-001 / FMT-001 | 范围控制流 / `%@MACRO` 格式 |

## Dead code（两端共同不 emit → 2026-09-21 Phase 5.3 路径 A 已共同剔除）

下列三个 code 此前曾在 `src/diagnosticActions.js` 注册 code action，但 JS `src/robotValidator.js` 实际不 emit；Rust 同样保持无 emit。2026-09-21 Phase 5.3 路径 A 落地，JS+Rust 两端共同剔除 key 与 code action：

- ~~`SYNTEC_ROBOT_SWAITSIG_Q_RANGE`~~
- ~~`SYNTEC_ROBOT_SYNCOUT_Q_RANGE`~~
- ~~`SYNTEC_ROBOT_SKIPCOND_Q_RANGE`~~

JS DiagnosticCode 全集由 67 → 64 项，与 Rust lib.rs literal 集合完全等价。既有诊断行为不变（`SYNTEC_ROBOT_STATIC_ARG_RANGE` 覆盖 SKIPCOND/SWAITSIG/SYNCOUT 三 command 的 Q range 警报）。若未来 user 取得 CNC B 级证据需重新加回独立 code，可按本档 §Dead code 路径 B 重新落回 (三项 code 名称 + 版本门控记录已于 2026-09-21 Phase 5.3 路径 A 共同剔除)。

## 无 code warning（待逐项收口）

JS 当前产出无 `code` 的 warning。Rust parity 要求：要么两端都附加同一 code，要么两端都保持无 code。当前清单：

- CASE 分支标签后同行陈述警告（`controlFlowValidator.js` `branchMatch` 分支）。
- CASE ELSE 后同行陈述警告（同文件 `elseMatch` 分支）。
- 中文标点/中文字符错误（`Rust` 已以 `push_diagnostic_without_code` 等价产出，已 parity）。
- 「此文件缺少 %@MACRO 文件头」warning（`src/validator.js` `collectMetadata`），Rust 已在 `analyze_document` 中补齐等价产出（无 code），已 parity。
- GOTO 目标不存在 warning（已 parity，`push_diagnostic_without_code`）。
- 其他零散 hover/警告文本，按迁移批次复核。

## 验证入口

每次迁移批次完成后必须运行：

```powershell
git diff --check
npm.cmd test
npm.cmd run lint
npm.cmd run typecheck:analysis
npm.cmd run compare:rust
npm.cmd run probe:rust:wasm
npm.cmd run benchmark:rust:wasm -- --iterations 10
```

差分样例位于 `scripts/compareRustCore.js` 的 `CASES` 数组；新增 code 必须同时新增至少一个正反例样例，并同步更新本清单的状态列与 Rust 单测。
