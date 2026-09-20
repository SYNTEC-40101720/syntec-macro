# MACRO 知识与验证规划

本规划将 Atlassian MCP 可访问的新代正式资料转化为可验证的扩展能力。目标不是扩大静态诊断数量，而是让每项语言支持都有明确的控制器版本、运行时边界、测试证据和用户可见行为。

本文件是 MACRO 规则开发的计划真源：阶段状态、能力状态、证据边界、验收标准和迭代记录只在这里维护。开发固定在当前工作区；GitHub 推送用于远端同步、备份和协作，不替代本地验证。当前电脑的开发与推送操作见 [开发交接说明](../开发交接说明.md)。

关联资料：

- [Atlassian MACRO 知识记录](Atlassian-MACRO知识记录.md)
- [新代 MACRO 语法规范手册](../新代MACRO语法规范手册.md)
- [MACRO LTP 专项资料包](MACRO-LTP专项资料包.md)
- [开发交接说明](../开发交接说明.md)
- [诊断规则与修复动作](../诊断规则与修复动作.md)
- [发布记录](../../CHANGELOG.md)

## 0. 发布门禁

`v2.10.0` 至 `v2.14.0` 均已正式发布。本规划承接后续 MACRO 知识验证和能力实施，新增功能应进入后续版本，避免回写已发布版本的收口范围。

| 门禁 | 条件 | 通过前允许的工作 |
| --- | --- | --- |
| G0：资料整理 | 已建立本地知识框架和来源记录 | 只读检索、文档、测试设计、样例草案 |
| G1：发布基线 | 远端 CI、tag、Release、下载产物安装验证完成 | 开始下一版本的代码与测试改动 |
| G2：能力实施 | 每项能力具备版本、来源、最小样例和验收标准 | 修改 validator、hover、补全或导航 |
| G3：发布候选 | 单元、集成、文档同步、人工验证完成 | 版本升级与发布准备 |

当前状态：G0/G1/G3 已完成，`v2.10.0` 至 `v2.15.0` 已推送并发布；3.x 架构版本暂不切换版本号，必须等 Rust/Wasm 正式导入生产后端并完成跨平台构建、回滚和发布门禁；JavaScript Analysis Core/协议/Host 继续作为当前生产架构，Rust/Wasm 继续开发态对照；CALL-01 至 CALL-13 的资料、静态导航边界和首轮自动化验证已完成，CF TechManual 的 C-Type 与当前 `G66.1` 页面已确认 CNC 侧基础语义，但 81RA 差异仍待 CNC 模拟器/控制器复核；ROB-001 已完成 Rovo 官方页面支持的静态范围/Q 联动批次，完整参数/警报/机型/运行时条件仍待逐项验证；能力矩阵已建立，详见 [MACRO 能力矩阵](MACRO能力矩阵.md)；FUN-A 至 FUN-F 已完成首轮审计与保守实现；`v2.15.0` 已完成 Modbus-TCP 静态诊断、语言数据门禁和发布收口，后续按证据成熟度推进 G2 和 Rust/Wasm 导入门禁。

`v2.15.0` 已通过发布门禁并发布：新增 Modbus-TCP `G10 L1900/L1901` 静态诊断、同步 Hover/语法手册/正反例回归；CNC 模拟器/控制器运行时验证仍未纳入本轮，`GETPR/SETPR` 强诊断继续阻塞。未来 3.x 发布目标是 Rust/Wasm 正式导入生产后端并收口新架构，不在导入前提前升级版本号。

## 0.1 v2.13.0 发布内容

`v2.13.0` 已按“证据闭环优先、静态规则保守、架构债务按收益推进”的原则完成发布。目标不是单纯增加诊断数量，而是把 `v2.12.0` 已暴露的产品差异、证据边界和维护风险收口；本节保留本次发布的范围、门禁和明确不纳入项。

### 发布主题与优先级

#### P0：ROB-001 LTP 专项规则闭环

- 对已有 CF 公开页面逐指令补齐参数集合、参数范围、警报、最低版本、适用产品/机型和跨行状态；优先覆盖 `MOV*`、`MOVC`、`STITCHON/WEAVEON`、`SWAITSIG`、`SYNCOUT`、`TOOLCOR`、`USERCOR`、`OBJCOR`、`POSEMAP`、`SHIFTON`、`SKIP`、`WAITSYNC` 和 `G192.1/G192.2`。
- 规则只有在适用范围和静态判定条件明确时才进入 `robotValidator.js`；LTP 专属限制必须按产品/载体隔离，不得对通用 CNC MACRO 误报。
- 每条新增规则同步更新语法规范手册、能力矩阵、LTP 资料包、稳定诊断 code、Quick Fix/说明型 action 和正反例测试。
- 验收标准：每条已实现规则都具备来源、版本/范围、最小合法样例、最小非法样例和回归测试；参数或运行时证据不足的内容只进入文档，不升级为 error。

#### P0：调用与预解运行时边界收口

- 复核 CNC 与 81RA 在 `G66/G66.1` 触发次数、`M198` 重读、`M99 P_` 返回和 `WAIT()` 例外上的差异。
- 使用统一记录格式保存控制器/产品、软件版本、程序样例、预期行为、观察结果和风险；不把单一产品的运行时结果推广成通用 MACRO 规则。
- 验收标准：调用语义资料包、能力矩阵和相关集成样例的边界一致；无法取得控制器/模拟器证据时，明确标记为阻塞，不新增强诊断。

#### P1：函数证据阻塞与保守文档完善

- 继续维护 `GETPR/SETPR` 的证据阻塞状态；在取得 A 级函数页或可复核控制器记录前，不增加参数范围、权限、返回值或写入时机诊断。
- 继续补齐 `SYSVAR` 及 FUN-A 至 FUN-F 的版本、失败行为和适用范围说明，但优先改善 hover/资料包，不以静态规则数量作为完成标准。
- 验收标准：证据不足项在能力矩阵、函数资料包和 hover 中使用一致措辞，不出现“已支援”与“待验证”并存的状态漂移。

#### P1：核心分析链路维护性与性能

- 优先统一 `lexer.js`、`navigationSymbols.js` 和 `functionArgumentValidator.js` 的注释/字符串剥离状态机，避免后续语法变化造成诊断、导航和参数检查行为漂移。
- 评估工作区导航从“每次请求扫描候选文件”向增量索引演进；先用现有导航基准确认瓶颈，再决定是否引入文件监听或更细粒度缓存。
- 为函数/关键字/语法高亮等分散数据增加一致性检查，暂不进行高风险的大规模数据结构重写。
- 验收标准：现有单元/集成测试无行为回退，导航基准有可比较结果，只有测得收益的改动才进入发布候选。

#### P2：发布体验和维护工具

- 评估无后缀且无 `%@MACRO` 文件头的 G/O 程序自动识别边界；若产品需求确认需要支持，再设计不误识别普通文本的语言关联方案。
- 完善发布候选检查与安装冒烟的失败提示，保持 VSIX 内容、版本元数据和 GitHub Release 一致性。
- P2 项目不得阻塞 P0 证据闭环，也不得以工具重构替代功能验收。

### 明确不纳入 v2.13.0 的事项

- 没有 A/B 级来源或可复核运行时记录的强制 error。
- 将 81RA、CNC、LTP 或 APP Macro 的产品专属行为泛化为所有 MACRO 文件规则。
- 在没有性能基线和回归保护的情况下重写整个解析器或导航系统。
- 在 G3 之前修改版本号、CHANGELOG 发布段落或创建新的 Release tag。

## 1. 目标与非目标

### 目标

1. 建立 MACRO 能力矩阵，所有规则可追溯到来源、版本与测试。
2. 先验证调用、变量生命周期和预解等高风险运行时语义。
3. 仅把可静态确定且低误报的规则升级为诊断。
4. 统一吸收控制器、机器人、Script、APP Macro 的新代 MACRO 规则，并按载体与产品范围分层维护；通用规则共用，专项规则限定适用范围。

### 非目标

- 不把内部笔记、搜索摘要或单一机台经验直接变成强制 error。
- 不在没有控制器版本与适用范围时宣称“通用支持”。
- 不尝试用 VS Code 静态分析替代图形模拟或实机时序验证。
- 不回写已发布版本的范围；新增能力进入后续版本规划。

## 2. 证据模型

每个能力项须登记如下字段；没有 A 级来源或版本条件的项目只能保持“待验证”。

| 字段 | 说明 |
| --- | --- |
| 能力 ID | 稳定编号，例如 `CALL-G65-001` |
| 主题 | 调用、变量、函数、控制流、机器人或部署 |
| 结论 | 明确的可验证规则，避免模糊描述 |
| 范围 | 控制器、机型、系统、功能选配 |
| 最低版本 | 已确认的起始版本；未知时写“待确认” |
| 来源 | 官方页面标题与 URL |
| 插件行为 | 高亮、补全、hover、warning、error、无静态检查 |
| 自动验证 | 测试文件、断言与命令 |
| 运行时验证 | 图形模拟、控制器或人工步骤 |
| 风险 | 误报、漏报、加工安全、性能或兼容性 |

来源等级沿用 [Atlassian MACRO 知识记录](Atlassian-MACRO知识记录.md) 的 A 至 D 分级。只有 A/B 级来源可进入实现排程。

### 能力与任务编号

能力矩阵使用稳定的能力 ID，例如 `CALL-001`、`FLOW-001`；本规划使用可完成的任务 ID，例如 `CALL-01`、`FUN-A-09`。任务应在说明中引用所属能力 ID，便于从实施记录回溯到能力状态。当前映射为：`CALL-01` 至 `CALL-07` 对应 `CALL-001` 与 `CALL-002`，`FUN-A-*` 至 `FUN-F-*` 对应 `FUN-001` 至 `FUN-003`。

## 3. 分阶段执行

### Phase 1：版本基线与能力矩阵

状态：已完成；能力矩阵与版本基线已建立，后续按专题增量维护。

#### 资料收集

- 确认支持的控制器系列、目标最低版本和机器人产品范围。
- 从官方手册整理范围控制流、大档案、函数、变量和调用功能的最低版本。
- 对每个现有 `src/functions.js` 条目登记来源、参数、返回行为和版本。

#### 产物

- `docs/MACRO能力矩阵.md`。
- 每条规则对应的来源 URL、适用版本、插件状态和测试位置。

#### 验收

- 不存在“已实现但无来源/版本”的高严重度诊断。
- 每个新增或修改的诊断都能在矩阵中定位。

### Phase 2：调用语义专题

状态：静态导航、Hover、资料收集、81RA 首轮运行时验证和 CALL-13 保守 warning 已完成；CF TechManual 的 C-Type 与当前 `G66.1` 页面已确认 CNC 侧基础触发语义和完整范例，但未提供最低软件版本或 81RA 例外说明，CNC 上与 CF 不一致的行为复核仍待执行。

#### 范围

- `G65`、`G66`、`G66.1`、`G67`。
- `M98`、`M198`、`M99`。
- `P`、`H`、`L` 引数；标准字母引数与 `GETARG` 扩充引数。
- 区域变量独立、继承、回收与返回位置。
- 调用与 `WAIT()` 的边界。

#### 资料收集任务

1. 先以 TechManual/LTP 的 CF 正式页面取回上述指令的完整章节、示例及版本条件。
2. 再以《Macro变数规格》复核每种调用方式的 `#1` 至 `#400` 生命周期。
3. 对 `G65`、`G66/G66.1`、`M98/M198` 分别记录一份最小合法样例和一份应保守处理的动态目标样例。
4. 对 `M198` 的重读行为、`M99 P_` 返回行为以及 `WAIT()` 例外建立“控制器/模拟器验证”条目。

#### 实现任务

- 审查 `src/navigationIndex.js`、`src/fileResolver.js`、`src/navigationSymbols.js` 中静态调用目标解析，与正式命名/调用规则对照。
- 扩充 `tests/extension.test.js` 和集成测试工作区，覆盖数字目标、命名目标、静态字符串目标、动态目标、注释和普通字符串边界。
- 只有在规则可由文本确定时才加诊断；运行时生命周期和 `WAIT()` 不新增 error。

#### 验收

- 调用导航对静态目标准确，对动态目标明确不跳转。
- 新增测试覆盖每类调用的成功与拒绝边界。
- 变量作用域、返回位置和 `M198` 重读行为至少完成图形模拟或目标控制器验证记录。

### Phase 3：变量与资料访问专题

状态：已完成首轮审计与保守实现；后续按控制器、机器人和 APP 适用范围补齐来源与运行时证据，`GETPR/SETPR` 仍为证据阻塞。

#### 范围

- `#0/@0` VACANT、区域变量、模态变量、公用变量与 R 映射。
- 系统变量、使用者参数、AR/MAR 和 APP Macro 路径。
- `PARAM`、`SYSVAR`、`SYSDATA`、`DRVDATA`、`GETARG`。

#### 实施顺序

1. 先实现无版本歧义的 `#0/@0` 写入提示。
2. 评估静态可判定的 R 保留区写入 warning。
3. 为 `SYSDATA`、`DRVDATA` 补参数形态、版本、`WAIT()` 前置条件的 hover 和参数测试。
4. 将 AR/MAR 保持为路径/APP 上下文限定能力，避免在普通 MACRO 误报为语法错误。

#### 验收

- 每个变量 warning 都有精确的区间、来源和适用系统。
- 不对表达式索引或未知机型做不可靠范围推断。
- `tests/fixtures/test-demo.nc` 保持零诊断。

### Phase 4：函数与控制流专题

状态：已完成首轮函数、控制流和诊断回归；后续按版本和运行时边界增量核对，不等待 Phase 3 的所有专项证据完成。

#### 范围

- 数学、转换、I/O、档案、Cycle 数据库、系统控制函数。
- `IF`、`CASE`、`FOR`、`WHILE`、`REPEAT` 的版本、深度与大档案限制。
- `ALARM`、`MSG`、`SLEEP` 的运行时行为。

#### 实施原则

- 函数按类别核对，避免一次性重写 `src/functions.js`。
- 将“语法错误”与“版本/运行时风险”分为 error、warning 和 hover 说明。
- 控制流超过 10 层可先作为可配置 warning 候选；完成版本核对和性能验证前不设为 error。

#### 验收

- 每一函数类别至少有参数、版本、失败行为和正反例。
- 语法测试、诊断文档生成和 VS Code hover 集成测试同步更新。

### Phase 5：载体专项扩展与全域收口

状态：在统一 MACRO 核心之上持续推进；按证据成熟度并行补齐 LTP 机器人、Script 与 APP Macro 的专项规则，不把任一载体当作插件的独立产品路线。

#### 范围

- LTP 机器人 `MOV*`、坐标系、姿态与替代语法。
- 常驻 Script 的并发、全域变量、错误模型与限制。
- APP Macro 的 AR/MAR 与部署路径。

#### 验收

- 插件统一覆盖通用 CNC MACRO、机器人、Script 与 APP Macro；各载体的语言边界清晰，测试按适用范围隔离。
- 通用 MACRO 规则在统一分析链路中复用；机器人、Script 或 APP 的专项限制只在对应产品/载体范围内生效，不互相误报。

## 4. 验证策略

| 层次 | 适用问题 | 证据 |
| --- | --- | --- |
| 单元测试 | 词法、静态变量范围、函数参数、控制流配对 | `tests/validator.test.js` |
| 扩展模块测试 | 导航解析、hover、补全、诊断动作 | `tests/extension.test.js` |
| VS Code 集成测试 | Provider 注册与编辑器内可见行为 | `npm.cmd run test:integration` |
| 离线样例 | 每项能力的最小通过/警告/错误输入 | `tests/fixtures/test-demo.nc` 与测试内联/工作区样例 |
| 图形模拟 | 运动、预解、调用、状态及返回时序 | 控制器模拟器记录 |

## 5. 文档治理迭代记录

本节登记文档架构治理的版本、动机与后续路径,避免重复登记状态与规则漂移。详细分层与职责边界见 [macro-knowledge/README.md](README.md#文档分层与职责边界)。

### 批次1:去重 + 加固导航 + CF 首轮补全(2026-09-14)

- [macro-knowledge/README.md](README.md) 新增"文档分层与职责边界"小节,明示四层架构与状态唯一登记点。
- [Atlassian-MACRO知识记录.md](Atlassian-MACRO知识记录.md) 的"已核实核心规则"压缩为索引摘要,"当前插件认知地图"全部链接到 [能力矩阵](MACRO能力矩阵.md),上文不再重复登记。
- 6 份函数资料包顶部统一加"状态登记边界"说明,指向能力矩阵,不再重复登记插件状态。
- [开发交接说明.md](../开发交接说明.md) 补"文档治理基线"约定。
- CF 首轮补全:[语法规范手册](../新代MACRO语法规范手册.md) 的 G04.102 升级为已确认/部分待确认(版本 `10.118.40G`、`10.118.44`,I/X 引数与 `ms` 时间单位依官方页面与同语系推定);MOVC 跨行规则补齐 CF 官方页面确认的模态/坐标系/RBT-124/RBT-127 边界;G193.110 标注 CF 未找到独立规格页面;§13 待确认清单同步更新。

### SOURCES-1:PLC 介面说明 → R 寄存器完整区段语义(2026-09-14)

- CF 两个 A 级页面首次采编: [PLC 介面说明](https://syntecclub.atlassian.net/wiki/spaces/TechManual/pages/44105796) 、 [Macro 变数规格](https://syntecclub.atlassian.net/wiki/spaces/TechManual/pages/44106246) 的 @→R 映射后可写范围。
- [§2.5 公用变量 @](../新代MACRO语法规范手册.md#25-公用变量--1) 新增 "R 寄存器完整区段语义" 与 "R 寄存器经 @ 昻射后可写范围" 两小节,补足区段语义(包括 R81~R100 对应 Pr3401~3420 唯读、R101~R102 刀具状态唯读 FRAM、R512~R639 不支持位元存取等 PLC 侧细节)。
- [能力矩阵 VAR-002](MACRO能力矩阵.md) 状态从"部分核实"升级为"R 语义已核实",后续可评估静态可判定 R 保留区写入 warning 的实现路径。
- [Atlassian-MACRO知识记录.md](Atlassian-MACRO知识记录.md) 新增 "A 级与 B 级主来源补充(SOURCES 轮次)"表,同时登记控制器诊断变数、控制器参数总表等待采编主来源。
- §13 待确认项更新: `Pr3811` 保留范围表达方式转移至 SOURCES-3(需《控制器参数总表》)。
- [开发交接说明.md](../开发交接说明.md) 与 [诊断规则与修复动作](../诊断规则与修复动作.md) 未变;静态诊断实现改动未入本批,留待后续代码批次。

### SOURCES-2:控制器诊断变数 → 执行线程诊断变量(2026-09-14)

- CF 三个 A 级页面采编: [控制器诊断变数](https://syntecclub.atlassian.net/wiki/spaces/TechManual/pages/44106009) 、 [MACRO开发应用手册](https://syntecclub.atlassian.net/wiki/spaces/TechManual/pages/44106050/MACRO) 、 [NetPLC 使用说明](https://syntecclub.atlassian.net/wiki/spaces/TechManual/pages/44106337/NetPLC)。
- [§1.10 MACRO 读取/处理流程](../新代MACRO语法规范手册.md) 的诊断变量表从原 6 项重整:
  - CF 证实 `D320`/`D324`/`D376` 解译与减速三角(加工中消耗序列化);
  - CF 证实 `D388` Script executor 平均时间,后续如需 Script executor 监控优先用此号而不是原手册的 D994/D995;
  - CF 证实 NetPLC `D932`/`D933` 同步时间诊断(起始版本 10.118.86K、10.120.16K、10.120.24B、10.120.27+),作为 NetPLC 同步寄存器性能诊断入口;
  - 列出 `D978/D979/D994/D995` 在 CF 未获证实的诚实结论;删除原手册中缺乏 CF 背书的 "D978/D979 大于4倍 PLC 扫描时间" 原则。
- [能力矩阵](MACRO能力矩阵.md) 新增 `DIAG-001` 能力行,状态 "D 语义已核实";`§13` 待确认项同步更新 D 诊断号项标题。
- [Atlassian-MACRO知识记录.md](Atlassian-MACRO知识记录.md) 主来源表升级"控制器诊断变数"状态为已采编,新增 NetPLC 主来源。
- 后续: `D978/D979/D994/D995` 需实机或控制器内部规格复核;SOURCES-3 进入《控制器参数总表》。

### SOURCES-3:控制器参数总表 → Pr3811/Pr3813 精确参数格式(2026-09-14)

- CF 评审: [控制器参数总表](https://syntecclub.atlassian.net/wiki/spaces/TechManual/pages/44105816) 入口可见; [Macro变数规格](https://syntecclub.atlassian.net/wiki/spaces/TechManual/pages/44106246/Macro) 证实 Pr3811(控制 @1~@400 断电保留)与 Pr3813(开启 CE 扩充 @60000~@79999) 功能本体。
- CF 未提供的内容: Pr3811/Pr3813 的精确参数条目格式、颗粒度与默认值,以及 Pr3598/Pr3601/Pr3701/Pr3215/Pr3829 其他参数的详细页面。
- 手册与规划同步:
  - [§2.5 公用变量 @](../新代MACRO语法规范手册.md#25-公用变量--1) 补充 "Pr3811/Pr3813 功能本体 CF 证实,但精确参数格式需 PDF 或实机查表" 的说明。
  - [§13 待确认项](../新代MACRO语法规范手册.md) 中 Pr3811/Pr3813 条目更新为「功能本体 CF 证实,精确格式需实机/PDF」。
  - [Atlassian-MACRO知识记录.md](Atlassian-MACRO知识记录.md) 主来源表升级 "控制器参数总表" 状态,新增 "扩充参数使用说明手册" 来源行。
  - [能力矩阵 VAR-002](MACRO能力矩阵.md) 能力状态保持「R 语义已核实」; Pr3811/Pr3813 精确格式列入后续实机证据依赖。
- 后续: Pr3811/Pr3813/Pr3598 等参数精细格式需实机页面、控制器参数总表 PDF 或 CF 未公开页面获取; CF 公开页面已到边界。

### SOURCES-4:LTP 语法指令规格总表 → 逐指令 CF 单页入口(2026-09-15)

- CF LTP 空间单页规格首次采编: `MOVL`、`MOVJ` 第一/第二语法、`MOVC`、`INCMOVL`、`INCMOVJ`、`STITCHON/STITCHOFF`、`WEAVEON/WEAVEOFF` 共 8 个指令独立页面 URL；本轮再补 `SWAITSIG`、`SYNCOUT`、`TOOLCOR`、`USERCOR`、`OBJCORON/OFF/CLEAR`、`POSEMAP`、`SHIFTON/SHIFTOFF`、`SKIPCOND/SKIP`、`WAITSYNC/ENDSYNC`、`CIRMODE`、`G192.1/G192.2`、`G68.18` 共 12 个入口，合计 20 个。
- [MACRO-LTP专项资料包.md](MACRO-LTP专项资料包.md) 新增 `## 3.5 逐指令 CF 公开页面入口` 小节,登记每个指令的 CF 页面 URL 与核心引数范围(避免与手册 §6 完整引数表重复)。
- CF 摘要证实的关键警報线索已登记: `RBT-103`(PL/PQ/PR 三选一)、`RBT-115`(STITCHON 中间不可 MOVJ)、`RBT-124`(MOVC 座标系必须相同)、`RBT-127`(MOVC 中间指令上限 10)、`RBT-322`(WEAVEON 中间不可 MOVJ)、`COR-064`(WEAVEON P 非整数)。
- 本轮已登记的 12 个入口中，CF 摘要明确 `SWAITSIG` 的 `P/Q/R/L/T` 引数集合；其余页面的完整参数、警报、版本、机型和运行时条件仍需逐页审计，不将入口发现升级为规则实现。

### 代码批次 1:R 保留区写入 warning(WARN-R001,2026-09-15)

- SOURCES-1 把 VAR-002 推进到「R 语义已核实」后,本代码批次把可静态判定的 R 保留区段写入从手册规则升级为诊断 warning。
- 新增诊断码 `SYNTEC_PUBLIC_VAR_R_RESERVED_WRITE`(`src/diagnosticCodes.js`),默认 warning 级别。
- 新增说明型 CodeAction 「查看 R 寄存器保留区说明」(`src/diagnosticActions.js`),提示可写区段替代。
- `src/validator.js` `validateVariableAccess` 末尾新增 R 保留区检测:仅检查一行范围内「赋值左侧」,@401~655/@10000~14095/@100000~165535 三段 @→R 映射后,若 R 区段落在 `R0~R49`/`R81~R102`/`R512~R639`/`R640~R1023` 保留区则报 warning;表达式索引 `@[#1]` 不静态可判定,不报。
- `tests/validator.test.js` 新增 8 条回归断言:映射到保留区报 warning、映射到可写区不报、@1~@400 不映射不报、表达式索引不报等边界。
- `tests/fixtures/test-demo.nc` 零诊断保持不受影响(确认未新增误报)。
- 诊断文档重生成;lint、validator 测试(新增 8 个断言)与 `npm.cmd test`(243/243)全部通过。

### 代码批次 2:R 保留区检测扩展 R11000~R14999(WARN-R002,2026-09-15)

- 承接能力矩阵 VAR-002 后续验证条目,把手册 §2.5 明确点名的「未列出保留段」`R11000~R14999`(含 `R13001~R14095` 原手册点名的子段)纳入 `SYNTEC_PUBLIC_VAR_R_RESERVED_WRITE` 检测范围。
- `src/validator.js` `validateVariableAccess` 的 `isReserved` 条件新增 `rNum >= 11000 && rNum <= 14999`,并补充对应 reason 文本;R5800~R7999/R10000~R10999/R15000~R65535 三段可写区段保持不报。
- `src/diagnosticActions.js` 说明型 CodeAction 消息同步更新保留区段列表与可写区段列表。
- `tests/validator.test.js` 新增 3 条回归断言:`@111000`/`@113001`/`@114999` 映射到 R11000~R14999 报 warning,`@115000`/`@165535` 映射到 R15000~R65535 可写段不报,`@105800`/`@110000` 映射到 R5800/R10000 可写段不报。
- 手册 `R4096~R5111`/`R5112~R5799`/`R8000~R9999` 等"未列出"段虽在手册口语含义内,但未明确点名且可能涉及 DOS/WinCE/Linux 系统差异,暂不静态检测,待实机复核后再评估。
- 策略:黑名单扩展(只报手册明确点名的区段)而非白名单(只放行明确可写段),以把误报成本压到最低,系统差异由 hover 说明承担。

### 代码批次 3:控制流嵌套深度 warning(FLOW-002,2026-09-15)

- 手册 §4 已明确列出 `IF/CASE/REPEAT/WHILE/FOR` 互相嵌套上限为 10 层,超过会触发控制器 `COM-007` 巢状超过 10 层;本批次据此把"超过 10 层"从规划候选升级为静态 warning。
- 新增诊断码 `SYNTEC_CONTROL_NESTING_DEPTH_EXCEEDED`(`src/diagnosticCodes.js`),默认 warning 级别;对应控制器 `COM-007`。
- 新增说明型 CodeAction 「查看嵌套深度说明」(`src/diagnosticActions.js`),提示拆分子程序或扁平化嵌套结构。
- `src/controlFlowValidator.js` 新增 `NESTING_DEPTH_LIMIT = 10` 常量;`validateControlFlowKeyword` 在 OPENER 分支 push 前判断 `stack.length >= NESTING_DEPTH_LIMIT` 即报 warning,确保第 11 个 opener 触发而第 1~10 个不报。
- `tests/validator.test.js` 新增「7b. 控制流嵌套深度」测试组:10 层 IF/END_IF 不报、11 层 IF/END_IF 触发 1 条 warning;fixture `tests/fixtures/test-demo.nc` 最深仅 3 层(FOR > IF > IF),未新增误报。
- 设计选择:Threshold 用 `stack.length >= 10` 而非 `> 10`,以确保"达到 10 层后再 push 第 11 个"才报,避免 10 层合法深度被误报;阈值保持硬编码,版本差异由 hover 说明承担,不做配置化以维持插件简洁。
- `scripts/generateDiagnosticDocs.js` 把新码加入 `severityFor` 的 warning 集合;`npm.cmd run docs:diagnostics` 已重生成诊断表。
- lint、`npm.cmd test`(248/248)全部通过。

### 批次2:独有函数细节回填到手册 §9(2026-09-15)

- 五处独有运行时边界从资料包回填到 [语法规范手册 §9](../新代MACRO语法规范手册.md#9-函数规则):
  1. `DRVDATA`(§9.5): `"D61h"` 十六进制字符串格式 `x=0~F` 结尾 `h` 小写;未支援状态变量 `COR-016`、格式错误 `COR-023`。
  2. Cycle(§9.8): `DBLOAD` 会设为 Cycle name 为当前资料 name,`DBINSERT` 连续调用覆盖前者是官方语义;`DBDELETE` 四档返回码语义;`DBSAVE` 前置条件含 `DBINSERT`。`
DBLOAD`/`DBINSERT` 连续调用規范为官方运行时行为。
  3. `ALARM`/`MSG`(§9.10): `ALARM` 需复位清除;`MSG` ESC清除与程序结束自动消失;`MSG("text")` 预设 ID 版本差异表。`
  4. `STD`/`STDAX`(§9.3): `#1600` 为 LIU 及运算前官方建议标准化;`Pr17`/`Pr3241`/单位制均为控制器配置。
  5. `SETDRAW`/`DRAWHOLE`(§9.12): RGB `0xFF0000` ↔ BGR `0x0000FF=255` 示例;`DRAWHOLE` 后原色回写恢复顺序。
- 5 份资料包顶部状态登记说明从「只维护审计细节与运行时证据」升级为「独有细节已回填到手册§9,本包转为运行时验证+审计归档」。
- 手册§9 现在拥有与资料包一致的完备细节,后续修改源代码时只需查手册。

### 批次3:资料包合并 6→1(按需)

- 当 LTP 专项资料包膨胀到一定程度或函数审计批次完成整合后,评估把 6 份函数资料包合并为 1 个 `MACRO函数审计资料包.md`,按 FUN-A → FUN-F 排列,统一三段式骨架。
- 当前不合并:各资料包已有标准三段式结构,合并需同步更新 `README.md` 与 `能力矩阵.md` 链接,且 LTP 资料仍在增长,过早合并可能捆住手脚。
| 实机验证 | I/O、PLC R、驱动器数据、选配与机型差异 | 版本、机型、程序、观察结果与风险说明 |

新规则的最低验收组合：A/B 级来源 + 单元测试 + 扩展集成测试；涉及运动、预解或外部 I/O 时，额外要求图形模拟或实机记录。

## 5. Phase 2 的首批任务清单

| ID | 工作 | 类型 | 完成条件 |
| --- | --- | --- | --- |
| CALL-01 | 收集 `G65`、`G66`、`G66.1`、`G67` 的正式章节 | 资料 | 已完成：URL、参数与变量生命周期已登记。 |
| CALL-02 | 收集 `M98`、`M198`、`M99` 的正式章节 | 资料 | 已完成：`P/H/L`、返回与重读行为已登记。 |
| CALL-03 | 建立调用能力矩阵条目 | 文档 | 已完成：[MACRO 调用语义资料包](MACRO调用语义资料包.md)。 |
| CALL-04 | 增加静态调用目标回归样例 | 自动测试 | 数字、命名、字符串、动态和注释边界均覆盖 |
| CALL-05 | 设计变量生命周期验证程序 | 模拟/实机 | `G65` 独立与 `M98/M198` 继承可观察 |
| CALL-06 | 设计 `WAIT()` 边界验证程序 | 模拟/实机 | 明确记录 `M98/M99/M198` 例外行为 |
| CALL-07 | 审查导航实现和资料一致性 | 代码审查 | 已完成：[MACRO 调用语义资料包](MACRO调用语义资料包.md) 已记录实现一致项、最小改动清单与非静态验证边界。 |
| CALL-08~12 | 完成调用 Hover 与静态导航边界回归 | 实现/自动测试 | 已完成：覆盖调用语义说明、动态目标、`G67`/`M99` 边界和 `G66.1` Definition Provider。 |
| CALL-13 | 诊断 `G65/G66/G66.1` 后仍有其他 G 码 | 实现/自动测试 | 已完成：新增 `SYNTEC_CALL_MACRO_NOT_LAST_G_CODE` warning，覆盖合法顺序、注释和字符串边界；不提供自动重排。 |

## 6. 固定验证命令

开发中的每个小批次至少执行与改动相匹配的检查；进入候选阶段执行完整组合：

```powershell
npm.cmd run docs:diagnostics:check
npm.cmd test
npm.cmd run lint
npm.cmd run test:integration
npm.cmd run test:integration:navigation
node -e "const fs=require('fs'); const {validateDocument}=require('./src/validator'); const diagnostics=validateDocument(fs.readFileSync('tests/fixtures/test-demo.nc','utf8')); console.log(diagnostics.length ? diagnostics : 'tests/fixtures/test-demo.nc diagnostics: none')"
```

涉及发布时，追加 `npm.cmd run package` 和 `npm.cmd run smoke:installed`。文档或资料收集阶段只需执行 Markdown/链接检查和 `git diff --check`，不制造无关测试噪音。

## 7. 架构演进与 Rust 路线（2026-09-19）

本节承接 `v2.15.0`，并定义未来 3.x 架构发布范围，是后续架构工作的计划真源。目标是保持现有 VS Code 用户体验和诊断语义不变，正式收口 JavaScript Analysis Core/协议/Host；Rust 是可替换的核心后端候选，只有完成正式导入条件后才进入 3.x 生产版本。

### 7.1 GitHub 范例与可采纳结论

| 范例 | 已观察到的模式 | 本项目的采用结论 |
| --- | --- | --- |
| [rust-analyzer](https://github.com/rust-lang/rust-analyzer) 的 [Architecture](https://rust-analyzer.github.io/book/contributing/architecture.html) | LSP 入口、分析库和客户端适配分层；输入源代码作为内存状态，分析结果为惰性派生状态；小范围输入变化可重新计算受影响的结果；核心不直接做 I/O。 | 采用 `DocumentSnapshot`/`AnalysisHost` 思路，让诊断、导航、格式化共享一个纯分析入口。 |
| [tree-sitter](https://github.com/tree-sitter/tree-sitter) | 面向编辑器逐键解析，语法树可在编辑后增量更新，并能在语法错误时保留有用结构；同时提供 Rust 和 Wasm 绑定。 | 作为增量解析候选进行 spike；不预先承诺采用，控制流状态、LTP 规则和控制器版本仍需独立语义分析。 |
| [VS Code LSP sample](https://github.com/microsoft/vscode-extension-samples/tree/main/lsp-sample) / [vscode-languageserver-node](https://github.com/microsoft/vscode-languageserver-node) | Client 负责 VS Code 生命周期，Server 负责文档同步、诊断、补全和配置；协议使用增量文本同步和能力协商。 | 先保留现有直接 Provider；只有确认需要多编辑器支持时，才引入 LSP Client/Server 边界。 |
| [tower-lsp](https://github.com/ebkalderon/tower-lsp) | Rust 侧以 `LanguageServer`、`LspService` 和 stdio/TCP Server 组织 LSP 实现。 | 作为未来 Rust LSP 的实现参考，不作为当前 VSIX 的直接依赖。 |
| [napi-rs](https://github.com/napi-rs/napi-rs) | Rust Node-API 原生模块可由 JavaScript 调用，但发布通常需要按平台/架构拆分可选包，并由 CI 构建目标矩阵。 | N-API 只在 Wasm 试点证明收益后评估；Windows 之外的平台和 VSIX 内置二进制分发是必须先解决的发布问题。 |

### 7.2 目标架构

```text
VS Code Adapter（当前 JavaScript，后续可逐步 TypeScript 化）
  ├─ Provider 注册、配置、文件系统、Quick Fix、状态栏
  └─ 将文本快照/增量编辑转换为核心请求
             │
             ▼
Syntec Analysis Core（稳定协议，禁止直接 I/O）
  ├─ Lexer / Token
  ├─ 容错 Parser / Syntax Tree 或 IR
  ├─ Profile-aware semantic analysis
  ├─ Diagnostics / Symbols / References / Formatting
  └─ AnalysisResult：稳定 code、位置、severity、符号和编辑
             │
             ├─ 当前后端：JavaScript
             ├─ 试点后端：Rust + Wasm
             └─ 性能证明后：Rust + N-API 或独立 LSP
```

核心协议必须满足：

1. 不读取工作区、不写文件、不调用 VS Code API；文件解析和 `includePath` 由适配层提供输入。
2. 诊断 code、位置、severity 和动态值“不推断”边界保持稳定，不能因更换后端而改变用户语义。
3. 所有 Provider 从同一份 Token/IR/Index 获取信息，禁止再次编写注释、字符串和关键字剥离逻辑。
4. 核心错误必须结构化返回；适配层只能记录上下文并向用户显示，不能静默降级成成功结果。

### 7.3 分阶段里程碑

| 里程碑 | 范围 | 完成条件 |
| --- | --- | --- |
| M0：基线与协议 | 保持 JavaScript 默认后端；定义 `DocumentSnapshot`、`AnalysisResult`、`Diagnostic`、`Symbol` 和 `TextEdit` 的内部协议；建立代表性黄金样例。 | 现有诊断 code/位置/严重度无回退；`test-demo.nc` 保持零诊断；Provider 行为继续由现有集成测试保护。 |
| M1：核心收敛 | 将 lexer、statement classifier、导航符号和验证器逐步收敛到一个纯分析入口；开启核心模块严格 JSDoc 或 TypeScript 检查。 | 不再由不同 Provider 重复解析同一语法；全量测试与大文件基准都有可比较的基线。 |
| M2：增量解析试验 | 对自定义 Parser 与 Tree-sitter 各做最小可运行原型，覆盖注释、字符串、控制流、N 标签、G/M 调用和错误恢复。 | 以真实 MACRO 样例比较正确性、编辑延迟、内存和维护成本；没有测量收益时不替换现有实现。 |
| M3：Rust 核心试点 | 新增独立 `crates/syntec-core`，先实现 lexer + 控制流诊断；通过 Wasm 或 CLI 接入，JavaScript 保留为对照后端。 | 差分测试覆盖现有黄金样例；Rust 后端失败时明确回退 JavaScript；VSIX 不增加不可验证的平台二进制。 |
| M4：后端选择 | 若 Rust 在大文件分析或增量编辑上有明确收益，再评估 N-API；若目标扩大到多个编辑器，再评估 `tower-lsp` 独立 Server。 | 有性能数据、目标平台构建矩阵、VSIX 安装冒烟、回滚路径和发布产物校验；否则停留在 TypeScript/JavaScript 核心。 |

### 7.4 下一版优先级

1. **P0：证据和产品边界**——继续区分 CNC、81RA、LTP、Script、APP Macro；补齐调用/预解运行时验证，不把单一机型行为提升为通用 error。
2. **P0：核心协议和黄金样例**——先固定当前行为，再做解析器或语言后端替换；所有新规则必须进入能力矩阵、手册、正反例和稳定诊断 code。
3. **P1：类型与单一数据源**——收紧核心类型，统一函数/关键字/诊断元数据，继续生成 Hover、补全、Snippet 和诊断文档。
4. **P1：增量与性能**——测量诊断和 500 文件导航基线，优先做取消、增量索引和缓存失效；只有实测瓶颈才引入 Rust。
5. **P2：跨编辑器**——仅在确认 VS Code 之外的需求后，将核心包成 LSP Server；LSP 不是为了替换现有 Provider 而引入。

### 7.5 发布与回滚门禁

- Rust 后端不得改变已发布的诊断 code、范围、严重度和动态值保守策略。
- 必须保留 JavaScript 后端作为至少一个完整版本的回滚路径；不允许只在本地可运行、无法生成 VSIX 的实现进入发布候选。
- Wasm 试点优先于 N-API；N-API 需要明确 Windows/Linux/macOS 目标、Node-API 兼容性、二进制校验和 CI 构建矩阵。
- 性能结论必须来自真实基准和回归样例，不能以“Rust 理论上更快”作为迁移理由。
- 架构迁移不得绕过现有 `docs:diagnostics:check`、`check:data`、VSIX 内容检查、集成测试和安装冒烟。

### 7.6 M3 后端决策（2026-09-20）

当前 Rust/Wasm 试点通过了以下门槛：

- `crates/syntec-core` 可在隔离 GNU Rust 1.98.1 toolchain 下编译和测试。
- Native CLI 与 JavaScript 核心在控制流诊断的 5 个差分样例上保持稳定 code、位置和 severity 一致。
- Wasm protocol v1、UTF-8 输入、内存释放、诊断 JSON，以及 `%@MACRO`/`N`/静态调用导航子集均已由 Node probe 验证。
- 20,000 行档案的 Wasm JSON bridge p50 约 58~105ms（受运行环境波动影响），但当前 Rust 只覆盖控制流诊断和导航子集。

**决策：3.x 正式版本前不切换 Rust/Wasm 生产后端。** Rust/Wasm 与完整 JavaScript 分析能力仍存在明确缺口：LTP/Modbus 完整规则、机器人状态、格式化 `TextEdit`、完整导航/引用、产品 profile 和所有已发布诊断 code 尚未 parity。Rust/Wasm 继续保持开发态，不进入 VSIX，不改变当前 2.15.0 JavaScript 用户行为。

完整 bridge 的下一阶段验收条件：

1. 全部黄金样例和现有诊断 code/位置/severity parity；
2. `AnalysisResult` 的 diagnostics、symbols、navigation、TextEdit 和 profile 全量覆盖；
3. Windows GNU/MSVC、Wasm 与 CI 的可复现构建矩阵；
4. 启动、内存、JSON 传输和大档案延迟相对于 JavaScript 的真实对比；
5. JavaScript 默认回退、VSIX 安装冒烟和至少一个完整版本的回滚路径。

### 7.7 未来 3.x 架构发布范围（Rust/Wasm 导入后）

- **导入前生产后端**：JavaScript `analysisProtocol`、`analysisCore`、`AnalysisHost`、Worker/Provider 门面，继续服务当前 2.x 版本。
- **导入条件**：Rust/Wasm 完成全部目标 parity、request/profile/TextEdit/导航结果、跨平台构建矩阵、回滚验证和性能门禁。
- **用户可见承诺**：保持 v2.15.0 的诊断 code、位置、严重度、导航、格式化和配置行为；3.x 是架构收口，不是规则语义重写。
- **开发态资产**：在导入条件满足前，Rust CLI/Wasm、差分脚本、Parser/Tree-sitter spike 只作为仓库开发验证工具；`src/rustWasmAdapter.js` 已进入可发布代码边界但不注册、不默认启用、不携带 Wasm 资产。
- **发布门禁**：导入条件满足后，版本元数据、全量 npm 回归、lint/typecheck、VS Code 集成、导航基准、VSIX 内容检查、隔离安装冒烟、tag/Release/资产核验全部通过后才创建 3.x Release。

## 8. 迭代记录

| 日期 | 阶段 | 结论 |
| --- | --- | --- |
| 2026-07-13 | G0 | Atlassian MCP 已验证可读取新代 Confluence；完成知识框架、来源分级和本执行规划。 |
| 2026-07-13 | CALL-07 | 导航与 hover 审查完成；`node --test tests/extension.test.js` 37/37 通过，作为 CALL-08 至 CALL-13 的回归基线。 |
| 2026-07-13 | G0 | 完成能力矩阵初稿，登记版本基线、62 个函数的分批审计策略及静态分析边界。 |
| 2026-07-13 | FUN-A | 完成调用与资料访问函数的首轮审计，详见 [MACRO 函数审计资料包](MACRO函数审计资料包.md)。 |
| 2026-07-13 | FUN-B | 完成系统控制函数的首轮审计，详见 [MACRO 系统控制函数资料包](MACRO系统控制函数资料包.md)。 |
| 2026-07-13 | G1 / FUN-A-09 | 核验 `v2.10.0` 远端 tag 和公开 GitHub Release；新增 `SYSDATA` 静态字符串/小数整数诊断，validator 150/150 与触及文件 ESLint 通过。 |
| 2026-07-13 | G2 / CALL-08~10 | 更新 `G65/G66/G66.1/G67/M98/M198/M99` hover 语义，扩展模块测试 37/37 与触及文件 ESLint 通过。 |
| 2026-07-13 | G2 / CALL-11~12 | 新增 `G67/M99` 非调用边界和 `G66.1` Definition Provider 回归；扩展模块测试 37/37、VS Code 集成套件和触及文件 ESLint 通过。 |
| 2026-07-13 | G2 / FUN-B-08~09 | 更新 `WAIT()` 调用例外与 `MSG()` 清除/版本 hover；扩展模块测试 38/38 与触及文件 ESLint 通过。 |
| 2026-07-13 | G2 / FUN-B-10~11 | 增加 `ALARM/MSG/CHKINF` 正例和 `CHK*` 返回值/版本回归；validator 151/151、扩展模块测试 39/39 与触及文件 ESLint 通过。 |
| 2026-07-13 | G2 / FUN-A-10 | 更新 `GETARG/GETTRAPARG` hover 的来源差异与 VACANT 说明；扩展模块测试通过。 |
| 2026-07-13 | G2 / FUN-A-11 | 增加 `PARAM` 单参数、轴群参数正例回归；validator 152/152 与触及文件 ESLint 通过。 |
| 2026-07-13 | G2 / FUN-A-12 | 依据正式函数表新增 `DRVDATA` 常量格式诊断与 hover；validator 153/153、扩展模块测试和诊断文档同步通过。 |
| 2026-07-13 | FUN-A-13 | Rovo 精确检索未找到 `GETPR/SETPR` 的 A 级函数页；记录为证据阻塞，不新增静态规则。 |
| 2026-07-13 | FUN-C | 核实 I/O/A 点与 R bit 范围，并补充 `SETDO/SETABIT` 的插值阶段 PLC 写入冲突说明；扩展模块测试通过。 |
| 2026-07-13 | FUN-D | 核实 `OPEN/PRINT` 路径顺序与 Cycle DB 单档案、初始化、储存前置条件；扩展模块测试通过。 |
| 2026-07-13 | FUN-E | 依据函数表修正 `ATAN2` 象限示例、版本与 `(0,0)` 定义域说明；扩展模块测试通过。 |
| 2026-07-13 | FUN-E | 补充 `STR2INT` 小数字符串截断与 `SCANTEXT` ASCII 转码还原说明；扩展模块测试通过。 |
| 2026-07-13 | FUN-E | 完成 `STD/STDAX/PUSH/POP/STKTOP` 首轮审计：补充单位转换、`Pr3241=1` 与非破坏性栈读取 hover，建立专题资料包和模块回归；不新增依赖控制器参数或运行时栈状态的诊断。 |
| 2026-07-13 | FUN-E | 依据 `RS-008` 正式报警页新增 `SQRT` 负常量定义域诊断与 hover；动态引数保持不推断，validator 回归通过。 |
| 2026-07-13 | FUN-E | 依据正式函数页新增 `ACOS/ASIN` 常量 `-1~1` 定义域诊断与 hover；边界值和动态引数保持不误报，模块与 validator 回归通过。 |
| 2026-07-13 | FUN-E | 完成 `MAX/MIN/SIGN/RANDOM` 首轮审计：固定双输入选择、符号返回与随机数区间的 hover 回归；未取得静态失败条件，保持无诊断。 |
| 2026-07-13 | FUN-E | 完成 `CEIL/FLOOR/ROUND` 首轮审计：固定上下取整和四舍五入的 hover 回归；未取得静态失败条件，保持无诊断。 |
| 2026-07-13 | FUN-E | 完成 `ABS/SIN/COS/TAN/ATAN/EXP` 首轮审计：固定绝对值、角度制三角函数、反正切范围和自然指数的 hover 回归；未取得静态失败条件，保持无诊断。 |
| 2026-07-13 | FUN-E | 完成 `LN/POW` 首轮审计：补齐 `RS-008`、`COR-122` hover 报警说明并固定现有定义域诊断回归；动态引数保持不推断。 |
| 2026-07-13 | FUN-F | 完成 `SETDRAW/DRAWHOLE` 首轮审计：补齐 BGR 色码、路径颜色恢复和当前绘图状态 hover，建立专题资料包与模块回归；颜色、半径和实际渲染不做静态诊断。 |
| 2026-07-13 | FUN-D | 完成 Cycle 资料库函数首轮审计：补齐 `DBLOAD/DBINSERT` 的共享 Cycle name 覆盖语义与 `DBDELETE` 明确回传码，建立专题资料包与模块回归；档案状态、index 与版本差异不做静态诊断。 |
| 2026-07-13 | FUN-B | 核实 `AXID(axis)` 的裸轴名语法：补全签名与 hover，并对静态字串轴名增加说明型 warning；不推断实际轴配置或不存在轴的运行时结果。 |
| 2026-07-28 | FUN-B-12 | 通过 Atlassian MCP 查询 Confluence，`SLEEP` 和 `AXID` 的 A 级来源在 Macro Function List 确认，与现有 hover 一致；FUN-B-12 完成。 |
| 2026-07-28 | FUN-A-13 | 通过 Confluence CQL 搜索确认 `GETPR/SETPR` 无函数页，维持证据阻塞；需控制器验证或其他 A 级来源。 |
| 2026-07-28 | 运行时验证 | 在 81RA / 10.120.44C 完成 CALL-RUN-01~07、FUN-D、FUN-E、FUN-F 首轮记录；`G66/G66.1` 触发结果与 CNC 手册描述存在产品差异，不能跨产品推广。 |
| 2026-09-12 | G2 / CALL-13 | 依据本地正式语法手册实现 `G65/G66/G66.1` 非最后 G 码 warning；validator 162/162、扩展模块 63/63，生成诊断文档同步通过。 |
| 2026-09-12 | CF 证据复核 | 通过 TechManual C-Type 与当前 `G66.1` 页面确认 CNC 侧 `G66/G66.1` 触发范例、非最后 G 码的 `COR-013` 示例和 `SYSVAR` 签名；未找到最低软件版本或 81RA 例外说明，`GETPR/SETPR` 在当前 Macro Function List 页面未出现，继续保持相应证据阻塞。 |
| 2026-09-12 | G2 / ROB-001 | 取得 LTP《语法指令规格》和《机器人语法对应 G 码与支援版本》，建立 `MACRO-LTP专项资料包.md`，将 ROB-001 更新为“部分核实”；补齐当前对应 G 码补全并通过扩展模块 63/63，未新增版本诊断或通用 CNC 限制。 |
| 2026-09-16 | G1 / 基线同步 | 核对 `package.json`、`package-lock.json`、README、CHANGELOG、`main`、`origin/main`、`v2.12.0` tag 与 GitHub Release；同步交接说明、能力矩阵和本规划的当前状态，未引入功能改动。 |
| 2026-09-16 | v2.13.0 规划 | 确定 P0/P1/P2 优先级：先完成 LTP 参数/警报/版本证据和调用运行时边界，再推进共享词法状态机、导航增量索引和数据一致性检查；`GETPR/SETPR` 继续保持证据阻塞。 |
| 2026-09-16 | v2.13.0 / 共享词法状态机 | 将注释/字符串剥离与字符串位置判断统一到 `src/lexer.js`，供 validator、formatter、navigation 和函数参数检查复用；新增跨行块注释、字符串内注释标记和转义引号回归，`npm.cmd test` 249/249、lint 通过。 |
| 2026-09-16 | v2.13.0 / LTP 静态范围 | 依据已登记 CF 摘要，为 `MOVL/MOVC/INCMOVJ/INCMOVL` 的 `P/Q` 与 `WEAVEON` 的 `P/L/R` 增加静态常量范围诊断；补齐稳定 code、说明型 action、诊断文档和正反例，动态变量不推断，完整回归 251/251。 |
| 2026-09-16 | v2.13.0 / 导航索引并发 | 将工作区导航索引加载改为可配置有界并发，保留默认串行取消语义并补充顺序回归；500 文件导航集成基准首次/重复查询 1207/387ms，均低于门限。 |
| 2026-09-16 | G3 / v2.13.0 发布 | 版本元数据、CHANGELOG、README、能力矩阵、交接说明与 GitHub Release 收口；`npm.cmd test` 252/252、lint、VS Code 集成和导航集成基准通过。 |
| 2026-09-16 | v2.14.0 / Rovo 官方证据复核 | 通过 Atlassian Rovo MCP Server 读取/复核 `SWAITSIG`、`SYNCOUT`、`TOOLCOR`、`USERCOR`、`POSEMAP`、`SHIFTON`、`SKIPCOND`、`WAITSYNC`、`CIRMODE`、`G192.1`、`G68.18` 等页面；页面不可读或运行时依赖项继续标记为边界。 |
| 2026-09-16 | v2.14.0 / LTP 静态规则 | 扩展 `robotValidator.js` 的单行范围与 Q 联动检查，新增坐标系指令禁用语法诊断、Hover 和正反例回归；`test-demo.nc` 保持零诊断。 |
| 2026-09-16 | v2.14.0 / 数据门禁 | 新增 `scripts/checkLanguageDataConsistency.js` 和 `npm.cmd run check:data`，检查函数定义、机器人关键字 Hover 与诊断元数据一致性，并接入 `npm.cmd test`。 |
| 2026-09-17 | G3 / v2.14.0 发布 | 版本元数据、README、CHANGELOG、能力矩阵、交接说明、VSIX 和 GitHub Release 收口；`npm.cmd test` 257/257、lint、VS Code 集成、导航基准、VSIX 打包和安装冒烟通过。 |
| 2026-09-17 | G3 / v2.15.0 发布 | 新增 Modbus-TCP `G10 L1900/L1901` 静态诊断，完成 Hover、语法手册、正反例与发布门禁同步。 |
| 2026-09-19 | 架构演进规划 | 参考 rust-analyzer、Tree-sitter、VS Code LSP sample、tower-lsp 和 napi-rs，确定“核心协议 → 增量解析试验 → Rust Wasm 试点 → 按收益选择 N-API/LSP”的路线；不进行下一版全量 Rust 重写。 |
| 2026-09-19 | M0 / 分析协议 | 新增 `DocumentSnapshot`、版本化 `AnalysisRequest/AnalysisResult` 和 JavaScript 分析后端；诊断 Worker 改用协议传输，保留 JavaScript 回退、稳定诊断 code/位置/严重度和关键字透传；新增协议黄金样例与全量回归。 |
| 2026-09-19 | M1 / 纯分析门面首批 | 格式化 Provider 与工作区导航索引入口收敛到 `analysisCore`，导航结果统一为 `AnalysisResult.navigation`；新增 `TextEdit`、`AnalysisSymbol`、导航黄金样例，保留 500 文件导航基准。 |
| 2026-09-19 | M1 / 分析性能基线 | 新增 `scripts/benchmarkAnalysis.js` 与 `npm.cmd run benchmark:analysis`；当前 JavaScript 后端 10 次测量在 20,000 行无诊断档案上记录 p50 约 386ms、p95 约 437ms，真实 fixture p50 约 9ms；后续增量解析/Rust 试点必须与该基线比较。 |
| 2026-09-19 | M1 / 分析核心类型门禁 | 新增 `tsconfig.analysis.json` 与 `npm.cmd run typecheck:analysis`，只对协议、核心后端和分析基准启用严格 checkJs；全仓库旧 JavaScript 暂不扩大检查范围。 |
| 2026-09-19 | M1 / 分析快照缓存 | 新增有界 `AnalysisHost`，Worker 与同步回退复用精确快照结果，支持 URI 失效和 FIFO 淘汰；不改变诊断结果，作为后续增量 Parser/Rust 后端的缓存边界。 |
| 2026-09-19 | M2 / 容错 Parser 原型 | 新增开发态 Parser 与 `benchmark:parser`，20,000 行样本 10 次测量约为 Parser p50 75ms / p95 84ms、完整分析 p50 370ms / p95 398ms；两者功能不等价，原型不接入生产，Tree-sitter 仍待独立比较。 |
| 2026-09-20 | M2 / Tree-sitter 工具链恢复 | 已重新下载并验证 `tree-sitter-cli@0.27.0`，CLI 可用但尚未新增 Syntec grammar 或生产依赖；下一步再做最小 grammar/corpus 比较。 |
| 2026-09-20 | M2 / Tree-sitter grammar spike | 新增开发态 `scripts/treeSitterSpike` grammar/corpus，覆盖行结构、字符串、变量、运算子和不完整文本；Tree-sitter corpus 2/2 通过，不接入生产 Provider。 |
| 2026-09-20 | M3 / Rust 工具链恢复 | 初始共享 Rust 缓存损坏，已改用隔离 GNU Rust 1.98.1 toolchain；MSVC `link.exe` 仍不可用，GNU/Wasm 试点可复现。 |
| 2026-09-20 | M3 / Rust CLI 核心首批 | 在隔离 GNU Rust 1.98.1 toolchain 下新增 `crates/syntec-core`，完成词法预处理、控制流诊断、CLI、Rust 单测和 JS/Rust 差分；不接入 VSIX，MSVC `link.exe`、Wasm/N-API 仍待后续评估。 |
| 2026-09-20 | M3 / Wasm 边界探针 | `syntec-core` 编译到 `wasm32-unknown-unknown`，release artifact 约 50.3KB；Node 原生 WebAssembly 通过最小 ABI 完成 UTF-8 内存写入、控制流诊断 JSON、符号/静态调用导航子集和释放，protocol v1 与 JS 稳定字段差分通过。尚未接入完整 `AnalysisResult` 或 VSIX 资产。 |
| 2026-09-20 | M3 / Wasm bridge 基准 | 10 次测量下 20,000 行档案 JSON bridge p50 约 105ms/p95 约 120ms、JSON 结果约 33.8KB；仍缺少完整诊断规则和 TextEdit，不把该数据当作完整分析性能结论，完整 `AnalysisResult` bridge 仍待评估。 |
| 2026-09-20 | M3 / Wasm 协议适配器 | 新增开发态 `RustWasmAdapter`，将 Rust JSON 映射为共享 `AnalysisResult`，校验 protocol version、diagnostics、symbols、edits 和 navigation；不接入生产 Provider，完整 feature parity 仍待评估。 |
| 2026-09-20 | M3 / Wasm 共享结果契约 | Rust JSON bridge 已输出共享协议的嵌套 diagnostic range/source 结构；适配器新增 range、TextEdit、symbol、navigation 深度校验，探针和基准改为验证规范化后的 `AnalysisResult`；完整规则与格式化 parity 仍未完成。 |
| 2026-09-20 | M3 / Wasm 导航子集 parity | Rust 导航试点补齐数字 G/O 目标标准化、静态命名 G 宏、字符串/注释隔离和 UTF-16 位置；8 项 Rust 单测与 Wasm/JavaScript 差分探针通过，文件元数据和完整引用能力仍未接入。 |
| 2026-09-20 | M3 / Wasm 控制流诊断 parity | Rust 试点补齐 `ELSE/ELSEIF`、`EXIT` 退出传播、10 层嵌套深度 warning 与文件结束提示；CLI/Wasm 与 JavaScript 稳定 code/位置差分样例扩展通过，其他诊断规则仍待迁移。 |
| 2026-09-20 | M3 / Wasm 基础语法诊断 parity | Rust 试点补齐 `ELSIF` 与 `DIV` 的稳定错误 code/位置/提示；CLI/Wasm 差分覆盖扩展到 12 类，运算子、分号、括号和函数诊断仍保持未迁移边界。 |
| 2026-09-20 | M3 / Wasm 基础运算子与结构边界 parity | Rust 试点补齐控制结构尾部分号、`==/!=/&&/||/+=/++/%/!` 和 FANUC 比较关键字诊断；三方差分覆盖扩展到 23 类，函数诊断仍未迁移。 |
| 2026-09-20 | M3 / Wasm 导航文件元数据边界 | `RustWasmAdapter` 增加可选 `navigationFilePath`，在适配层补齐 `programEntryName`/`macroProgramName` 与非宏文件过滤；不改旧文本 ABI，完整引用能力仍待后续。 |
| 2026-09-20 | M3 / Wasm 可选诊断 code 与括号 parity | Rust JSON bridge 支持无 `code` 字段的共享诊断，补齐括号/方括号多余与缺失 warning；CLI/Wasm/JavaScript 差分覆盖扩展到 27 类，函数诊断仍未迁移。 |
| 2026-09-20 | M3 / Wasm 静态 MOD parity | Rust 试点补齐纯数字 `MOD` 小数操作数诊断，整数和动态表达式保持不误报；三方差分覆盖扩展到 29 类。 |
| 2026-09-20 | M3 / Wasm 缺少分号 parity | Rust 试点补齐普通赋值、结束语句和 G 码等语句的缺少分号错误，排除控制结构头、分支、CASE 标签和宏头；三方差分覆盖扩展到 34 类。 |
| 2026-09-20 | M3 / Wasm 数学函数域 parity | Rust 试点补齐 `ATAN2/POW/LN/SQRT/ACOS/ASIN` 静态常量域诊断，动态引数和嵌套表达式保持不推断；三方差分覆盖扩展到 36 类。 |
| 2026-09-20 | M3 / Wasm I/O 函数范围 parity | Rust 试点补齐 I/O 点位、写入值、R 寄存器和 bit 范围诊断，动态引数保持不推断；三方差分覆盖扩展到 38 类。 |
| 2026-09-20 | M3 / Wasm 基础函数引数 parity | Rust 试点补齐 `ALARM/MSG` ID、`PARAM` 整数引数和 `CHKINF` 类别范围诊断，动态引数保持不推断；三方差分覆盖扩展到 40 类。 |
| 2026-09-20 | M3 / Wasm 变量访问 parity | Rust 试点补齐命名局部/公用变量、`#0/@0` VACANT 赋值和 AR/MAR 静态非法编号诊断，动态索引保持不推断；三方差分覆盖扩展到 42 类。 |
| 2026-09-20 | M3 / Wasm R 保留区写入 parity | Rust 试点补齐公用变量 `@` 映射到 R 保留区的写入 warning 与区段原因文案，可写区段保持不诊断；三方差分覆盖扩展到 43 类。 |
| 2026-09-20 | M3 / Wasm 字符串函数 warning parity | Rust 试点补齐 `OPEN("COM1")` 与 `AXID("Y")` warning，复用字符串/注释边界，普通文件名和裸轴名保持不诊断；三方差分覆盖扩展到 44 类。 |
| 2026-09-20 | M3 / Wasm SYSDATA/DRVDATA parity | Rust 试点补齐 SYSDATA 整数引数、DRVDATA 站号整数和第二引数格式诊断，动态变量保持不推断；三方差分覆盖扩展到 46 类。 |
| 2026-09-20 | M3 / Wasm 赋值风格 parity | Rust 试点补齐行首 `#/@/AR/MAR` 使用单独 `=` 的说明型 warning，条件比较、`==` 和 `:=` 保持不误报；三方差分覆盖扩展到 48 类。 |
| 2026-09-20 | M3 / 后端切换控制器 | `AnalysisHost` 接入显式 `javascript`/`rust-wasm` selector 和非静默 JS fallback；默认仍为 JavaScript，Rust/Wasm 只有通过完整导入门禁后才允许成为生产后端。 |
| 2026-09-20 | M3 / 中文诊断 parity | Rust 试点补齐代码区中文字符/中文标点错误，保留字符串、行注释和块注释豁免；CLI/Wasm/JavaScript 差分覆盖扩展到 49 类。 |
| 2026-09-20 | M3 / 调用边界 parity | Rust 试点补齐静态 GOTO 目标缺失 warning 与 `G65/G66/G66.1` 非行末 G 码 warning，保持字符串/注释边界和文件级标签收集；三方差分覆盖扩展到 51 类。 |
| 2026-09-20 | M3 / Go-No-Go | Rust/Wasm 子集通过 CLI、Wasm、差分和基准门槛，但因完整诊断/TextEdit/profile parity 缺口，决定继续保持 JavaScript 为唯一生产后端；完整 bridge 验收条件登记到 §7.6。 |
| 2026-09-20 | M3 / Rust parity 清单 | 新增 `docs/Rust诊断parity清单.md`，对照 `src/diagnosticCodes.js` 全部 67 个 code 登记 Rust 覆盖状态（42 已覆盖 / 25 待迁移）、未覆盖项与迁移批次，作为 3.x P0-A.1 诊断 code 收口的执行依据。 |
| 2026-09-20 | M3 / CASE DEFAULT parity | 修正 `controlFlowValidator.js` 中 `DEFAULT:` 警告的 `endCol` 计算（由 `match[0].length` 改为 `match.index + match[0].length`）并附加 `SYNTEC_UNSUPPORTED_DEFAULT` code；Rust 试点新增 `validate_case_line_style` 等价实现，补齐 CASE 块内 `DEFAULT` 标签的 warning；新增 `case-default-label` 差分样例和 Rust 单测；三方差分覆盖扩展到 52 类。 |
| 2026-09-20 | M3 / TOOLCOR parity | Rust 试点新增 `validate_robot_toolcor`，补齐 `TOOLCOR/TOOLCORON` 单行规则组（`TOOLCOR T_` 参数错误、`TOOLCORON` 弃用 warning、`TOOLCOR CLEAR` 非官方语法 warning）；修正 `robotValidator.js` 中 `TOOLCOR_T_ARG` 的 col 计算，由硬编码 `lastIndexOf('T')` 改为捕获组实际字符，消除小写输入的负 col 边界（对大写输入行为不变）；新增 5 项 `robot-toolcor-*` 差分样例与 5 项 Rust 单测；三方差分覆盖扩展到 57 类，parity 清单更新为 46/67 覆盖、21 个 `ROBOT_*` 待迁移。 |
| 2026-09-20 | M3 / ROBOT-MOV parity | Rust 试点补齐机器人运动单行规则组 parity：`MOVJ-II` 弃用拼写、`MOVC Xp/Yp/Zp` 过点写法、直接引数 `=` 错误、运动指令平滑引数 `PL/PQ/PR` 冲突与不支持、`MOVJ` 第一语法禁用 `P` 引数、`INCMOVL` 必填 `P` 引数、`MOVC` 跨行成对（含 `X1/X2` 单行写法豁免与条件分支下不强制）、`USERCOR/TOOLCOR/G68.18` 混入 CNC 进给/G 码/轴向命令/移动关键字，以及运动指令静态引数范围（MOVL/MOVC/INCMOVJ/INCMOVL + USERCOR/TOOLCOR/SHIFTON/G68.18/G43.16/POSEMAP/SKIPCOND/SWAITSIG/SYNCOUT/G192.1/CIRMODE/WAITSYNC/ENDSYNC 与 WEAVEON 双模式）和信号 `Q` 与来源 `E/P/S` 联动编码；将原 `validate_robot_syntax_preferences` / `validate_robot_confirmed_single_line` / `find_coordinate_forbidden` 等开发态漏接函数正式接入 `analyze_document` 调用链（替换原单独 `validate_robot_toolcor` 入口），并新增 `RobotLineState` / `validate_robot_line_state`（MOVC pair 子集）和文件尾 `finalize_robot_state`；新增 14 项 `robot-mov-*` 差分样例覆盖正反例与边界；三方差分覆盖扩展到 71 类，parity 清单更正为 53/67 覆盖、14 个 `ROBOT_*` 待迁移（含更正 `SYNTEC_ROBOT_G10_MODBUS_*` 由"已覆盖"误登记改回待迁移）。|
| 2026-09-20 | M3 / ROBOT-MODBUS parity | Rust 试点补齐 `G10 L1900/L1901` Modbus-TCP 静态规则组 parity：`SYNTEC_ROBOT_G10_MODBUS_INTEGER`（8 个引数 `C/I/A/Q/K/X/P/R` 的小数与 safe-int 检查）、`SYNTEC_ROBOT_G10_MODBUS_FORMAT`（L1900 C3/C6 必填/互斥/不支持 X/QK、L1901 必填 P/R/Q 与不支持 C/I/A/X、C 取值只能 3 或 6）、`SYNTEC_ROBOT_G10_MODBUS_RANGE`（任何引数不可为负、X 写入值 0~65535、P/Q 的 R 值编号 0~65535、R 自定义资料数量 0~254）；新增 `get_modbus_line`、`collect_modbus_args`、`is_safe_integer`、`join_letters` 辅助函数，把 G10 校验接入 `validate_robot_confirmed_single_line`（替换 deferred 占位），保留 JS INTEGER → FORMAT → RANGE 顺序与 col fallback 规则；新增 15 项 `robot-g10-modbus-*` 差分样例覆盖 C3/C6/L1901 边界与合法语义；三方差分覆盖扩展到 86 类，parity 清单更新为 56/67 覆盖、11 个 `ROBOT_*` 待迁移（ROBOT-STITCH-WEAVE 5 个 + ROBOT-SIGNAL 6 个）。|
| 2026-09-20 | M3 / ROBOT-STITCH-WEAVE parity | Rust 试点补齐缝焊/摆焊单行规则组 parity：`SYNTEC_ROBOT_STITCH_ARG_CONFLICT`（STITCHON 中 `L/K` 同时存在的冲突）、`SYNTEC_ROBOT_STITCH_MISSING_ARG`（缺少 `L` 或 `K` 的提示型 warning）、`SYNTEC_ROBOT_STITCH_L_INTEGER`（`L` 不可带小数点）、`SYNTEC_ROBOT_WEAVEON_MIXED_ARGS`（WEAVEON 的 `P` 语法不可与 `E/Q/K/L/R/I` 混用）、`SYNTEC_ROBOT_WEAVEON_Q_DECIMAL`（`Q` 频率未以 `Q1.0` 小数形式给出的提示型 warning）；保留 JS col 计算规则（`\b(?:L|K)` 与 `\bQ([+-]?\d+)(?!\.)` 前瞻只看首位字符的边界）；在 `validate_robot_confirmed_single_line` 中追加 STITCHON 与 WEAVEON 两个分支；新增 8 项 `robot-stitch-*` / `robot-weaveon-*` 差分样例覆盖正反例与边界；三方差分覆盖扩展到 94 类，parity 清单更新为 61/67 覆盖、6 个 `ROBOT_*` 待迁移（ROBOT-SIGNAL 末批：`SWAITSIG_LIMIT` / `SYNCOUT_LIMIT` / `RANGE_FORBIDDEN_COMMAND` 与 3 个 dead `*_Q_RANGE`）。|
| 2026-09-20 | M3 / ROBOT-SIGNAL parity (P0-A.1 收口) | Rust 试点补齐末批机器人状态机 parity：`SYNTEC_ROBOT_SWAITSIG_LIMIT`（运动单节后超过 1 个 SWAITSIG）、`SYNTEC_ROBOT_SYNCOUT_LIMIT`（同一移动单节超过 10 个 SYNCOUT）、`SYNTEC_ROBOT_RANGE_FORBIDDEN_COMMAND`（STITCHON/WEAVEON/WAITSYNC/G192.1 生效范围内禁忌指令与 M96 中断副程序 warning）；扩 `RobotLineState` 字段、重写 `validate_robot_line_state` 完整覆盖 MOVC pair、运动/WAIT 计数重置、SWAITSIG/SYNCOUT 计数与限制、四类生效范围禁忌（含 STITCHON 区间内 MOVL+SKIP）、STITCHON/WEAVEON 互斥忽略开启指令；新增 `find_keyword_col` / `find_skip_col` / `is_m_code` / `push_range_forbidden` 辅助；新增 21 项 `robot-signal-*` 差分样例覆盖限制与合法、`WAIT()` 重置、生效范围禁忌、生效关闭、互斥、M96 warning 等场景；修正 `is_m_code` 的 boundary bug；dead code `*_Q_RANGE` 两端共同保持无 emit，parity 等价；三方差分覆盖扩展到 115 类，**Rust 诊断 parity 收口完成 67/67**——P0-A.1 全部稳定诊断 code 完成 JS/Rust 等价，可进入 P0-A.2 调用与引用边界、P0-B 共享 `AnalysisResult` 合同。|
| 2026-09-20 | M3 / P0-A.2 调用与引用边界 parity | Rust 试点补齐 `collectMetadata` 中的 `% 缺 %@MACRO` 文件头 codeless warning：在 `analyze_document` 主循环中按 JS 的 `firstNonCommentIdx`/`firstNonCommentIsBarePercent`/`hasMacroHeader` 顺序判定首行 `%` 而非 `%@MACRO`、文件末尾用 `push_diagnostic_without_code` 输出等价内容与 col 范围（首行 trim 后 `%` 起始位置 + 同长度尾位置）；同时 codify 已有的 `extract_goto_target` 静态 GOTO 标签收集、`n_label_name` 的 `N100;` 行式标签、GOTO 目标缺失 codeless warning、`validate_macro_call_g_code_order` 的 `G65/G66/G66.1` 非行末 G 码 warning、`M98/M198/M99 P`/`G67` 调用与返回边界的 parity 状态；新增 15 项差分样例覆盖 `% 缺头`、`%@MACRO 不报`、`GOTO #变量` 不静态跳转、GOTO 在字符串/块注释中被豁免、多目标并存、`M99 P<target>` 返回、`G67` 取消、`G65/G66/G66.1/M98/M198` 合法调用等正反例；三方差分覆盖扩展到 130 类，P0-A.2 节点合上，可进入 P0-B 共享 `AnalysisResult` 合同。|
| 2026-09-20 | M3 / P0-B 真实 request 传输 | Rust 试点新增 `analyze_request_json` 入口与 `parse_analysis_request` JSON 解析器（serde-free，保留 ~50KB Wasm 足迹）：在 Rust 侧完整校验 `AnalysisRequest` 的 `protocolVersion`、`document.uri`/`version`/`languageId`/`text`、`profile`，校验失败返回错误串触发显式 fallback；Wasm 导出 `syntec_core_analyze_request_json`（接收整份 Request JSON，失败返回 0）；CLI 新增 `--request` 模式读取 stdin JSON 输入并输出 `AnalysisResult` JSON，与默认文本模式共存；修正 `result_to_json` 顶层对象闭合 `}` 缺失的 bug 并补齐完整 navigation 字段序列化（programEntryName/macroProgramName/symbols/calls）；`createRustWasmAdapter`（JS 适配器）优先走新 ABI 把整份 Request JSON 传给 Rust，缺失新 ABI 时降级到 legacy 文本路径并保持 backend='rust-wasm' 标记；`compare:rust` 增加 P0-B 差分环节——对 130 类样例同时跑 legacy text 与 `--request` 模式，确认两者诊断序列完全等价 (130/130)；新增 4 项 `createRustWasmAdapter` 选择逻辑单测（请求 ABI 优先、拒绝错误请求、legacy 兼容降级、双 ABI 缺失抛错）。P0-B 第 1 项「真实 request 传输」合上，下一步进入 P0-B 第 2 项「完整结果」（symbols/navigation/TextEdit/profile 协商）。|
