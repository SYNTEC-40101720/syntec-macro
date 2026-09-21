# MACRO 能力矩阵

本矩阵是 [MACRO 知识与验证规划](MACRO知识与验证规划.md) 的 Phase 1 产物初稿。它用于把控制器能力、版本、插件行为和验证证据放在同一张表中；“已登记”不等于“已在所有控制器/机型实测”。

更新日期：2026-09-20
状态：G0/G1/G3 已完成；`v2.10.0` 至 `v2.14.0` 已正式发布，G2 已完成调用资料、静态导航边界、CALL-13 warning、R 保留区扩展、控制流嵌套深度 warning、共享词法状态机、LTP 静态范围/Q 联动诊断、导航文件监听缓存和 FUN-A 至 FUN-F 首轮审计；逐机型、CNC/机器人差异与运行时证据仍持续补齐。

能力矩阵中的每个能力条目与 [Rust诊断parity清单](../Rust诊断parity清单.md) 中的稳定诊断 code 双向可追溯；该清单含「诊断 code ↔ 能力矩阵交叉引用」表，本矩阵不再重复登记 code 级状态。

## 状态定义

| 状态 | 含义 |
| --- | --- |
| 已核实 | 有 A/B 级官方来源，结论及版本条件已记录。 |
| 部分核实 | 关键规则已核实，但仍缺逐项版本、机型或运行时证据。 |
| 待审计 | 仓库已有实现或资料线索，尚未以官方来源逐项核对。 |
| 不做静态判断 | 规则依赖运行时、参数、机型或外部 I/O，仅提供文档/hover 或模拟验证。 |

## 能力总览

| 能力 ID | 主题 | 官方基线 | 插件当前覆盖 | 状态 | 后续验证 |
| --- | --- | --- | --- | --- | --- |
| FMT-001 | `%@MACRO` 格式与分号 | 首行 `%@MACRO` 才按完整 MACRO 解释；MACRO 多数单节需分号。 | 语言首行识别、语法高亮、分号诊断。 | 已核实 | 维持 `tests/fixtures/test-demo.nc` 与 validator 回归。 |
| CALL-001 | `G65/G66/G66.1/G67` | CF 已确认 G66/G66.1 基础触发语义和最后 G 码顺序；变量空间、模式取消及产品差异仍分开记录。Phase 5.1 CF 范围复核已确认 81RA 与 CF 规范差异为机型分支特性（CNC 以 CF 规范为准），详见 [调用语义资料包 §3.2](MACRO调用语义资料包.md#32-phase-51-cf-规范范围复核结论2026-09-20)。 | 静态定义/引用解析，G/M hover，非最后 G 码 warning。 | 部分核实 | 仅对 81RA 与 CF 不一致的 CNC 运行时行为复核，见 [调用语义资料包](MACRO调用语义资料包.md)。 |
| CALL-002 | `M98/M198/M99` | `P/H/L`、返回、变量继承、`M198` 重读已整理。Phase 5.1 CF 范围复核已确认 CALL-RUN-01/02/05/06/07 与 CF 规范一致（通过），详见 [调用语义资料包 §3.2](MACRO调用语义资料包.md#32-phase-51-cf-规范范围复核结论2026-09-20)。 | 静态定义/引用解析，G/M hover。 | 部分核实 | 见 [调用语义资料包](MACRO调用语义资料包.md)。 |
| FLOW-001 | 范围控制流 | 超过 60 KB 时，`IF/CASE/REPEAT/FOR/WHILE` 需要 `10.120.32+`；旧版可能 `COR-204`。 | 结构配对、关键字、补全与格式化。 | 已核实 | 大档案和目标版本须图形模拟/实机验证。 |
| FLOW-002 | 控制流深度与性能 | 嵌套上限与语法范围过大可能影响加工。 | 块配对；嵌套深度超过 10 层时触发 `SYNTEC_CONTROL_NESTING_DEPTH_EXCEEDED` warning（对应控制器 `COM-007`）。 | 部分核实→深度 warning 已实现 | 实测触发 `COM-007` 的边界版本与机型条件尚待复核；大档案 `COR-204` 与 `FLOW-001` 关联保留在 FLOW-001。 |
| VAR-001 | `#` 区域变量和引数 | `#1~#26` 是引数区，`#27~#400` 为区域变量；调用方式决定继承或隔离。 | 变量识别与基础诊断。 | 已核实 | 调用生命周期由 CALL-RUN 系列验证。 |
| VAR-002 | `@` 公用变量与 R 映射 | 变量区间与 @→R 映射以 [Macro变数规格](https://syntecclub.atlassian.net/wiki/spaces/TechManual/pages/44106246) 证实；R 完整区段语义以 [PLC 介面说明](https://syntecclub.atlassian.net/wiki/spaces/TechManual/pages/44105796) 证实。`Pr3811`/`Pr3813`/`Pr3829` 参数格式不在当前 A 级页面内。 | 变量识别；R 区段选型参考与保留区 warning 候选已落在手册 §2.5；R 保留区写入 warning 已在代码批次1 实现于 `src/validator.js`(`SYNTEC_PUBLIC_VAR_R_RESERVED_WRITE`)，批次2 已扩展覆盖 `R11000~R14999`（含 `R13001~R14095`）。 | R 语义已核实→保留区 warning 已实现 | `R4096~R5111`/`R5112~R5799`/`R8000~R9999` 等手册未明确点名的"未列出"段暂不静态检测，待实机复核后评估；`Pr3811`/`Pr3813`/`Pr3829` 格式待 CF 控制器参数总表补齐。 |
| VAR-003 | AR/MAR APP 变量 | `10.118.39+`；仅 APP 专用 Macro 可访问，越界/非 APP 存取会报警。 | 语法识别与示例覆盖。 | 已核实 | 不在普通 Macro 中实施强静态判断，须有 APP 路径上下文。 |
| RUN-001 | 预解与 `WAIT()` | `WAIT()` 仅保证前方 G/M 完成；`M98/M99/M198` 为例外。 | `WAIT` 函数补全/hover。 | 已核实 | 仅模拟/实机验证；不实现通用同步诊断。 |
| RUN-002 | `SLEEP()` 与循环 | 用于让出执行权，降低无限循环造成的人机卡死风险。A 级来源：Macro Function List。 | 函数补全/hover。 | 已核实 | 循环实测待模拟器/控制器验证。 |
| FUN-001 | 62 个内置函数 | 函数表是正式来源，已完成多类别首轮审计，仍未逐项核实全部签名、版本和失败行为。 | `src/functions.js` 定义 62 个函数，补全和 hover 已覆盖。 | 部分核实 | 按类别继续核对并为每类新增正反例。 |
| FUN-002 | `SYSDATA/DRVDATA` | `SYSDATA` 需整数诊断号与 `WAIT()`；`DRVDATA` 对版本、站号和启动时间敏感。 | 参数诊断、hover、补全。 | 已核实 | 详见 [函数审计资料包](MACRO函数审计资料包.md)。 |
| FUN-003 | 系统控制函数 | `ALARM/MSG` ID 边界、`WAIT` 预解例外和 `CHK*` 返回值已核实。 | 参数诊断、hover、补全。 | 已核实 | 详见 [系统控制函数资料包](MACRO系统控制函数资料包.md)。 |
| ROB-001 | LTP 机器人专项语法 | LTP 正式《语法指令规格》与《机器人语法对应 G 码与支援版本》及 20 个独立页面已通过 Rovo MCP 复核；静态范围、Q 联动和坐标系禁用写法已取得可实现证据，完整警报、机型和运行时条件仍待逐项核对。Phase 5.1 CF 范围复核已覆盖 ROB-LTP-01..08 的文档级警报编号依据（`RBT-103/115/116/124/127/322` 等），详见 [LTP 专项资料包 §4.1](MACRO-LTP专项资料包.md#41-phase-51-c-组-cf-规范范围复核结论2026-09-20)；机器人跨行规则可启动 Phase 5.2 Rust 状态 struct 设计，但 emit 入口接入主循环仍待 B 级证据回填。通用 MACRO 规则与其他载体共用，LTP 专属限制按产品范围限定。对应 23 个 `SYNTEC_ROBOT_*` 稳定诊断 code（详见 [Rust诊断parity清单](../Rust诊断parity清单.md)「诊断 code ↔ 能力矩阵交叉引用」段）；原 3 个 dead code（`SYNTEC_ROBOT_SWAITSIG_Q_RANGE` / `SYNTEC_ROBOT_SYNCOUT_Q_RANGE` / `SYNTEC_ROBOT_SKIPCOND_Q_RANGE`）于 2026-09-21 Phase 5.3 路径 A 两端共同剔除，JS 总 code 67→64；既有诊断行为不变（`SYNTEC_ROBOT_STATIC_ARG_RANGE` 覆盖 SKIPCOND/SWAITSIG/SYNCOUT 三 command 的 Q range 警报）。未来若 user 拿到 CNC B 级证据需重新加回独立 code，可按 `docs/JS-Backend退役路线图.md` §Phase 5.3 路径 B 重新落回。 | `robotValidator.js`、关键字、hover，并纳入统一 validator 流程；已覆盖 `USERCOR/TOOLCOR/G68.18/POSEMAP/SHIFTON/SKIPCOND/SWAITSIG/SYNCOUT/CIRMODE/G192.1/WAITSYNC` 等静态范围；跨行状态 `MOVC pair` / SWAITSIG/SYNCOUT counters / STITCHON/WEAVEON/WAITSYNC/G192.1 生效范围禁忌由 `RobotLineState` 状态机处理（详见 [LTP 专项资料包 §3](MACRO-LTP专项资料包.md#3-当前插件对应关系)）。 | 部分核实→静态范围扩展已实现 | 继续逐项补齐产品/机型/运行时警报；不把 LTP 专属限制误报到通用 MACRO。 |
| SCR-001 | 常驻 Script | 开机运行、独立执行、最多 8 个，仅可透过 `@` 沟通。 | 未作为独立语言模式实现。 | 已核实 | 保持与 MACRO 规则分离，不将其限制套用至 MACRO。 |
| DIAG-001 | 控制器诊断变量 | `D320`/`D324`/`D376` 解译与减速诊断、`D388` Script executor 平均时间、`D932`/`D933` NetPLC同步时间以 [控制器诊断变数](https://syntecclub.atlassian.net/wiki/spaces/TechManual/pages/44106009) 、[MACRO开发应用手册](https://syntecclub.atlassian.net/wiki/spaces/TechManual/pages/44106050/MACRO) 、[NetPLC使用说明](https://syntecclub.atlassian.net/wiki/spaces/TechManual/pages/44106337/NetPLC) 证实；原手册中 `D978`/`D979`/`D994`/`D995` 这 4 个诊断号在 CF 未找到独立条目，可能是编号有误或内部变量，待实机复核。 | 手册 §1.10 hover 与文档说明；不提供诊断号静态诊断（依赖运行时）。 | D 语义已核实 | 手册 §1.10 与 §13 已同步；D978/D979/D994/D995 需实机或控制器内部规格复核。 |

## 已核实的版本基线

| 项目 | 基线 | 来源与影响 |
| --- | --- | --- |
| 大档案范围控制流 | 档案超过 60 KB 时，`10.120.32+` 支援 `IF/CASE/REPEAT/FOR/WHILE`；之前版本使用这些范围语法可能触发 `COR-204`。 | 插件不应无版本上下文地将范围控制流标为错误；文件大小/性能提示应优先为 warning。 |
| `SYSDATA` | 函数表列出 `10.118.23U`、`10.118.28H`、`10.118.33`；诊断号必须为整数，建议先 `WAIT()`。 | 审查函数参数诊断与 hover 时须保留版本/时序说明。 |
| `DRVDATA` | 函数表列出 `10.118.23U`、`10.118.28I`、`10.118.34`；站号、驱动器类型和开机资料就绪状态影响结果。 | 不根据单次静态调用直接判断执行必然成功。 |
| AR/MAR | `10.118.39+`；仅 APP 专用 Macro 可访问。 | 普通加工程序使用 AR/MAR 属运行环境问题，不适合仅凭文本做通用 error。 |

## 函数审计批次

`src/functions.js` 当前有 62 个函数定义。逐函数审计按下列批次进行，每批要求：官方来源、签名、参数类型、返回/失败行为、最低版本、正例、反例、hover 断言。

| 批次 | 函数类别 | 当前优先级 | 原因 |
| --- | --- | --- | --- |
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
