# MACRO 知识库

本目录集中维护通过 Atlassian MCP、仓库实现和测试核实的新代 MACRO 知识。文档按“总览、规划、能力、专题证据”分层，避免根目录堆积零散资料包。

当前工作区的未提交改动、验证基线与后续接续顺序见 [开发交接说明](../开发交接说明.md)。

> 四层职责边界核对结论（2026-09-20）：本目录 10 个文档全部遵循 README §「文档分层与职责边界」定义的四层职责（真源/索引/派生/审计证据）。真源层 5 个文档（语法规范手册、知识与验证规划、3.x Rust/Wasm 切换规划、Rust 诊断 parity 清单、开发交接说明）只指向其他文档，不重复登记能力 ID 状态；[MACRO能力矩阵](MACRO能力矩阵.md) 是唯一能力级状态登记点，[Rust诊断parity清单](../Rust诊断parity清单.md) 含 `SYNTEC_*` code 到能力 ID 的交叉引用表；其余审计证据层 8 个资料包通过顶部`> 插件状态`与 `> 能力 ID` 指针指向能力矩阵，不重复登记状态。

职责边界： [MACRO 知识与验证规划](MACRO知识与验证规划.md) 是阶段、任务、证据和验收的唯一真源；[开发交接说明](../开发交接说明.md) 只维护当前工作区的开发、验证和 GitHub 同步流程，两者不物理合并，也不重复维护同一份计划。

## 文档分层与职责边界

本目录文档按四层组织,每层有固定职责,避免状态副本式登记和规则重复沉淀。

### 真源层(单一写入点,权威依据)

- [新代 MACRO 语法规范手册](../新代MACRO语法规范手册.md):语法/函数/规则的**知识真源**。
- [MACRO 知识与验证规划](MACRO知识与验证规划.md):阶段门禁/证据字段/迭代记录的**计划真源**。
- [3.x Rust/Wasm 切换剩余任务规划](../3.x-Rust-Wasm切换剩余任务规划.md):Rust/Wasm 正式导入、生产切换和 3.x 发布的执行清单。
- [Rust 诊断 parity 清单](../Rust诊断parity清单.md):对照 `src/diagnosticCodes.js` 全部 67 个 code 的 Rust 覆盖状态、未覆盖项与迁移批次。
- [开发交接说明](../开发交接说明.md):工作区/验证命令/发布的**运行真源**。

### 索引层(只读导航)

- 本文件:子目录职责边界与阅读顺序。
- [新代宏程序知识图谱](../新代宏程序知识图谱.md):概念导航(mindmap + flowchart + 能力导航)。

### 派生物(不可手改)

- [诊断规则与修复动作](../诊断规则与修复动作.md):`npm run docs:diagnostics` 生成,下次构建重写。

### 审计/运行时证据层(按主题分文件,状态以能力矩阵为准)

- [Atlassian MACRO 知识记录](Atlassian-MACRO知识记录.md):来源分级 A–D / 五层认知 / 工作流(方法学)。
- [MACRO 能力矩阵](MACRO能力矩阵.md):能力 ID 状态总览(**唯一状态登记点**)。
- [MACRO 调用语义资料包](MACRO调用语义资料包.md):CALL-* + 81RA 运行时记录。
- [MACRO LTP 专项资料包](MACRO-LTP专项资料包.md):ROB-001 + LTP 版本基线。
- [MACRO 函数审计资料包](MACRO函数审计资料包.md):FUN-A(GETARG/PARAM/SYSVAR/SYSDATA/DRVDATA/GETPR/SETPR)。
- [MACRO 系统控制函数资料包](MACRO系统控制函数资料包.md):FUN-B(ALARM/MSG/WAIT/SLEEP/CHK*/AXID)。
- [MACRO 单位与堆栈函数资料包](MACRO单位与堆栈函数资料包.md):FUN-E(STD/数学/栈)。
- [MACRO Cycle 资料库函数资料包](MACRO-Cycle资料库函数资料包.md):FUN-D。
- [MACRO 图形模拟函数资料包](MACRO图形模拟函数资料包.md):FUN-F。
- [Phase 5 控制器证据采集清单](Phase5-控制器证据采集清单.md):Phase 5.1 跨行状态 parity 的控制器实测指引、记录模板与 agent 接续触发表（CALL-RUN-01..07 CNC 复核、GETPR/SETPR 签名采集、ROB-LTP-01..08 跨行警报复核）。

### 治理原则

1. **状态只在一处登记**——[能力矩阵](MACRO能力矩阵.md)。资料包只记审计细节与运行时证据,不重复“当前插件状态/后续动作”。
2. **规则只在一处沉淀**——[语法规范手册](../新代MACRO语法规范手册.md)。资料包里的独有函数细节视成熟度回填到手册 §9 对应小节,资料包转为运行时验证记录+审计归档。
3. **方法学保留**——来源分级、五层认知、工作流不归并到规则文档,保留在 [Atlassian 知识记录](Atlassian-MACRO知识记录.md)。
4. **派生物不动**——[诊断规则](../诊断规则与修复动作.md) 由生成器维护。

## 阅读顺序

1. [Atlassian MACRO 知识记录](Atlassian-MACRO知识记录.md)：来源分级、核心规则、运行时模型与待验证边界。
2. [MACRO 知识与验证规划](MACRO知识与验证规划.md)：阶段门禁、实施顺序、验证策略与迭代记录。
3. [3.x Rust/Wasm 切换剩余任务规划](../3.x-Rust-Wasm切换剩余任务规划.md)：正式导入、切换和发布的依赖顺序与验收门槛。
4. [Rust 诊断 parity 清单](../Rust诊断parity清单.md)：Rust 诊断 code 覆盖状态、未覆盖项与迁移批次。
5. [MACRO 能力矩阵](MACRO能力矩阵.md)：能力范围、官方版本基线、插件覆盖和审计状态。

## 专题资料包

- [MACRO 调用语义资料包](MACRO调用语义资料包.md)：`G65/G66/G66.1/G67/M98/M198/M99` 与 `WAIT()` 的边界。
- [MACRO LTP 专项资料包](MACRO-LTP专项资料包.md)：机器人语法总表、替代 G 码、支援版本和 LTP 专项边界。
- [MACRO 函数审计资料包](MACRO函数审计资料包.md)：调用与资料访问函数的来源、差异和实施清单。
- [MACRO 系统控制函数资料包](MACRO系统控制函数资料包.md)：`ALARM/MSG/WAIT/SLEEP/CHK*/AXID` 的证据与回归状态。
- [MACRO 单位与堆栈函数资料包](MACRO单位与堆栈函数资料包.md)：`STD/STDAX/PUSH/POP/STKTOP` 的转换、栈读取边界与回归状态。
- [MACRO Cycle 资料库函数资料包](MACRO-Cycle资料库函数资料包.md)：`DBOPEN/DBNEW/DBLOAD/DBSAVE/DBINSERT/DBDELETE` 的档案状态与回归状态。
- [MACRO 图形模拟函数资料包](MACRO图形模拟函数资料包.md)：`SETDRAW/DRAWHOLE` 的绘图状态、模拟范围与回归状态。

## 相邻规范

- [新代 MACRO 语法规范手册](../新代MACRO语法规范手册.md)
- [新代宏程序知识图谱](../新代宏程序知识图谱.md)
- [诊断规则与修复动作](../诊断规则与修复动作.md)
