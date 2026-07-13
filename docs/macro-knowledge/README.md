# MACRO 知识库

本目录集中维护通过 Atlassian MCP、仓库实现和测试核实的新代 MACRO 知识。文档按“总览、规划、能力、专题证据”分层，避免根目录堆积零散资料包。

当前会话的未提交改动、验证基线与接续顺序见 [开发交接说明](../开发交接说明.md)。

## 阅读顺序

1. [Atlassian MACRO 知识记录](Atlassian-MACRO知识记录.md)：来源分级、核心规则、运行时模型与待验证边界。
2. [MACRO 知识与验证规划](MACRO知识与验证规划.md)：阶段门禁、实施顺序、验证策略与迭代记录。
3. [MACRO 能力矩阵](MACRO能力矩阵.md)：能力范围、官方版本基线、插件覆盖和审计状态。

## 专题资料包

- [MACRO 调用语义资料包](MACRO调用语义资料包.md)：`G65/G66/G66.1/G67/M98/M198/M99` 与 `WAIT()` 的边界。
- [MACRO 函数审计资料包](MACRO函数审计资料包.md)：调用与资料访问函数的来源、差异和实施清单。
- [MACRO 系统控制函数资料包](MACRO系统控制函数资料包.md)：`ALARM/MSG/WAIT/SLEEP/CHK*/AXID` 的证据与回归状态。
- [MACRO 单位与堆栈函数资料包](MACRO单位与堆栈函数资料包.md)：`STD/STDAX/PUSH/POP/STKTOP` 的转换、栈读取边界与回归状态。
- [MACRO Cycle 资料库函数资料包](MACRO-Cycle资料库函数资料包.md)：`DBOPEN/DBNEW/DBLOAD/DBSAVE/DBINSERT/DBDELETE` 的档案状态与回归状态。
- [MACRO 图形模拟函数资料包](MACRO图形模拟函数资料包.md)：`SETDRAW/DRAWHOLE` 的绘图状态、模拟范围与回归状态。

## 相邻规范

- [新代 MACRO 语法规范手册](../新代MACRO语法规范手册.md)
- [新代宏程序知识图谱](../新代宏程序知识图谱.md)
- [诊断规则与修复动作](../诊断规则与修复动作.md)