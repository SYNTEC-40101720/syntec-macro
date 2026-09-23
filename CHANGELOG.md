# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## 4.2.0 - 2026-09-23

### Changed

- `compare:rust` 重建为 Rust 自洽 golden file baseline（新增 `export:rust:baseline` 脚本，恢复发布硬门禁）。
- R1.2 退役脚本/测试/tree-sitter-cli 清理（净减 ~5412 行）。
- Phase 5.5 区间未关闭 emit 经 Confluence 一手规格复核决定不实现。
- 系统变数 `#1502`/`#1504`/`#1510` bit 级规格与 Confluence 一手页对齐修正。

### Added

- 跨厂商宏程序兼容专题文档（发那科/三菱 → 新代语法差异 + 多通道变量共享）。

## 4.1.0 - 2026-09-22

### Added

- 补齐 27 个稳定诊断 code 的 `DIAGNOSTIC_HELP` 用户文案，governance 升级为发布硬门禁（`--strict`）。
- Phase 5.3 第 2 项：4 个运动辅助区间禁忌拆分为独立 code（STITCHON/WEAVEON/WAITSYNC/G192）。
- Phase 5.3 第 1 项：`SYNTEC_ROBOT_MOVC_INTERMEDIATE_LIMIT`（RBT-127）emit 落地。
- Phase 5.1 控制器实测复核回填（23 个采集块，CALL-RUN/FUN-A-13/ROB-LTP）。
- Phase R2 数据表迁移收口（4 表迁到 `src/data/*.json` + thin loader）。
- R1.3 VSIX 体积与启动基线刷新（`perf-baseline/v4.0.0.json`）。

### Fixed

- Phase 5.3 第 3 项：`cargo test --lib` 既有 navigation 测试破损修复。

## 4.0.0 - 2026-09-22

### Changed — Breaking (R1.2 Stage B: JS 后端退役)

- Major 升级 3.1.0 → 4.0.0：JS 分析后端彻底退役，`syntecMacro.analysisBackend` 收敛为 `['rust-wasm']` 单值。
- 12 个 JS 分析器模块删除（净减 ~4218 行），Host provider 走 `hostRustAnalyzer`，Worker 硬切 rust-wasm。
- 旧配置值 `javascript`/`rust-wasm-shadow` 升级后被 VS Code 拒绝并回退 `rust-wasm` 默认；无用户数据迁移。

## 3.1.0 - 2026-09-21

### Changed

- Phase 1.5：默认 backend 由 `javascript` 切到 `rust-wasm`（JS 保留 fallback）。

## 3.0.0 - 2026-09-20

### Changed

- Major 升级 2.15.0 → 3.0.0：Rust/Wasm 进 VSIX 作 experimental，默认 backend 仍 `javascript`。
- 生产 Wasm 资产 `assets/rust-wasm/` bundle 进 VSIX。
- P0-C 生产 Wasm 资产加载器 + Worker 生命周期/fallback 集成测试落地。
- P0-B 真实 request 传输 + 完整结果（navigation/edits/profile）parity 合上。
- P0-A 诊断 code parity 收口（67/67）+ 调用与引用边界 parity。
- 发布前 readiness 自检工具 `check:release:readiness` + 跨平台 CI 矩阵 + 真实性能数据采集。

## 2.15.0 - 2026-09-17

### Added

- Modbus-TCP `G10 L1900/L1901` 静态语法诊断。

## 2.14.0 - 2026-09-17

### Added

- LTP 静态引数与 Q 联动诊断（USERCOR/TOOLCOR/G68.18/SWAITSIG/SYNCOUT/WAITSYNC/G192.1 等）。
- `SYNTEC_ROBOT_UNSUPPORTED_COORDINATE_SYNTAX` 坐标系语法边界诊断。
- 语言数据一致性门禁 `check:data`。

### Changed

- 导航缓存通过文件监听主动失效，500 文件重复查询降至 281ms。

## 2.13.0 - 2026-09-16

### Added

- LTP 静态引数范围诊断（MOVL/MOVC/INCMOVJ/INCMOVL 的 P/Q + WEAVEON 的 P/L/R）。
- 导航索引有界并发加载。

### Changed

- 注释/字符串/转义引号处理统一到共享 `src/lexer.js`。

## 2.12.0 - 2026-09-15

### Added

- `SYNTEC_PUBLIC_VAR_R_RESERVED_WRITE` 扩展检测 R11000~R14999 保留区。
- `SYNTEC_CONTROL_NESTING_DEPTH_EXCEEDED` 控制流嵌套超 10 层 warning。

## 2.11.9 - 2026-08-05

### Fixed

- 方括号 `[]` 多余/缺失匹配诊断。

## 2.11.8 - 2026-07-29

### Changed

- `extension.js` 按 Provider 拆分为 7 个模块。
- 注释/字符串剥离逻辑统一到 `src/lexer.js`。
- 函数参数校验常量化并标注手册出处。
- 新增 `jsconfig.json` + `@types/node` 启用局部 `@ts-check`。

### Fixed

- README 徽章一致性校验前置到常规 `check:release`。

## 2.11.7 - 2026-07-28

### Added

- 81RA 机器人系统 14 项运行时验证（CALL-RUN/FUN-E/FUN-D/FUN-F）。

### Fixed

- Issue Template YAML front matter 格式修复。

## 2.11.6 - 2026-07-28

### Fixed

- 发布脚本与 CHANGELOG 段落标题格式对齐（无方括号 `## X.Y.Z - date`）。

### Changed

- 知识库版本基线同步；FUN-B-12 证据阻塞解除（SLEEP/AXID A 级来源确认）。

## 2.11.5 - 2026-07-28

### Added

- `validateDocument` 改在独立 Worker 线程执行（5 秒超时 + 竞态取消）。
- GitHub Release 脚本 `createGitHubRelease.js`（适配域控 `git credential fill` + `curl.exe`）。

### Fixed

- REPEAT 未闭合、函数参数嵌套括号、STITCHON/WEAVEON 互斥、同行体检测、中文字符串转义、路径扩充引数正则等多项诊断修复。

### Removed

- 过时发布记录与死代码清理。

## 2.11.4 - 2026-07-25

### Fixed

- 格式化器跨行块注释、规范化位置偏移、同行体缩排等安全性修复。

## 2.11.3 - 2026-07-17

### Fixed

- 控制结构同行体误报；`DEFAULT:` 从 error 降级为 style warning。

## 2.11.2 - 2026-07-13

### Fixed

- 路径扩充引数不再误判嵌套函数调用；方括号表达式参与诊断。

## 2.11.1 - 2026-07-13

### Changed

- v2.11.0 发布资料同步纳入正式发布包。

## 2.11.0 - 2026-07-13

### Added

- `AXID` 裸轴名语法补全与 Hover；Cycle 资料库回传码补齐。

### Changed

- 函数 Hover 语义补齐；诊断文档转义间接变量方括号。

## 2.10.0 - 2026-07-11

### Added

- 工作区符号导航（`Ctrl+T`）与宏调用引用查找。
- 诊断文档同步检查 `docs:diagnostics:check`。
- GitHub Actions CI（main + PR）+ 集成测试。
- 发布一致性检查 `check:release` + VSIX 内容白名单 + 安装包冒烟。

### Changed

- 导航扫描改用文本快照 + 单次解析缓存；VSIX 排除 `scripts/`。

## 2.9.0 - 2026-07-11

### Added

- README 诊断与 Quick Fix 用户说明；诊断场景指南（分号/不支持语法/控制流/变量/函数/机器人）。

### Changed

- `docs/诊断规则与修复动作.md` 扩展为按场景阅读的诊断指南。

## 2.8.21 - 2026-07-11

### Added

- v2.9.0 规划文档。

## 2.8.20 - 2026-07-11

### Changed

- `ROADMAP.md` 收束 v2.8.x 诊断体系完成状态与 v2.9.0 候选主题。

## 2.8.19 - 2026-07-11

### Added

- `docs/诊断规则与修复动作.md` + `npm run docs:diagnostics` 生成脚本。

## 2.8.18 - 2026-07-11

### Changed

- 集成测试改用等待诊断状态变化取代固定延迟。

## 2.8.17 - 2026-07-11

### Changed

- 诊断结果统一按位置/严重度/code 排序。

## 2.8.16 - 2026-07-11

### Changed

- 同区间已有 error 时抑制重叠 warning。

## 2.8.15 - 2026-07-11

### Changed

- 诊断去重 key 优先用稳定 `code` 而非中文提示文字。

## 2.8.14 - 2026-07-11

### Changed

- 诊断对象创建统一迁移到 `diagnosticFactory`。

## 2.8.13 - 2026-07-11

### Changed

- 新增统一诊断对象工厂，`validator` 手写诊断对象改走工厂。

## 2.8.12 - 2026-07-11

### Changed

- 行级诊断器改为带稳定 `id` 的规则注册表。

## 2.8.11 - 2026-07-11

### Changed

- Quick Fix 替换规则/说明文案/闭合词抽取到 `diagnosticActions` 模块。

## 2.8.10 - 2026-07-11

### Added

- 机器人/LTP 诊断 code + Quick Fix（直接引数 `=`/MOVJ-II/TOOLCORON/T_/TOOLCOR CLEAR）+ 集成测试。

## 2.8.9 - 2026-07-11

### Added

- 函数静态诊断 code（数学域/IO 范围/R 寄存器/ALARM·MSG ID/CHKINF/OPEN COM）+ 说明 action + 集成测试。

## 2.8.8 - 2026-07-11

### Added

- 变量诊断 code（命名变量/VACANT/AR·MAR 编号/赋值 `=` 风格）+ 说明 action + 赋值风格 Quick Fix + 集成测试。

## 2.8.7 - 2026-07-10

### Added

- 控制流诊断 code（未匹配结束符/嵌套顺序/ELSE·ELSEIF·UNTIL/未闭合块）+ 未闭合块 Quick Fix + 集成测试。

## 2.8.6 - 2026-07-10

### Added

- 不支持语法 Quick Fix（ELSIF/DEFAULT/DIV/==/!=/&&/||/%/FANUC 比较）+ 集成测试。

### Changed

- Quick Fix provider 在缺诊断上下文时回退当前文档诊断。

## 2.8.5 - 2026-07-10

### Added

- 缺分号/控制结构误加分号 Quick Fix + 稳定 code + 集成测试。

### Changed

- 语句分类模块抽出；测试样例策略调整；代码片段行尾分号对齐。

## 2.8.4 - 2026-07-10

### Changed

- 新增行上下文与语句分类层，收敛分号/控制流/机器人旧语法规则。

### Fixed

- 分号与控制结构诊断按新代 MACRO 控制流语法区分。

## 2.8.3 - 2026-07-10

### Added

- 扩展图标资源随 VSIX 打包。

## 2.8.2 - 2026-07-09

### Added

- `docs/新代宏程序知识图谱.md`。

### Changed

- 不等号 `<>` 运算子高亮；VSIX 排除 `.vscode`。

### Fixed

- `DIV`/`==`/`!=` 不支持运算子报错；`<>` 合法不等号不再误判。

## 2.8.1 - 2026-06-28

### Added

- G10 L1803/L1805/L1021/L1022/L1900/L1901/L1910/L1911/L1000/L1810/L1820 Hover 与代码片段。

### Changed

- 语法手册同步 G10 通讯指令说明。

## 2.8.0 - 2026-06-28

### Added

- `ROADMAP.md`；函数补全 snippet 测试；`test:integration` 集成测试；保守格式化 Provider；G66/G66.1/M98/M198 跳转；G/M 代码 Hover 数据表 `src/codeDocs.js`。

### Changed

- `validator` 拆分出 `functionArgumentValidator`/`robotValidator`/`controlFlowValidator`。

### Fixed

- 无参函数 snippet；配置贡献结构；DocumentSymbol Provider 方法名。

## 2.7.0 - 2026-06-28

### Added

- 单一语法真源手册 `docs/新代MACRO语法规范手册.md`；宏文件识别策略；`src/fileResolver.js`；机器人 LTP 补全与高亮；路径扩充引数诊断；变量/函数静态诊断；MOVC 单行写法；区间互斥诊断。

### Changed

- 扩充 G/O 程序优先按无后缀文件处理；文件关联收紧。

### Fixed

- 测试隔离；递归跳转候选一致性。

## 2.6.5 - 2026-06-27

### Added

- `test-demo.nc` 语法速查；短结束符/赋值 `=`/命名变量/DIV/`==` 风格建议诊断；动态 M 码/`=` 比较/间接变量高亮。

### Changed

- 补全与 Hover 移除不推荐短结束符；FOR snippet 改 `:=`。

### Fixed

- VSIX 排除本地参考 `Macro/` 目录。

## 2.6.4 - 2026-06-26

### Fixed

- 多文档诊断防抖；GOTO/G65 跳转定位；跨行块注释误报；代码片段输出。

### Changed

- 控制流关闭关键字必须匹配栈顶；`MOD`/`&`/`AR[#n]`/`$1~$4` 高亮。

## 2.6.3 - 2026-06-26

### Fixed

- 14 个过时代码片段与 README 文档错误对齐手册。

### Changed

- 新增 snippets 一致性测试。

## 2.6.2 - 2026-06-25

### Changed

- 源文件硬编码版本号统一从 package.json 读取。

### Added

- GETPR/SETPR 函数定义；SLEEP 无参数文档。

### Fixed

- SLEEP 函数签名修正为无参数。

## 2.6.1 - 2026-06-23

### Changed

- `validator.js` 拆分为 6 个独立验证器函数 + `LINE_VALIDATORS` 策略模式。

## 2.6.0 - 2026-06-23

### Added

- 18 个机器人指令代码片段；G04.102/G68.18/G192.1/G192.2 G 码；6 个测试用例；README 机器人指令章节。

### Fixed

- 跨行块注释中文字符误报。

## 2.5.0 - 2026-06-22

### Changed

- 版本号统一；新增 `npm test` 脚本。

### Fixed

- 跨行块注释 `(* ... *)` 括号匹配误报。

### Removed

- 临时调试文件、重复 `docs/CHANGELOG.md`、失效 build 脚本、过时历史注释。

## 2.4.0 - 2026-06-22

### Changed

- 函数说明全部中文化；版本号统一。

### Fixed

- `#` 变量前黑色方块；REPEAT/UNTIL/EXIT 嵌套诊断误报。

## 2.3.0 - 2026-06-22

### Added

- 机器人指令完整支持（移动/坐标系/应用/速度轨迹参数）；G04.102/G192.1/G192.2/G68.18/G10 L 系列/G67/M198/MOD/`$1~$4`。

### Changed

- IF 无括号形式；CASE 冒号语法；`&` 识别为 AND；GT/EQ/LT 等不支持比较符 warning。

### Fixed

- ALARM/MSG/SLEEP/GETPR/SETPR 函数签名修正。

## 2.2.0 - 2026-06-22

### Added

- 嵌套深度/块数量/缺少 THEN·DO·OF/行尾分号/M99 结尾检测。

### Fixed

- 块注释多行处理；CASE 块验证。

## 2.1.0 - 2026-06-22

### Added

- 代码片段模板；诊断防抖；includePath 配置。

## 2.0.0 - 2026-06-22

### Added

- 智能补全增强；悬停文档；代码跳转；实时诊断；Outline 大纲。

## 1.0.0 - 2026-06-22

### Added

- 初始版本：基础语法高亮 + 基本代码补全。
