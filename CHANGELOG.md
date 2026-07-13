# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.11.2] - 2026-07-13

### Fixed
- **路径扩充引数诊断**: 不再将 `ATAN2(..., SQRT(...))` 等嵌套函数调用误判为 `,SQRT_` 路径扩充引数；仅在 `G00/G01/G02/G03` 路径单节检查 `,C_`、`,R_`、`,A_`。
- **表达式引数识别**: 路径扩充引数的方括号表达式会参与诊断，`Z[#1 + 10]` 等未确认引数可正确提示 `COR-034` 风险。

## [2.11.1] - 2026-07-13

### Changed
- **发布资料同步**: 将 v2.11.0 发布后的 README、路线图、交接说明和 MACRO 知识库导航纳入正式发布包，确保 GitHub Release 与当前 main 文档一致。

## [2.11.0] - 2026-07-13

### Added
- **AXID 轴名提示**: `AXID` 补全与 Hover 采用 `AXID(axis)` 裸轴名语法；`AXID("Y")` 显示说明型 warning，避免带引号写法与控制器语法不一致。
- **Cycle 资料库说明**: 补齐 `DBLOAD/DBINSERT` 的共享 Cycle name 覆盖关系，以及 `DBDELETE` 的明确回传码。

### Changed
- **函数 Hover 语义**: 补充图形模拟、数学定义域、单位/堆栈和 Cycle 档案函数的已核实说明与回归保护。
- **诊断文档生成**: 诊断规则表会转义 MACRO 间接变量的方括号，避免 `AR[#1]`、`#[表达式]` 被 Markdown 解析为不存在的链接。

## [2.10.0] - 2026-07-11

### Added
- **工作区符号导航**: 支持通过 `Ctrl+T` 跨文件检索静态 G/O 程序入口、`%@MACRO` 与 N 标签，并保持动态目标不参与静态解析。
- **宏调用引用查找**: 支持从静态调用目标或宏文件入口查找 `G65/G66/G66.1`、`M98/M198` 的工作区引用；变量与表达式目标不参与解析。
- **诊断文档同步检查**: 新增 `npm run docs:diagnostics:check`，文档与诊断元数据不一致时退出失败，并接入 `npm test`。
- **持续集成**: 新增 main 分支与 Pull Request 的 GitHub Actions 测试、诊断文档同步检查、ESLint 和 VS Code 集成测试；release 打包前同样执行集成测试，失败日志自动上传。
- **发布一致性检查**: 新增 package/lockfile 常规检查及 tag/package/README/CHANGELOG 发布检查，阻止版本元数据不一致时打包。
- **VSIX 内容检查**: 新增严格文件白名单、打包前自动检查及产物大小/SHA-256 报告，开发脚本不再进入发布包。
- **安装包冒烟**: 新增隔离 VS Code Profile 冒烟命令，验证已安装 VSIX 的版本、安装路径、激活与 Workspace Symbol。

### Changed
- **导航扫描性能**: Workspace Symbol 与 References 改用文本快照、单次解析索引和自动失效缓存，不再批量打开候选文档；新增 500 文件/20,000 行解析及真实工作区 I/O 基准。
- **VSIX 内容收口**: 从扩展包中排除 `scripts/`，只保留运行时模块、Marketplace 元数据、语法、snippets、icon 与许可证文件。

## [2.9.0] - 2026-07-11

### Changed
- **诊断体验整合**: README 新增诊断与 Quick Fix 用户说明，解释 error/warning、自动修复与说明型 CodeAction 的边界。
- **诊断规则文档增强**: `docs/诊断规则与修复动作.md` 从纯 code 表扩展为按场景阅读的诊断指南，同时保留自动生成的完整规则表。

### Added
- **诊断场景指南**: 补充分号规则、不支持语法、控制流、变量与函数参数、机器人/LTP 等常见诊断场景说明。

## [2.8.21] - 2026-07-11

### Added
- **v2.9.0 规划文档**: 新增 `docs/v2.9.0-规划.md`，明确 v2.9.0 发布目标、非目标、里程碑与验收标准。

### Changed
- **路线图入口**: `ROADMAP.md` 与 README 目录链接到 v2.9.0 详细规划，便于后续按 milestone 推进。

## [2.8.20] - 2026-07-11

### Changed
- **路线图收束**: 更新 `ROADMAP.md`，记录 v2.8.x 诊断体系完成状态、当前发布节奏建议与 v2.9.0 候选主题。
- **README 导航**: 在功能表和目录中补充诊断规则与修复动作相关入口。

## [2.8.19] - 2026-07-11

### Added
- **诊断规则文档**: 新增 `docs/诊断规则与修复动作.md`，列出诊断 code、分类、严重度、Quick Fix / CodeAction 与维护说明。
- **诊断文档生成脚本**: 新增 `npm run docs:diagnostics`，依据 `diagnosticCodes` 与 `diagnosticActions` 生成诊断规则文档。

## [2.8.18] - 2026-07-11

### Changed
- **集成测试稳定性**: 抽取诊断等待与 Quick Fix 应用 helper，以等待诊断状态变化取代固定延迟，降低 VS Code 集成测试脆弱性并缩短运行时间。

## [2.8.17] - 2026-07-11

### Changed
- **诊断结果排序**: 诊断返回前统一按位置、严重度与稳定 code/message 排序，使 UI 展示与测试结果更可预期。

## [2.8.16] - 2026-07-11

### Changed
- **诊断优先级过滤**: 同一区间已有错误诊断时会抑制重叠的警告诊断，减少语法错误场景下的风格提示噪音。

## [2.8.15] - 2026-07-11

### Changed
- **诊断去重稳定性**: 诊断去重 key 优先使用稳定 `code` 而非中文提示文字，避免未来调整文案影响诊断去重行为。

## [2.8.14] - 2026-07-11

### Changed
- **诊断对象工厂推广**: 将 `controlFlowValidator`、`functionArgumentValidator` 与 `robotValidator` 的诊断对象创建统一迁移到 `diagnosticFactory`，进一步收敛诊断结构。

## [2.8.13] - 2026-07-11

### Changed
- **诊断对象工厂**: 新增统一诊断对象工厂，并将 `validator` 中的手写诊断对象改为通过工厂创建，减少字段遗漏和重复结构。

## [2.8.12] - 2026-07-11

### Changed
- **诊断规则注册表**: 将行级诊断器改为带稳定 `id` 的规则注册表，并通过统一 helper 执行，便于后续新增、重排和测试诊断规则。

## [2.8.11] - 2026-07-11

### Changed
- **诊断动作元数据**: 将 Quick Fix 替换规则、说明文案与控制流闭合词抽取到独立 `diagnosticActions` 模块，降低后续新增诊断和 CodeAction 的维护成本。

## [2.8.10] - 2026-07-11

### Added
- **机器人/LTP 诊断 code**: 为机器人直接引数误用 `=`、旧式/非正式写法、平滑引数冲突、MOVC 成对规则、同步输出限制与特殊区间禁用等诊断提供稳定 code。
- **机器人/LTP Quick Fix**: 为安全可判定的写法提供自动修复，包括移除直接引数 `=`、`MOVJ-II` 改为 `MOVJ`、`TOOLCORON` 改为 `TOOLCOR`、`T_` 改为 `P_`、`TOOLCOR CLEAR` 改为 `TOOLCOR P0`。
- **机器人/LTP 集成测试**: 覆盖机器人语法 Quick Fix 在 VS Code 宿主中的实际应用结果。

## [2.8.9] - 2026-07-11

### Added
- **函数静态诊断 code**: 为数学函数定义域、I/O 点位范围、I/O 写入值、R 寄存器/bit 范围、ALARM/MSG ID、整数参数、CHKINF 类别与 OPEN COM 口径提供稳定诊断 code。
- **函数诊断说明 action**: 对无法安全自动修复的函数静态参数问题提供规则说明 Quick Fix。
- **函数诊断集成测试**: 覆盖函数静态诊断说明 action 在 VS Code 宿主中的行为。

## [2.8.8] - 2026-07-11

### Added
- **变量诊断 code**: 为命名局部/公用变量、`#0/@0` VACANT 赋值、AR/MAR 非法编号与赋值 `=` 风格建议提供稳定诊断 code。
- **变量诊断说明 action**: 对无法安全自动修复的变量编号问题提供规则说明 Quick Fix。
- **赋值风格 Quick Fix**: 对赋值语句中的 `=` 提供一键替换为推荐 `:=`。
- **变量诊断集成测试**: 覆盖变量诊断说明 action 与赋值风格 Quick Fix 在 VS Code 宿主中的行为。

## [2.8.7] - 2026-07-10

### Added
- **控制流诊断 code**: 为未匹配结束符、嵌套顺序错误、未匹配 `ELSE/ELSEIF/UNTIL`、`ELSEIF` 位于 `ELSE` 之后，以及文件结束时未闭合块提供稳定诊断 code。
- **未闭合块 Quick Fix**: 对文件结束时未闭合的 `IF/FOR/WHILE/CASE` 提供插入对应 `END_*;` 的 Quick Fix。
- **控制流集成测试**: 覆盖未闭合控制块 Quick Fix 在真实 VS Code 宿主中的应用结果。

## [2.8.6] - 2026-07-10

### Added
- **不支持语法 Quick Fix**: 为 `ELSIF`、`DEFAULT`、`DIV`、`==`、`!=`、`&&`、`||`、`%` 与 FANUC 比较关键字提供稳定诊断 code 和安全替换 Quick Fix。
- **Quick Fix 集成测试**: 覆盖多个不支持语法的真实 VS Code Quick Fix 应用流程。

### Changed
- **CodeAction 稳定性**: Quick Fix provider 可在 VS Code 未传入完整诊断上下文时回退到当前文档诊断，提升 CodeAction 查询稳定性。

## [2.8.5] - 2026-07-10

### Added
- **诊断 Quick Fix**: 为缺少行尾 `;` 与控制结构行误加 `;` 提供一键修复。
- **诊断稳定 code**: 为分号相关诊断提供稳定 code，便于测试、Quick Fix 与后续维护。
- **VS Code 集成测试**: 覆盖真实扩展宿主中的分号诊断 code 与 Quick Fix。

### Changed
- **语句分类模块**: 将语句分类与行尾分号信息抽出为独立模块，供 validator 与后续扩展能力复用。
- **测试样例策略**: 保持 `test-demo.nc` 为无诊断合法语法覆盖样例，错误场景改由测试内联样例覆盖。
- **代码片段**: 调整控制流与函数片段的行尾分号和占位符写法，确保插入结果符合当前诊断规则，并消除 VS Code snippet 语法警告。

## [2.8.4] - 2026-07-10

### Changed
- **语法诊断架构**: 新增行上下文与语句分类层，收敛分号诊断、控制流行处理与机器人旧语法规则表，降低后续规则维护成本。

### Fixed
- **分号诊断**: 按新代 MACRO 控制流语法区分控制结构行与完整语句；`END_*` 与 `UNTIL ... END_REPEAT` 等完整语句缺少 `;` 会报错。
- **控制结构诊断**: `IF/ELSEIF/FOR/WHILE/CASE/REPEAT/ELSE` 与空 `CASE` 标签等结构行误加行尾 `;` 会报错。

## [2.8.3] - 2026-07-10

### Added
- **扩展图标**: 新增 VS Code 扩展图标资源，并随 VSIX 一起打包发布。

## [2.8.2] - 2026-07-09

### Added
- **新代宏程序知识图谱**: 新增 `docs/新代宏程序知识图谱.md`，并从 README 链接，便于快速理解语法与能力边界。

### Changed
- **语法高亮**: 补充不等号 `<>` 的运算子高亮。
- **VSIX 打包内容**: 更新 `.vscodeignore`，排除 `.vscode` 本地配置。

### Fixed
- **语法诊断**: 对不支持的 `DIV`、`==` 与 `!=` 运算子提供明确报错与替代写法提示。
- **语法诊断**: 支援合法不等号 `<>`，避免被误判为不支持语法。

## [2.8.1] - 2026-06-28

### Added
- **G10 L1803/L1805 Hover**: 补充 MACRO IO TYPE-1/TYPE-2 的悬停文档，覆盖指令格式、引数范围、Q 引数范例、版本与限制说明。
- **G10 L1803/L1805 Snippet**: 新增 `g10l1803` 与 `g10l1805` 代码片段。
- **G10 通讯指令 Hover/Snippet**: 补充 `G10 L1021`、`G10 L1022`、`G10 L1900/L1901`、`G10 L1910/L1911` 的通讯指令悬停文档与代码片段。
- **G10 R 寄存器与讯号等待 Hover/Snippet**: 补充 `G10 L1000`、`G10 L1810`、`G10 L1820` 的悬停文档与代码片段。

### Changed
- **语法手册**: 同步 `G10 L1803` 与 `G10 L1805` 定义，修正 `G10 L1805` 最低版本口径。
- **语法手册**: 补充 ENIP、EtherCAT 物件字典、Modbus-TCP/RS485 相关 `G10` 通讯指令说明。
- **语法手册**: 补充 `G10 L1000` R 寄存器写入与 `G10 L1810/L1820` 讯号等待说明。

## [2.8.0] - 2026-06-28

### Added
- **后续路线图**: 新增 `ROADMAP.md`，记录 validator 拆分、VS Code 集成测试、formatter 评估和跳转能力扩展等后续待办。
- **补全回归测试**: 增加函数补全 snippet 测试，覆盖无参函数、普通函数和 `STKTOP[index]` 方括号签名。
- **VS Code 集成测试**: 新增 `npm run test:integration`，覆盖扩展激活、补全、悬停、GOTO 跳转、大纲符号和诊断配置开关。
- **保守 formatter**: 新增格式化 Provider，仅调整缩进并移除尾随空白，不重排或改写宏语句。
- **扩展跳转覆盖**: 支持 `G66/G66.1 P_` 跳转 G 宏程序、`M98/M198 P_` 跳转 O 副程序，以及 `G65/G66/G66.1 P"Name"` 静态字符串宏名跳转。
- **G/M 代码 Hover 数据表**: 新增 `src/codeDocs.js`，为常用 G/M 代码提供签名和说明，并用于 Hover 与 M 码补全说明。

### Changed
- **VSIX 打包工具链**: 固定 `@vscode/vsce` 为本地 devDependency，`npm run package` 使用本地 `vsce`。
- **README 功能口径**: 移除尚未实现的格式化文档操作说明。
- **validator 模块拆分**: 将函数静态参数诊断拆到 `src/functionArgumentValidator.js`，将机器人/LTP 单行与跨行状态诊断拆到 `src/robotValidator.js`，将控制流栈诊断拆到 `src/controlFlowValidator.js`。

### Fixed
- **函数补全 snippet**: 无参函数如 `SLEEP()` / `WAIT()` 不再被补成带占位参数的调用；`STKTOP[index]` 使用方括号 snippet。
- **配置贡献结构**: `package.json` 直接贡献 `syntecMacro.*` 设置键，与 README 和代码读取口径保持一致。
- **DocumentSymbol Provider**: 修复 VS Code 大纲 Provider 方法名，避免集成测试宿主报 `provideDocumentSymbols is not a function`。

## [2.7.0] - 2026-06-28

### Added
- **单一语法真源手册**: 新增并扩充 `docs/新代MACRO语法规范手册.md`，覆盖文件格式、变量、运算子、控制流、宏呼叫、登录 G/M/T 码、函数、机器人 LTP 指令、预解流程和撰写规范。
- **宏文件识别策略**: 支援常见加工档后缀 `.nc/.cnc/.tap/.prt/.mpf/.ptp/.pim/.anc/.bj/.edit/.demo`，并以 `%@MACRO` 首行作为内容识别依据。
- **纯文件解析工具**: 新增 `src/fileResolver.js`，统一宏程序文件名标准化和候选文件搜索逻辑。
- **机器人 LTP 补全与高亮**: 新增 `WAITSYNC`、`ENDSYNC`、`CIRMODE`，以及 `G01.101/102`、`G04.101/102/103`、`G10.101`、`G11.101/102/103`、`G12.101`、`G52.101`、`G53.101/102`、`G141.2`、`G142.*`、`G143.1`、`G144.*`、`G145.*`、`G192.*` 等机器人替代 G 码。
- **路径扩充引数诊断**: 识别 `,C_`、`,R_`、`,A_`，并对未确认路径扩充引数如 `,Z_` 提示 `COR-034` 风险。
- **变量基础诊断**: 对 `#0` / `@0` 作为赋值目标提示 VACANT 只读；对 AR/MAR 负数或小数静态编号报错。
- **函数静态诊断**: 对 `ATAN2(0,0)`、`POW` 负基底、`LN` 非正数、I/O 范围、`ALARM/MSG` ID、`PARAM/CHKINF` 参数与 `OPEN("COM1")` 提供静态提示。
- **MOVC 单行写法**: 支援新版 `MOVC X1=... X2=...` 单行写法，不再误判为缺少第二行 MOVC。
- **机器人区间互斥诊断**: 补齐 `WAITSYNC/ENDSYNC`、`G192.1/G192.2` 与 `STITCHON/WEAVEON` 区间禁用规则。
- **回归测试**: 增加机器人关键字、替代 G 码、路径扩充引数、VACANT 赋值和 AR/MAR 编号诊断测试。

### Changed
- **扩充 G/O 程序策略**: 扩充 G 码与 O 码副程序优先按无后缀文件处理，跳转搜索优先查无后缀候选。
- **文件关联收紧**: 移除 `.macro`、`.scp`、`.G` 的默认全局关联，仅通过 `%@MACRO` 首行或手动切换语言识别。
- **MOVJ 第二语法口径**: `MOVJ-II` / `INCMOVJ-II` 仅作为文档中的第二语法称呼，不作为正式指令补全或高亮；诊断提示改为使用 `MOVJ` / `INCMOVJ` 第二语法。
- **README 更新**: 更新机器人指令能力、文件识别策略和 VSIX 版本说明。

### Fixed
- **测试隔离**: 将纯文件解析逻辑从 `extension.js` 拆出，避免 Node 单元测试直接加载 VS Code API。
- **递归跳转候选一致性**: 递归搜索与 includePath 搜索统一使用 `fileResolver` 后缀策略。

## [2.6.5] - 2026-06-27

### Added
- **AI 语法覆盖 Demo**: 重构 `test-demo.nc` 为紧凑语法速查文件，覆盖变量规格、控制流、运算符、函数、宏调用、机器人指令与 G/M 码形态
- **风格建议诊断**: 对兼容但不推荐的短结束符 (`ENDIF`/`ENDFOR`/`ENDWHILE`/`ENDCASE`/`ENDREPEAT`) 提示使用标准 `END_*` 写法
- **赋值风格提示**: 对赋值 `=` 提示建议使用 `:=`，条件比较 `=` 不误报
- **命名变量诊断**: 对 `#TEMP` / `@TEMP` 等控制器不支援的命名变量报错
- **DIV 诊断**: 对不支援的 `DIV` 运算子报错，提示使用 `/` 并说明整数除法规则
- **比较运算诊断**: 对不支援的 `==` 报错，提示等于比较使用单独的 `=`
- **语法覆盖补强**: 支援动态 M 码高亮 (`M#4`)、`=` 比较高亮、局部间接变量 `#[expr]`、动态/字符串宏调用示例

### Changed
- **补全与 Hover**: 移除不推荐短结束符的补全和 Hover 文档提示，仅保留语法兼容与诊断提醒
- **代码片段**: FOR snippet 改用推荐赋值写法 `:=`
- **文档整理**: README 与使用手册改为展示推荐写法，避免引导不推荐语法

### Fixed
- **VSIX 打包内容**: 排除本地参考 `Macro/` 目录，避免参考宏程序进入发布包

## [2.6.4] - 2026-06-26

### Fixed
- **多文档诊断防抖**: 按文档 URI 独立维护诊断 timer，避免多个打开文件互相取消诊断
- **GOTO/G65 跳转定位**: 修复 Ctrl+Click `GOTO 100` 的数字目标无法进入 Definition Provider 的问题，并限制只在目标范围内触发跳转
- **跨行块注释误报**: 修复跨行 `(* ... *)` 注释内 `IF`/`GOTO` 被语法诊断误识别的问题
- **代码片段输出**: 修复 `OPEN` 片段插入 `[, "a"]` 伪语法、`MSG` 片段带前导空格的问题

### Changed
- **控制流诊断**: 关闭关键字必须匹配当前栈顶，交叉嵌套会报明确的嵌套顺序错误
- **语法高亮同步**: 补齐 `MOD`/`&`、`AR[#n]`/`MAR[#n]`、`$1`~`$4` 的高亮规则

## [2.6.3] - 2026-06-26

### Fixed
- **代码片段 API 一致性**: 修复 14 个过时代码片段，使其与 functions.js 和技术手册一致
  - SLEEP/WAIT: 移除错误的毫秒参数，改为无参数 `SLEEP();`/`WAIT();`
  - OPEN/PRINT/CLOSE: 移除旧的"文件号"API，改为路径式 API
  - READABIT/SETABIT: 修正参数数量（3→1、3→2）
  - SYSVAR/CHKMN/PARAM/SETDRAW: 修正参数类型
  - DBSAVE/DBINSERT/DBNEW: 修正参数（文件名→索引等）
- **README 文档错误**:
  - 移除对不存在的 `STR()` 函数的引用（手册仅有 `STR2INT`）
  - 函数数量 `88+` → `60+`（实际 62）
  - 代码示例语法修正：FOR/WHILE 缺 `DO`、`X[#3*10]` 方括号运算、裸中文注释
  - 函数片段表移除不存在的 `abs/str/sqrt/random` 前缀，替换为真实片段

### Changed
- **测试用例**: "SLEEP doc mentions milliseconds" 重命名为 "SLEEP takes no parameters"，验证无参数签名
- **片段回归测试**: 新增 snippets 一致性测试，锁定 SLEEP/WAIT/OPEN/CLOSE/READABIT/SETABIT 正确签名

## [2.6.2] - 2026-06-25

### Changed
- **版本统一管理**: 移除源文件中的硬编码版本号，统一从 package.json 读取
- **文档同步**: 更新 README.md 和 CHANGELOG.md 中的版本号至 2.6.2

### Added
- **GETPR/SETPR 函数**: 添加系统参数读写函数定义
- **SLEEP 函数文档**: 完善 SLEEP() 函数说明，明确其无参数特性

### Fixed
- **SLEEP 函数签名**: 修正为 `SLEEP()`（无参数），移除了错误的毫秒参数描述
- **测试文件版本号**: 移除测试文件中的硬编码版本号注释

## [2.6.1] - 2026-06-23

### Changed
- **validator.js 重构**: 将 validateDocument 函数（约290行）按职责拆分为6个独立验证器函数
  - collectMetadata: N标签收集与%@MACRO文件头检查
  - validateChineseCharacters: 中文字符与标点检测
  - validateParentheses: 括号匹配验证
  - validateControlFlowKeyword: 控制流关键字栈操作
  - validateUnclosedBlocks: 文件结束未关闭块检查
  - validateGotoReferences: GOTO标签引用验证
- **策略模式**: 引入 LINE_VALIDATORS 数组，行级验证器可插拔扩展
- **版本号统一**: 更新至 v2.6.1

## [2.6.0] - 2026-06-23

### Added
- **机器人指令代码片段**: 新增 18 个代码片段（MOVJ/MOVL/MOVC/INCMOVJ/INCMOVL/USERCOR/OBJCORON/TOOLCOR/SKIPCOND/SWAITSIG/SYNCOUT/WEAVEON/PAUSE/GETPR/SETPR/SLEEP/M198/G66.1）
- **G 码补全**: 新增 G04.102、G68.18、G192.1、G192.2 机器人专用 G 码
- **单元测试**: 新增 6 个测试用例（机器人指令、GETPR/SETPR、新 G 码、M198、PAUSE、SLEEP 文档）
- **README 机器人指令章节**: 新增机器人指令分类表和范例

### Changed
- **README 版本同步**: 更新至 v2.6.0（版本徽章、功能表、函数数 88+、VSIX 文件名）
- **测试脚本**: 更新为运行两个测试文件（validator.test.js + extension.test.js）

### Fixed
- **跨行块注释中文字符误报**: 修复 `(* ... *)` 跨行注释内的中文字符被误报为错误的问题

## [2.5.0] - 2026-06-22

### Changed
- **版本号统一**: 统一所有源码文件版本注释为 v2.5.0
- **test 脚本**: package.json 新增 `npm test` 脚本

### Fixed
- 修复跨行块注释 `(* ... *)` 导致的括号匹配误报（`*)` 被误认为多余右括号）

### Removed
- 删除临时调试文件 `check-demo.js`
- 删除重复文档 `docs/CHANGELOG.md`（根目录 CHANGELOG.md 为唯一权威）
- 移除失效的 `build` 脚本（引用不存在的 `build/build_grammar.py`）
- 清理 `src/validator.js` 头部过时的 v1.3.6 历史注释

## [2.4.0] - 2026-06-22

### Changed
- **函数说明全部中文化**: 所有内置函数的悬停文档说明改为中文（参考《新代控制器技术参考手册》）
- **版本号统一**: 统一所有源码文件版本注释为 v2.4.0

### Fixed
- 修复 `#` 变量前显示黑色方块的问题（`editor.colorDecorators: false`）
- 修复 REPEAT/UNTIL/EXIT 嵌套语法诊断误报

## [2.3.0] - 2026-06-22

### Added
- **机器人指令完整支持** (参考《新代控制器技术参考手册》)
  - 移动指令: MOVJ, MOVL, MOVC, INCMOVJ, INCMOVL
  - 坐标系指令: USERCOR, OBJCORON/OFF/CLEAR, TOOLCOR/ON/OFF
  - 应用指令: SKIPCOND, SKIP, SWAITSIG, SYNCOUT, WEAVEON/OFF, STITCHON/OFF, POSEMAP, SHIFTON/OFF, PAUSE
  - 速度与轨迹参数: ACC, DEC, FJ, FEJ, FL, FR, PL, PQ, PR
- **新 G 码支持**
  - G04.102: 等待计时
  - G192.1/G192.2: 末端追踪
  - G68.18: 设定用户坐标系
  - G10 L 值: 可程序资料输入 (L1000, L1021, L1900, L1901, L1910, L1911, L1805)
- **G67**: 取消模式宏程序呼叫
- **M198**: 呼叫子程序 (另一路径)
- **MOD 操作符**: 模数运算支持
- **轴群辨识符号**: $1~$4 语法高亮

### Changed
- **IF 条件括号支持**: 支持无括号形式 `IF #1 = 1 THEN`
- **CASE 冒号语法**: 支持 `<值>: <语句>` 冒号分隔
- **& 操作符**: 识别为布尔 AND (与 AND 等效)
- **比较运算符警告**: 检测 GT/EQ/LT/GE/LE/NE 等新代不支持的比较符,提示使用 `<` `>` `<=` `>=` `=` `<>`

### Fixed
- 函数签名修正 (参考手册):
  - ALARM: `ALARM(code)` 或 `ALARM(code, "message")`
  - MSG: `MSG(id)` 或 `MSG("content")` 或 `MSG(id, "content")`
  - SLEEP: `SLEEP()` 无参数，暂时放弃宏程序循环执行权
  - GETPR/SETPR: `GETPR(prNumber)` 和 `SETPR(prNumber, value)`

## [2.2.0] - 2026-06-22

### Added
- 嵌套深度检测 (最高 10 层)
- 宏程序块数量检测 (最高 256 个)
- IF/WHILE/CASE 缺少 THEN/DO/OF 检测
- 行尾分号检测
- M99 结尾检测

### Fixed
- 块注释多行处理
- CASE 块验证逻辑优化

## [2.1.0] - 2026-06-22

### Added
- 代码片段模板
- 诊断防抖 (300ms)
- includePath 配置支持

## [2.0.0] - 2026-06-22

### Added
- 智能补全增强
- 悬停文档
- 代码跳转
- 实时诊断
- Outline 大纲

## [1.0.0] - 2026-06-22

### Added
- 初始版本
- 基础语法高亮
- 基本代码补全
