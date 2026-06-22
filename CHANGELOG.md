# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
  - SLEEP: `SLEEP(ms)` 接受毫秒参数
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
