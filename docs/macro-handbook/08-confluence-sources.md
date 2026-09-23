# 新代 MACRO 语法规范手册 · Confluence 参考索引

> 本文件为 [新代 MACRO 语法规范手册](../新代MACRO语法规范手册.md) 的拆分子主题（Confluence 参考索引）。
> 状态标记规则与维护流程见 [原手册索引 §0](../新代MACRO语法规范手册.md#0-状态标记)。

## 附录 A. Confluence 参考索引

> 本附录列出项目维护期间沉淀的 Confluence 权威页面索引，便于追溯官方最新规格。
> cloudId: `b5edbc26-4a0e-47be-a50c-f9c38bf43165`（syntecclub.atlassian.net）。

### A.1 核心规范

| Content ID | Title | URL | 用途 |
| --- | --- | --- | --- |
| 44106050 | MACRO开发应用手册 | <https://syntecclub.atlassian.net/wiki/spaces/TechManual/pages/44106050/MACRO> | 一手章节结构（22 项宏调用范例、Block Format、副程序、自订警报/MSG、XML 资料） |
| 44106246 | Macro变数规格 | <https://syntecclub.atlassian.net/wiki/spaces/TechManual/pages/44106246/Macro> | #0/#1~#400/#1001~/#1502/#1504/#1510/#1820/#1901~#1918/#4001~#5500 系统变数与版本门控 |
| 44107184 | G码指令一览表 | <https://syntecclub.atlassian.net/wiki/spaces/TechManual/pages/44107184/G> | 模态/非模态 G 码、G10/L10~L13、G78.2、G69、G10.9、G20/G21/G24 插补分组 |
| 44105796 | PLC介面说明 | <https://syntecclub.atlassian.net/wiki/spaces/TechManual/pages/44105796/PLC> | C101~C132↔#6001~#6032、R615 MST 旗标、R629、R633~R636、R16140/R16150 软面板倍率 |
| 44105791 | 扩充参数使用说明手册 | <https://syntecclub.atlassian.net/wiki/spaces/TechManual/pages/44105791> | Pr3401~Pr3420 预设、参数登录流程 |
| 44105816 | 控制器参数总表 | <https://syntecclub.atlassian.net/wiki/spaces/TechManual/pages/44105816> | Pr 全表、Pr3221 MACRO 单步、Pr3209 语系 |
| 44135263 | 程序座标设定 (G92/G92.1) | <https://syntecclub.atlassian.net/wiki/spaces/TechManual/pages/44135263/G92+G92.1> | #1901~#1918 偏移、#1930 旋转角度、#1931~#1933 旋转中心 |
| 44105843 | 控制器多国语系使用说明 | <https://syntecclub.atlassian.net/wiki/spaces/TechManual/pages/44105843> | 非英文注解切换语系后异常 + UTF-8 编码要求 |

### A.2 机器人/应用指令

| Content ID | Title | URL | 用途 |
| --- | --- | --- | --- |
| 64815294 | 语法指令规格（机器人总表） | <https://syntecclub.atlassian.net/wiki/spaces/LTP/pages/64815294> | MOVL/MOVJ/MOVC/INCMOV*、M96/M97、WEAVEON/WEAVEOFF、G196、G143.1、G144.103/104 |
| 64819227 | 电弧跟踪应用手册 | <https://syntecclub.atlassian.net/wiki/spaces/LTP/pages/64819227> | G196.1/G196.2 + RBT-340/343/344 + 与 WEAVEON 联动 |
| 64822206 | G144.103/G144.104 动力学防撞灵敏度 | <https://syntecclub.atlassian.net/wiki/spaces/LTP/pages/64822206/G144.103+G144.104-> | 灵敏度设定/复位、机床取放场景 |
| 331646776 | G145.1/G145.2 软浮动 | <https://syntecclub.atlassian.net/wiki/spaces/LTP/pages/331646776/G145.1+G145.2-> | RBT-210 警告、版本门控 `10.120.32W/10.118.42K/52/12.0.7+` |
| 814553083 | 客製 MACRO（产机激光焊） | <https://syntecclub.atlassian.net/wiki/spaces/AUTO/pages/814553083/MACRO> | G193.101 全引数表 P/T/R/S/A/B/C/D/E/H/I/J/K/W/Q |
| 803504764 | G903 V1.0 指令实作记录 | <https://syntecclub.atlassian.net/wiki/spaces/SZJS/pages/803504764/G903+V1.0> | MACRO+PLC 断刀监控、自学习 R6998/R7010/R7012 |
| 44134562 | G10L1803-MACRO IO TYPE-1 新格式 | <https://syntecclub.atlassian.net/wiki/spaces/TechManual/pages/44134562/G10L1803-MACRO+IO+TYPE-1> | K 引数偏移规则、G31 跳脱与 MACRO IO 时序交互 |
| 44279936 | G10L1802-等待 MACRO IO 指令完成 | <https://syntecclub.atlassian.net/wiki/spaces/TechManual/pages/44279936/G10L1802-+MACRO+IO> | 静音模式支持差异（10.118.40R/42R/48C/50+） |

### A.3 语法差异参考（不兼容，作为转换/查证来源）

> **本节仅为转换/查证来源，不代表项目扩展支持跨厂商兼容**。新代控制器 MACRO 语法与其他厂家（发那科、三菱、凯恩帝等）**不兼容**，发那科式 `#1 = 100;` 用 `=` 赋值、`[]` 阵列存取、`(* *)` 注释等进入新代扩展诊断时**应按新代 MACRO 规范报 error/warning**，不做静默兼容。MacroM 资料夹属新代控制器运行时切换层，不属于新代 MACRO 语法规范本身，项目扩展不对此做模式相关诊断。

| Content ID | Title | URL | 用途 |
| --- | --- | --- | --- |
| 27355508 | 发那科宏程序转新代宏程序 | <https://syntecclub.atlassian.net/wiki/spaces/GDST/pages/27355508> | 新代 vs 发那科差异表：`@%MACRO`、`;`、`()`、`:=`、`//` `(* *)`、G 码 TYPE A（差异查证，**不作为兼容目标**） |
| 837721919 | 第三方宏兼容需求分析（P0） | <https://syntecclub.atlassian.net/wiki/spaces/GDST/pages/837721919/P0> | `MacroS`/`MacroM` 资料夹分置 + `1303=51/1304=0` 参数切换（控制器运行时层，**项目扩展不做模式诊断**） |
| 849614054 | 三菱转新代程序差异（一线案例） | <https://syntecclub.atlassian.net/wiki/spaces/GDST/pages/849614054> | 三菱→新代 `G31→G231`（无 Q 引数）转换差异查证 |
| 123614402 | 其他厂家变量资源管理 | <https://syntecclub.atlassian.net/wiki/spaces/SZJS/pages/123614402> | 发那科/三菱/凯恩帝变量模型对照（仅对照，不兼容） |

### A.4 进阶/工程化

| Content ID | Title | URL | 用途 |
| --- | --- | --- | --- |
| 278496502 | Macro語法支援大檔案 開發筆記 | <https://syntecclub.atlassian.net/wiki/spaces/~10101884/pages/278496502/Macro> | 跨 Page IF/WHILE/FOR、Pool、辅助 stack、COR-204（† 个人空间笔记） |
| 832905367 | (補充) 使用新代 MACRO 處理排版指令 | <https://syntecclub.atlassian.net/wiki/spaces/PBU/pages/832905367/MACRO> | `#1500=1` + G66 + M99 P_ 循环样式复制（† 应用案例，非语法规格） |
| 483251200 | 新代控制器 Modbus 通讯SOP（Macro+PLC） | <https://syntecclub.atlassian.net/wiki/spaces/~C1720/pages/483251200/Modbus+SOP+Macro+PLC> | DB9 7+/6- 接线、R 32bit→16bit 拆位公式（† 个人空间笔记） |
| 834429119 | 新代 81RA 多轴群设置步骤 | <https://syntecclub.atlassian.net/wiki/spaces/SZJS/pages/834429119/81RA> | Pr701~Pr732 全流程、R530 上升沿触发 |

### A.5 同类工具对照

| Content ID | Title | URL | 用途 |
| --- | --- | --- | --- |
| 810777362 | 新代 Macro 輕量编辑器 | <https://syntecclub.atlassian.net/wiki/spaces/SZJS/pages/810777362/Macro> | v2.1.6 同类工具：%@MACRO/FOR/IF/CASE/WHILE/REPEAT 模板、schema\@.xml/schemaR.xml、UTF-8/UTF-16 自动识别 |

### A.6 使用约定

- 带 † 标记者为个人空间笔记或应用案例，不是官方 LTP/TechManual 规格；引用前需 user 确认或对照实机验证。
- Confluence MCP 仅提供「不可写辅助」：所有一手页面通过 `mcp_atlassian-mcp_getConfluenceContent` 拉取后由项目手册作者人工对齐，不自动同步。
- 若 Confluence 页面版本号变化（snapshotToken 增），需先 diff 再决定是否同步到本项目手册对应章节。
