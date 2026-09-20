# Rust 诊断 parity 清单

本清单对照 [`src/diagnosticCodes.js`](../src/diagnosticCodes.js) 中登记的全部诊断 code，记录 Rust 核心（`crates/syntec-core/src/lib.rs`）的覆盖状态、迁移批次和验证入口。它是 [3.x Rust/Wasm 切换剩余任务规划](3.x-Rust-Wasm切换剩余任务规划.md) P0-A.1 "诊断 code 收口" 的执行依据；每次迁移批次必须同步更新本清单、差分样例和对应单测。

更新日期：2026-09-20
当前 Rust 覆盖：42 / 67（按 code 字符串去重后为 39 个稳定 code；`SYNTEC_CORE_*` 为 ABI 符号，不计入诊断 code）。
未覆盖：25 个 code（24 个 `ROBOT_*` 与 `SYNTEC_UNSUPPORTED_DEFAULT`）。

## 状态定义

| 状态 | 含义 |
| --- | --- |
| 已覆盖 | Rust 在与 JavaScript 相同的输入下产出相同的 `line / col / endCol / severity / code` 序列，并由 `compare:rust` 差分样例覆盖。 |
| 待迁移 | code 已在 JS 登记，Rust 尚未实现等价诊断。 |
| 无 code warning | JS 当前产出无 `code` 的 warning；需逐项决定是否补登记 code，再决定 Rust 是否跟随。 |

## 已覆盖（42）

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

机器人/Modbus（已部分覆盖）：

- `SYNTEC_ROBOT_G10_MODBUS_FORMAT`
- `SYNTEC_ROBOT_G10_MODBUS_INTEGER`
- `SYNTEC_ROBOT_G10_MODBUS_RANGE`

## 待迁移（25）

### 批次 CASE-DEFAULT（本批）

- `SYNTEC_UNSUPPORTED_DEFAULT`：JS 在 `controlFlowValidator.js` 产出该 warning 但未附加 code，且 `endCol` 计算为 `match[0].length` 而非 `match.index + match[0].length`；Rust 当前完全不产出。本批将：JS 修正 `endCol` 并附加 code；Rust 新增 `validate_case_line_style` 等价实现；新增 `case-default-label` 差分样例与 Rust 单测。

### 批次 ROBOT-TOOLCOR（下一批）

`robotValidator.js` 的 `TOOLCOR/TOOLCORON` 单行规则组：

- `SYNTEC_ROBOT_TOOLCOR_T_ARG`
- `SYNTEC_ROBOT_TOOLCORON_DEPRECATED`
- `SYNTEC_ROBOT_TOOLCOR_CLEAR`

### 批次 ROBOT-MOV（后续）

`MOVJ/MOVC/MOVP` 静态参数与冲突规则组：

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

### 批次 ROBOT-STITCH-WEAVE（后续）

缝焊/摆焊参数规则组：

- `SYNTEC_ROBOT_STITCH_ARG_CONFLICT`
- `SYNTEC_ROBOT_STITCH_MISSING_ARG`
- `SYNTEC_ROBOT_STITCH_L_INTEGER`
- `SYNTEC_ROBOT_WEAVEON_MIXED_ARGS`
- `SYNTEC_ROBOT_WEAVEON_Q_DECIMAL`

### 批次 ROBOT-SIGNAL（后续）

信号同步与跳过规则组：

- `SYNTEC_ROBOT_SWAITSIG_Q_RANGE`
- `SYNTEC_ROBOT_SWAITSIG_LIMIT`
- `SYNTEC_ROBOT_SYNCOUT_Q_RANGE`
- `SYNTEC_ROBOT_SYNCOUT_LIMIT`
- `SYNTEC_ROBOT_SKIPCOND_Q_RANGE`
- `SYNTEC_ROBOT_RANGE_FORBIDDEN_COMMAND`

## 无 code warning（待逐项收口）

JS 当前产出无 `code` 的 warning。Rust parity 要求：要么两端都附加同一 code，要么两端都保持无 code。当前清单：

- CASE 分支标签后同行陈述警告（`controlFlowValidator.js` `branchMatch` 分支）。
- CASE ELSE 后同行陈述警告（同文件 `elseMatch` 分支）。
- 中文标点/中文字符错误（`Rust` 已以 `push_diagnostic_without_code` 等价产出，已 parity）。
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
