# Rust 诊断 parity 清单

本清单对照 [`src/diagnosticCodes.js`](../src/diagnosticCodes.js) 中登记的全部诊断 code，记录 Rust 核心（`crates/syntec-core/src/lib.rs`）的覆盖状态、迁移批次和验证入口。它是 [3.x Rust/Wasm 切换剩余任务规划](3.x-Rust-Wasm切换剩余任务规划.md) P0-A.1 "诊断 code 收口" 的执行依据；每次迁移批次必须同步更新本清单、差分样例和对应单测。

更新日期：2026-09-20
当前 Rust 覆盖：67 / 67（按 code 字符串去重后为 64 个稳定 code；`SYNTEC_CORE_*` 为 ABI 符号，不计入诊断 code）。
未覆盖：0 个 code。`SYNTEC_ROBOT_SWAITSIG_Q_RANGE` / `SYNTEC_ROBOT_SYNCOUT_Q_RANGE` / `SYNTEC_ROBOT_SKIPCOND_Q_RANGE` 在 JS `diagnosticActions.js` 注册了 code action 但 `robotValidator.js` 实际从未 emit，属 dead code——本批保持两端共同无 emit，parity 等价。至此 P0-A.1 "诊断 code 收口" 全部 67 个稳定诊断 code 完成迁移，可进入 P0-A.2 调用与引用边界及 P0-B 共享 `AnalysisResult` 合同。

## 状态定义

| 状态 | 含义 |
| --- | --- |
| 已覆盖 | Rust 在与 JavaScript 相同的输入下产出相同的 `line / col / endCol / severity / code` 序列，并由 `compare:rust` 差分样例覆盖。 |
| 待迁移 | code 已在 JS 登记，Rust 尚未实现等价诊断。 |
| 无 code warning | JS 当前产出无 `code` 的 warning；需逐项决定是否补登记 code，再决定 Rust 是否跟随。 |

## 已覆盖（67）

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

## Dead code（两端共同不 emit，parity 等价）

下列三个 code 已在 `src/diagnosticActions.js` 注册 code action，但 JS `src/robotValidator.js` 实际不 emit；Rust 同样保持无 emit，parity 等价。后续若 JS 补登记 emit 入口，需同步迁移 Rust：

- `SYNTEC_ROBOT_SWAITSIG_Q_RANGE`
- `SYNTEC_ROBOT_SYNCOUT_Q_RANGE`
- `SYNTEC_ROBOT_SKIPCOND_Q_RANGE`

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
