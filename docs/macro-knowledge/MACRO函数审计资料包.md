# MACRO 函数审计资料包

本资料包执行 [MACRO 知识与验证规划](MACRO知识与验证规划.md) 的 FUN-A 首轮审计：调用与资料访问函数。它只记录已核实的控制器规则与代码审查差异；运行时或证据不足的结论不升级为静态诊断。

更新日期：2026-09-17
范围：`GETARG`、`GETTRAPARG`、`PARAM`、`SYSVAR`、`SYSDATA`、`DRVDATA`、`GETPR`、`SETPR`。本批通过 Atlassian Rovo MCP Server 复核 TechManual 入口；`SYSVAR` 的签名与示例已确认，`GETPR/SETPR` 仍未取得可复核的 A 级函数专页。
> 插件状态与后续动作见 [能力矩阵](MACRO能力矩阵.md) 对应能力 ID(FUN-001/FUN-002)。本资料包独有细节(DRVDATA `"D61h"` 格式与 COR-016/COR-023 警報)已回填到 [语法规范手册 §9.5](../新代MACRO语法规范手册.md#95-系统诊断函数);本资料包转为运行时验证记录+审计归档。
## 1. 函数能力矩阵

| ID | 函数 | 已核实规则 | 当前插件状态 | 后续动作 |
| --- | --- | --- | --- | --- |
| FUN-A-01 | `GETARG(name)` | 读取调用引数；扩充引数如 `Z1` 用此函数读取。不存在的引数回传 VACANT `#0`。 | 已有补全与 hover；未做调用上下文静态推断。 | 保持无强诊断；在 hover 保留 VACANT 失败语义。 |
| FUN-A-02 | `GETTRAPARG(name)` | 读取 `G66/G66.1` Trap 单节的引数，与 `GETARG` 的调用引数来源不同。 | 已有补全与 hover。 | 补充与 `GETARG` 对比的 hover/文档测试。 |
| FUN-A-03 | `PARAM(prNo[, axisGroup])` | 已有参数号/轴群号整数性规则；不同参数和机型的可用性依控制器配置。 | 静态诊断已检查前两个常量引数为整数。 | 不推断具体参数号有效性；新增正反例回归。 |
| FUN-A-04 | `SYSVAR(group, code)` | TechManual `Macro Function List` 已确认签名、轴群识别码和系统变量码语义，并给出 `SYSVAR(1, 1000)` 示例；具体系统变量可用性仍依轴群和控制器定义。 | 已有补全与 hover；Hover 明确不承诺固定轴群/变量码范围。 | CF 基础语义已收口；不根据未知轴群或系统变量码新增强诊断。 |
| FUN-A-05 | `SYSDATA(diagNo)` | 读取系统诊断变量；函数表列出版本并要求整数诊断号；建议先 `WAIT()`。字符串、小数和超出诊断范围会触发对应错误。 | 已有补全、hover、`WAIT()` 提示和静态字符串/小数诊断。 | 范围上限待正式变量目录确认。 |
| FUN-A-06 | `DRVDATA(stationNo, varNo)` | 读取驱动器状态；支援十进位整数或格式正确的十六进位字符串；站号、驱动器类型、状态变量和开机时机影响结果。 | 已有补全、hover 和常量格式诊断。 | 不检查动态值、设备存在性或状态变量支援范围。 |
| FUN-A-07 | `GETPR(prNo)` | 读取系统参数；仓库资料记录 `10.118.56Z`、`10.118.60T+`，Rovo MCP 复核当前 Macro Function List 未找到专页。 | 已有补全与 hover，文案明确版本/编号仍待复核；无参数诊断。 | 证据阻塞：待取得 A 级函数页或控制器验证后复核版本、型别和失败行为。 |
| FUN-A-08 | `SETPR(prNo, val)` | 写入系统参数；仓库资料记录 `10.118.56Z`、`10.118.60T+`，Rovo MCP 复核当前 Macro Function List 未找到专页。 | 已有补全与 hover，文案明确权限/时机仍待复核；无参数诊断。 | 证据阻塞：待取得 A 级函数页或控制器验证后复核权限、时机和失败行为；不做静态写入有效性判断。 |

## 2. 已核实的关键边界

### `GETARG` 与 `GETTRAPARG`

- `GETARG` 用于读取调用引数与扩充引数，例如 `GETARG(X)`、`GETARG(Z1)`。
- 引数不存在时，`GETARG` 回传 VACANT `#0`，调用方应自行检查，而不是假设为 `0`。
- `GETTRAPARG` 专门读取 `G66/G66.1` Trap 单节内的引数；它与 `GETARG` 的值来源不同。

### `SYSDATA`

- 官方函数表要求诊断变量号为整数；字符串和小数会触发 `COR-023`。
- 非数值形式会导致语法错误；超出诊断变量范围会触发 `COR-016`。
- 函数表列出的版本为 `10.118.23U`、`10.118.28H`、`10.118.33`；读取当前状态前建议 `WAIT()` 挡预解。
- 目前仅确认 `10000` 是越界示例，尚未取得完整且跨系统稳定的诊断变量编号上限，因此不加入范围 error。

### `DRVDATA`

- 站号须为整数。第二引数可使用十进位整数或符合 `"xxxh"` 的十六进位字符串，其中 `x` 仅能是 `0~F` 且结尾 `h` 为小写，例如 `"D61h"`。
- 无对应驱动器时回传 VACANT；不支援的状态变量会触发 `COR-016`；格式错误会触发 `COR-023`。
- 驱动器、站号、状态变量与开机后资料就绪时间均为运行时依赖，不能从单一文本调用推断成功与否。

## 3. 现有实现审查

审查范围：`src/functions.js` 与 `src/functionArgumentValidator.js`。

| 结论 | 说明 |
| --- | --- |
| 已实现 | `PARAM` 的前两个静态常量引数会检查是否为整数。 |
| 已实现 | `functions.js` 对 `SYSDATA` 说明 `WAIT()`，对 `DRVDATA` 说明站号整数、十进位/十六进位表示、VACANT 与耗时。 |
| 已实现 | `SYSDATA` 对静态字符串和小数引数使用稳定的整数参数诊断；动态表达式和字符串文本不误报。 |
| 已实现 | `DRVDATA` 对静态站号字符串/小数及第二引数非法常量格式给出稳定诊断；动态变量不误报。 |
| 有意保留 | 不对 `GETARG/GETTRAPARG` 是否处在调用上下文中报错，因为这依调用模型和运行时引数。 |
| 有意保留 | 不对 `SYSVAR` 的具体变量码、机型配置或轴群可用性做强诊断。 |
| 有意保留 | 不对 `GETPR/SETPR` 的具体编号、权限、机型或写入时机做强诊断。 |

## 4. 发布后的最小实施清单

| ID | 工作 | 验收标准 |
| --- | --- | --- |
| FUN-A-09 | 为 `SYSDATA` 的静态字符串与小数引数增加整数类型诊断。 | 已完成：复用 `SYNTEC_FUNCTION_INTEGER_ARGUMENT`；整数常量/变量通过，字符串、小数报错，字符串文本不误报。 |
| FUN-A-10 | 为 `GETARG/GETTRAPARG` 增加 hover 与函数索引回归断言。 | 已完成：文案区分调用者与 Trap 单节引数，并固定 VACANT 行为。 |
| FUN-A-11 | 为 `PARAM` 增加现有整数检查的正反例测试。 | 已完成：单参数与轴群参数正例、静态小数反例均已覆盖；不校验未知参数号和机型配置。 |
| FUN-A-12 | 收集 `DRVDATA` 十六进位字符串完整格式来源。 | 已完成：以函数表的 `"xxxh"` / `x=0~F` / 小写 `h` 规则实施常量格式诊断与 hover。 |
| FUN-A-13 | 收集 `GETPR/SETPR` 的 A 级函数页。 | 证据阻塞：当前 TechManual `Macro Function List` 正文未出现这两个函数，针对页面、博客和附件的全站 CQL 检索也未命中专页；在正式来源或控制器验证前，不新增静态规则。 |

## 4.1 证据阻塞记录

- `GETPR/SETPR`：当前 TechManual `Macro Function List` 正文未出现这两个函数；截至 2026-09-12，已用函数名、示例调用和仓库记录的版本号检索页面、博客和附件，仍未找到可确认函数签名、权限、参数型别或失败行为的 A 级页面。
- `SYSVAR`：TechManual `Macro Function List` 已确认 `SYSVAR(轴群识别码,系统变数码)` 及 `SYSVAR(1, 1000)` 示例；具体变量码、轴群范围和控制器可用性仍属于配置/版本边界。
- 现有 hover 的版本文字保留为仓库历史资料，不升级为正式版本承诺；不据此添加参数范围、权限或写入时机诊断。
- 恢复条件：取得 TechManual/LTP 正式函数页、控制器版本公告明确列出该函数，或在目标控制器上完成记录化验证。

### 4.1.1 Phase 5.1 CF 文档现状复核结论（2026-09-20）

CF TechManual《Macro Function List》中当前**未提供独立的 `GETPR` / `SETPR` 正式函数专页**（属于内部扩展/高版本支持函数）。CF 文档现状判定如下：

1. **证据等级判定**：由于缺乏 A 级（CF 独立专页）直接证据，必须严格依据 **B 级证据（控制器实测记录）** 作为 Rust parity 的 emit 准则；C/D 级（仓库历史、博客、口述）不可单独作 parity 依据。
2. **核心采集重点**（user 上控制器时按 [Phase5-控制器证据采集清单](Phase5-控制器证据采集清单.md) §B 表逐项采集）：
   - **签名与返回值**：`GETPR(prNo)` 与多轴群扩展签名 `GETPR(prNo, axisGroup)` 的返回值类型（数值 vs `VACANT` / `#0`）。
   - **异常报警**：越界参数编号是否触发 `COR-016`，超范围写入值是否触发 `COR-023` / `COR-024`。
   - **写入生效机制**：`SETPR` 的权限等级要求，以及写入后是即时更新还是需要重启控制器生效。
3. **不升级为静态 error**：在 user 上控制器完成 §4.1.1 采集之前，不新增参数范围、权限或写入时机诊断；hover 文案明确版本/编号仍待复核。

**这是 CF 文档现状判定，不是控制器实测记录**。Phase 5.2 Rust 跨行状态 struct 设计可以先行，但 `GETPR/SETPR` 相关 emit 入口仍要等 §4.1.1 B 级证据回填后才接入主循环。

## 5. 来源

1. [MACRO开发应用手册](https://syntecclub.atlassian.net/wiki/spaces/TechManual/pages/44106050/MACRO)：`GETARG`、扩充引数、AR/MAR 与格式/运行时背景。
2. [Macro Function List](https://syntecclub.atlassian.net/wiki/spaces/TechManual/pages/44133992/9.+Macro_Function_List)：`GETARG`、`GETTRAPARG`、`SYSVAR`、`SYSDATA`、`DRVDATA` 的签名、示例、版本和错误边界；当前页面未出现 `GETPR`/`SETPR`。
3. [Macro变数规格](https://syntecclub.atlassian.net/wiki/spaces/TechManual/pages/44106246/Macro)：区域变量生命周期和模态变量背景。
4. [COR-016 不合法的变量存取](https://syntecclub.atlassian.net/wiki/spaces/TechManualTW/pages/47989976/COR-016)：`SYSDATA`、`DRVDATA`、AR/MAR 的非法存取原因。
