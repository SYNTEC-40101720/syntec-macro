# 新代 MACRO 语法规范手册

本手册沉淀新代控制器 MACRO / LTP 机器人语法规范，作为 VS Code 插件的语法真源。目标：

- 记录已确认语法，减少规则散落在代码、snippet、README、测试和范例中的漂移。
- 区分正式语法、兼容但不推荐语法、不支持语法、待确认语法。
- 为 hover、snippet、diagnostics、TextMate grammar、测试用例提供统一依据。

CF 检索状态以 [能力矩阵](../MACRO能力矩阵.md) 为准（唯一状态登记点）；本手册只沉淀规则本身。新增或修改诊断规则走四件套（见 [文档地图](../README.md)）。

## 分册目录

| 分册 | 内容 |
| --- | --- |
| [format.md](format.md) — 基础文件格式与状态标记 | `%@MACRO` 判定、命名、存放路径、注释/字符集、读取流程、维护流程 |
| [variables.md](variables.md) — 变量系统与运算子 | `#`/`@`/AR/MAR 变量、系统变数、运算子优先级、常见警报 |
| [statements.md](statements.md) — MACRO 语法指令 | IF/CASE/REPEAT/WHILE/FOR/GOTO/EXIT、巢状语法、轴群辨识 |
| [calls.md](calls.md) — 子程序与宏呼叫 | M98/M198/M99、G65/G66/G66.1/G67、变量空间、宏程序引数 |
| [robot.md](robot.md) — 机器人移动、坐标系与应用指令 | MOV* 族、USERCOR/TOOLCOR、SKIPCOND/SWAITSIG/SYNCOUT、STITCH/WEAVE、G10 Modbus |
| [functions.md](functions.md) — 函数规则 | 62 个内置函数：数学/单位/引数读取/系统控制/I-O/Cycle/图形模拟 |
| [pitfalls.md](pitfalls.md) — 撰写陷阱 | 预解与 WAIT、模态备份、座标禁忌、引数处理、撰写模板 |
| [cross-vendor.md](cross-vendor.md) — 跨厂商宏程序兼容专题 | 发那科/三菱差异表、多通道变量共享、探头转换问题（参考，非兼容目标） |
| [backlog.md](backlog.md) — 待落地与待确认 | 诊断规则 backlog 与待确认项 |
| [references.md](references.md) — Confluence 参考索引 | 一手页索引（核心规范/机器人/跨厂商/工程化/同类工具） |
