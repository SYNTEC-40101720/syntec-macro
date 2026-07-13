# MACRO 能力矩阵

本矩阵是 [MACRO 知识与验证规划](MACRO知识与验证规划.md) 的 Phase 1 产物初稿。它用于把控制器能力、版本、插件行为和验证证据放在同一张表中；“已登记”不等于“已在所有控制器/机型实测”。

更新日期：2026-07-13
状态：G0/G1 已完成；`v2.10.0` 已正式发布，G2 已完成调用、FUN-A 至 FUN-D 及 FUN-E 的部分审计；逐函数、逐机型与运行时证据仍持续补齐。

## 状态定义

| 状态 | 含义 |
|---|---|
| 已核实 | 有 A/B 级官方来源，结论及版本条件已记录。 |
| 部分核实 | 关键规则已核实，但仍缺逐项版本、机型或运行时证据。 |
| 待审计 | 仓库已有实现或资料线索，尚未以官方来源逐项核对。 |
| 不做静态判断 | 规则依赖运行时、参数、机型或外部 I/O，仅提供文档/hover 或模拟验证。 |

## 能力总览

| 能力 ID | 主题 | 官方基线 | 插件当前覆盖 | 状态 | 后续验证 |
|---|---|---|---|---|---|
| FMT-001 | `%@MACRO` 格式与分号 | 首行 `%@MACRO` 才按完整 MACRO 解释；MACRO 多数单节需分号。 | 语言首行识别、语法高亮、分号诊断。 | 已核实 | 维持 `test-demo.nc` 与 validator 回归。 |
| CALL-001 | `G65/G66/G66.1/G67` | 调用语义、变量空间和模式取消已整理。 | 静态定义/引用解析，G/M hover。 | 部分核实 | 见 [调用语义资料包](MACRO调用语义资料包.md)。 |
| CALL-002 | `M98/M198/M99` | `P/H/L`、返回、变量继承、`M198` 重读已整理。 | 静态定义/引用解析，G/M hover。 | 部分核实 | 见 [调用语义资料包](MACRO调用语义资料包.md)。 |
| FLOW-001 | 范围控制流 | 超过 60 KB 时，`IF/CASE/REPEAT/FOR/WHILE` 需要 `10.120.32+`；旧版可能 `COR-204`。 | 结构配对、关键字、补全与格式化。 | 已核实 | 大档案和目标版本须图形模拟/实机验证。 |
| FLOW-002 | 控制流深度与性能 | 嵌套上限与语法范围过大可能影响加工。 | 块配对；当前未按深度/文件大小给强诊断。 | 部分核实 | 确认上限对应版本后评估 warning。 |
| VAR-001 | `#` 区域变量和引数 | `#1~#26` 是引数区，`#27~#400` 为区域变量；调用方式决定继承或隔离。 | 变量识别与基础诊断。 | 已核实 | 调用生命周期由 CALL-RUN 系列验证。 |
| VAR-002 | `@` 公用变量与 R 映射 | 变量区间、R 映射与可写范围依系统/版本而异。 | 变量识别；未对范围做强判断。 | 部分核实 | 先实现低风险 `#0/@0` 写入提示评估。 |
| VAR-003 | AR/MAR APP 变量 | `10.118.39+`；仅 APP 专用 Macro 可访问，越界/非 APP 存取会报警。 | 语法识别与示例覆盖。 | 已核实 | 不在普通 Macro 中实施强静态判断，须有 APP 路径上下文。 |
| RUN-001 | 预解与 `WAIT()` | `WAIT()` 仅保证前方 G/M 完成；`M98/M99/M198` 为例外。 | `WAIT` 函数补全/hover。 | 已核实 | 仅模拟/实机验证；不实现通用同步诊断。 |
| RUN-002 | `SLEEP()` 与循环 | 用于让出执行权，降低无限循环造成的人机卡死风险。 | 函数补全/hover。 | 部分核实 | 收集正式函数表版本与循环实测。 |
| FUN-001 | 62 个内置函数 | 函数表是正式来源，但尚未逐项审计全部签名、版本和失败行为。 | `src/functions.js` 定义 62 个函数，补全和 hover 已覆盖。 | 待审计 | 按类别分批核对并为每类新增正反例。 |
| FUN-002 | `SYSDATA/DRVDATA` | `SYSDATA` 需整数诊断号与 `WAIT()`；`DRVDATA` 对版本、站号和启动时间敏感。 | 参数诊断、hover、补全。 | 已核实 | 详见 [函数审计资料包](MACRO函数审计资料包.md)。 |
| FUN-003 | 系统控制函数 | `ALARM/MSG` ID 边界、`WAIT` 预解例外和 `CHK*` 返回值已核实。 | 参数诊断、hover、补全。 | 已核实 | 详见 [系统控制函数资料包](MACRO系统控制函数资料包.md)。 |
| ROB-001 | LTP 机器人语法 | 机器人指令和 CNC MACRO 为不同产品范围。 | `robotValidator.js`、关键字、hover。 | 待审计 | 以 LTP《语法指令规格》建立独立矩阵。 |
| SCR-001 | 常驻 Script | 开机运行、独立执行、最多 8 个，仅可透过 `@` 沟通。 | 未作为独立语言模式实现。 | 已核实 | 保持与 MACRO 规则分离，不将其限制套用至 MACRO。 |

## 已核实的版本基线

| 项目 | 基线 | 来源与影响 |
|---|---|---|
| 大档案范围控制流 | 档案超过 60 KB 时，`10.120.32+` 支援 `IF/CASE/REPEAT/FOR/WHILE`；之前版本使用这些范围语法可能触发 `COR-204`。 | 插件不应无版本上下文地将范围控制流标为错误；文件大小/性能提示应优先为 warning。 |
| `SYSDATA` | 函数表列出 `10.118.23U`、`10.118.28H`、`10.118.33`；诊断号必须为整数，建议先 `WAIT()`。 | 审查函数参数诊断与 hover 时须保留版本/时序说明。 |
| `DRVDATA` | 函数表列出 `10.118.23U`、`10.118.28I`、`10.118.34`；站号、驱动器类型和开机资料就绪状态影响结果。 | 不根据单次静态调用直接判断执行必然成功。 |
| AR/MAR | `10.118.39+`；仅 APP 专用 Macro 可访问。 | 普通加工程序使用 AR/MAR 属运行环境问题，不适合仅凭文本做通用 error。 |

## 函数审计批次

`src/functions.js` 当前有 62 个函数定义。逐函数审计按下列批次进行，每批要求：官方来源、签名、参数类型、返回/失败行为、最低版本、正例、反例、hover 断言。

| 批次 | 函数类别 | 当前优先级 | 原因 |
|---|---|---|---|
| FUN-A | 调用/资料：`GETARG`、`GETTRAPARG`、`PARAM`、`SYSVAR`、`SYSDATA`、`DRVDATA`、`GETPR`、`SETPR` | P0 | 与调用、版本和控制器状态直接相关。 |
| FUN-B | 系统控制：`ALARM`、`MSG`、`WAIT`、`SLEEP`、`CHK*`、`AXID` | P0，首轮已核实 AXID 裸轴名语法 | `AXID("axis")` 以 warning 提示改用裸轴名；不推断轴配置、实际存在性或版本差异。 |
| FUN-C | I/O 与寄存器：`READ*`、`SET*` | P1，首轮官方范围/写入时序已核实 | 点位、R/bit 范围维持现有静态诊断；机型、PLC 配置与动态 I/O 状态不推断。 |
| FUN-D | Cycle/文件：`OPEN`、`CLOSE`、`PRINT`、`DB*` | P1，首轮官方路径与顺序约束已核实 | hover 已说明 OPEN/PRINT、Cycle 单档案、DBNEW/DBSAVE 前置条件与 DBLOAD/DBINSERT 的 Cycle name 覆盖；路径、档案与版本错误行为继续分批审计。 |
| FUN-E | 数学、字符串、单位与堆栈 | P2，首轮已核实 ABS/SIN/COS/TAN/ATAN/ATAN2/EXP/LN/POW/ACOS/ASIN/STR2INT/SCANTEXT/SQRT/CEIL/FLOOR/ROUND/STD/STDAX/MAX/MIN/SIGN/RANDOM/堆栈资料 | 已修正 ATAN2 象限样例与定义域说明；`LN/POW/ACOS/ASIN/SQRT` 常量定义域、基础数学函数、`CEIL/FLOOR/ROUND`、`STD/STDAX`、`MAX/MIN/SIGN/RANDOM` 与堆栈函数已建立专题资料包和回归，其余函数继续分批核实型别和版本。 |
| FUN-F | 图形模拟：`SETDRAW`、`DRAWHOLE` | P2，首轮已核实 BGR 色码、状态恢复和圆形绘制语义 | 已建立专题资料包和 hover 回归；颜色、半径与实际模拟渲染仍待目标模拟器验证。 |

## 实施规则

1. “已核实”只表示规则有正式资料支撑，不自动升级为诊断 error。
2. 只有文本可确定、跨版本稳定且误报成本低的规则才进入 validator。
3. 版本、机型、参数、路径或运行时状态相关规则优先进入 hover、文档或 warning。
4. 任何能力状态变更都必须同时更新本矩阵、来源资料包和相应测试。

## 主来源

1. [MACRO开发应用手册](https://syntecclub.atlassian.net/wiki/spaces/TechManual/pages/44106050/MACRO)
2. [Macro变数规格](https://syntecclub.atlassian.net/wiki/spaces/TechManual/pages/44106246/Macro)
3. [Macro Function List](https://syntecclub.atlassian.net/wiki/spaces/TechManual/pages/44133992/9.+Macro_Function_List)
4. [常驻运算程序说明手册](https://syntecclub.atlassian.net/wiki/spaces/TechManual/pages/44128019)
5. [COR-204 档案太大](https://syntecclub.atlassian.net/wiki/spaces/TechManual/pages/44123860/COR-204)