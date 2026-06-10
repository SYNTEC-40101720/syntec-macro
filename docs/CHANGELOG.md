## [2.1.0] - 2026-06-10

### 🚀 稳定版本发布

**项目目录规范化**
- 创建 `config/` 目录收纳 `.eslintrc.js`
- 创建 `docs/` 目录收纳 `CHANGELOG.md`
- 新增 `.github/` Issue/PR 模板

**代码重构与性能优化**
- `functions.js` 新增 `buildFunctionIndex()` → `Map` 预索引，函数查找 O(1)
- `keywords.js` `getAllKeywords()` 模块级缓存，避免重复 Set 构造
- `validator.js` 合并中文字符检查与括号匹配为单次遍历，`lines` 遍历从 3 次减少到 1 次
- `extension.js` 提取 `provideVariableCompletions()` 独立函数
- `extension.js` Hover Provider 使用 `functionIndex` 替代 `functions.find()`

**配置优化**
- 全面重构 `.gitignore`（9 个功能分组）
- 优化 `.vscodeignore`（移除冗余，补全遗漏）
- 新增 `lint` 脚本指向 `config/.eslintrc.js`

---

## [2.0.2] - 2026-06-10

### Bug 修复

**REPEAT/UNTIL/END_REPEAT 嵌套语法诊断修复**
- 修复嵌套 `REPEAT` 块中，当 `UNTIL` 和 `END_REPEAT` 不在同一行时误报 "UNTIL 没有匹配的 REPEAT"
- 修复 `END_REPEAT` 在 `UNTIL` 处理后错误地弹出更外层 `REPEAT` 的问题
- 修复 `END_REPEAT` 单独成行时不应匹配已被 `UNTIL` 关闭的 `REPEAT`
- 新增 `untiledRepeats` 栈追踪，正确区分 "同行配对" 与 "跨行配对" 场景
- 确保多余 `END_REPEAT` 仍能正确报错

**测试覆盖**
- 新增 20 个嵌套场景测试用例，涵盖 REPEAT/FOR/WHILE 嵌套、混合嵌套、错误场景

---

## [2.0.1] - 2026-06-02

### 🔧 代码精简与 Bug 修复

**Bug 修复**
- 修复 `vscode.workspacee` → `vscode.workspace` 拼写错误（影响所有配置读取和事件监听）
- 修复 `#` 变量补全逻辑（曾被注释导致不生效）
- 修复 extension.js 中文注释乱码（24 处恢复为正确 UTF-8 编码）

**代码精简**
- 提取 `getAllKeywords()` 统一关键字聚合，消除 Completion/Hover 中重复代码
- 提取 `getMCodeDesc()` 统一 M 代码描述，消除三元表达式重复
- 拆分 `provideCompletionItems` 为 4 个聚焦子函数
- 拆分 `findMacroFile` 为 `normalizeProgramName` + `buildFileCandidates`
- 移除 `keywords.js` 中未使用的 `varPatterns`、`endCodes`、`labelPattern` 导出
- 魔法数字常量化：`RECURSIVE_SEARCH_DEPTH`、`VARIABLE_COMPLETION_COUNT`、`DIAGNOSTIC_DEBOUNCE_MS`

---

## [2.0.0] - 2026-05-24

### 🚀 重大更新：性能优化 + 功能增强

**性能优化**
- 新增诊断防抖机制（300ms），打字时不再卡顿
- `findFileRecursive` 深度配置化，支持从 `package.json` 读取

**功能增强**
- ✨ 补全项自动添加括号 snippet（`STR` → `STR(${1})`）
- ✨ 新增 `includePath` 配置，支持 G65 跳转搜索额外路径
- 🔧 Hover 文档使用代码块渲染，可读性提升
- 🔧 修复 `stripCommentsAndStrings` 转义引号处理（`"` 不再误判）

**Bug 修复**
- 修复 `getRegexRangeAtPosition` 正则 `lastIndex` 未重置导致的匹配异常
- 修复 `vscode.workspace` 拼写错误（影响诊断刷新）
- 修复中文字符检测在块注释后的边界判断

**项目配置**
- 新增 `.vscode/launch.json`（F5 调试支持）
- 新增 `.vscode/tasks.json`（Ctrl+Shift+B 构建支持）
- 新增 `.eslintrc.js`（代码质量检查）
- 安装 `eslint` 开发依赖

---

## [1.4.2] - 2026-05-10

### 语法高亮修正

**G65 子类型支持**
- G65 pattern 新增 `G65.1` 支持（`\bG65(?:\.1)?\b`），与 G66 保持一致

**移除 `=` 赋值高亮**
- 删除独立的 `=` assignment pattern（`keyword.operator.assignment`）
- 原因：`=` 在 `IF #1 = #2 THEN` 中实际是比较运算符，正则无法区分语义
- `:=` 赋值高亮保留不变

---

## [1.4.1] - 2026-04-30

### 编辑体验与发布流程修复

**配置开关生效**
- `syntecMacro.enableDiagnostics` 关闭时会清除并停止刷新诊断
- `syntecMacro.enableCompletions`、`syntecMacro.enableHover` 现在会实际控制补全与 Hover Provider
- 配置变更后会重新刷新当前已打开的 syntec-macro 文档诊断

**补全、Hover 与跳转修复**
- G/M 代码补全改为按前缀过滤，支持 `G0`、`G66`、`M9` 等输入过程继续收窄候选
- `#` 变量补全不再被普通 word 检测提前拦截
- 变量 Hover 支持 `#1`、`#name`、`#[...]`、`@100`、`@[...]`
- G/M Hover 支持 `G66.1` 等带小数点的 G 代码
- `GOTO 100` 跳转严格匹配 `N100;`，避免误跳到 `N1000;`
- `G65 Pxxx` 宏程序跳转支持递归搜索工作区子目录，并匹配无扩展名、`.macro`、`.G`、`.scp`

**语法、生成脚本与诊断修复**
- 移除 TextMate 普通圆括号注释规则，避免表达式括号被误高亮为注释
- 同步 `language-configuration.json` 的折叠、缩进与变量 wordPattern
- `build/build_grammar.py` 与 `build/build_snippets.py` 输出目录改为仓库根下的 `syntaxes/`、`snippets/`
- `GOTO #变量` 视为运行期目标，不再静态校验为同号 N 标签
- 中文字符扫描会继续检查同行块注释结束后的代码
- 补充动态 GOTO、N 标签边界和块注释后中文字符检测回归测试

**版本一致性**
- 状态栏与激活日志统一从 `package.json` 读取版本号
- 移除无效的 VS Code `configurationDefaults` 注释配置键

---

## [1.4.0] - 2026-04-20

### 重大修订：数据源全面对齐控制器实测

**语法验证修复**
- `GOTO` 正则：匹配 `GOTO 数字;`（数字后无字母），避免 `GOTO 100A` 误识
- `GOTO` 目标标签：严格匹配 `N数字;`（仅分号结尾），与控制器实测一致
- N标签行识别：严格 `N数字;`（仅此格式合法）

**函数补全补全**
- 新增 `CHR` `LEN` `MID` `STR` `FORMAT`（字符串处理）
- 新增 `BITAND` `BITOR` `BITXOR` `BITNOT`（位运算）
- 新增 `INLIST` `PI` `DEG` `RAD` `MOD`（工具函数）
- 修正 `GETARG` 文档：`X1~X15`（对应 A~O），`G65 P__ X1#1 → #1 = GETARG(X1)`
- 修正 `SYSVAR` 文档：`"SYSTEM::NC_MODE"` 格式
- 修正 `OPEN/CLOSE/PRINT/EXIST` 文档（mode 参数：R/W/A）
- 删除 `GOTO` 误放的函数条目（已在 keywords.js 中作为关键字）

**语法高亮修复**
- 新增 `=` 赋值运算符高亮（独立于 `:=`，避免语法树冲突）
- 修正 G/M/N 代码正则：`G\d+(?:\.\d+)?` 更严格匹配（防止 `G6` 被截断）
- N标签：严格 `N[0-9]\d*;` 格式（仅分号结尾）

**诊断信息国际化**
- 所有 Validator.js 诊断消息从英文重构为中文（保持一致风格）

**版本规范**
- 引入 SemVer 版本号准则：MAJOR.MINOR.PATCH
- PATCH（.z）：Bug 修复、UI 调整（1.3.x 系列）
- MINOR（.y）：新增功能、语法规范修正（1.4.x 系列）
- MAJOR（.x）：破坏性变更

---

## [1.3.7] - 2026-04-20

### 第一性原理排查修复

**移除不存在的语法**
- 移除 INT() 函数（控制器不支持，从 functions.js / tmLanguage 删除）
- 移除 CALL / RETURN 关键字（控制器不支持，仅 M98 P10 调子程序）

**snippet 修正**
- IF 默认 snippet 改为仅 IF/END_IF（prefix: `if`），含 ELSEIF 版改为 `ife`
- REPEAT snippet 补全 END_REPEAT（控制器要求三要素缺一不可）
- macro 模板 N10 改为 N10;（分号结尾才合法）

**数据一致性修复**
- GOTO Hover 文档修正：`GOTO 100;`（不带 N），目标 `N100;`
- GOTO 跳转定义修正：匹配 `GOTO 数字` → 跳转到 `N数字` 行
- 括号匹配消息修正：缺少 `)` 报"缺少右括号"而非"缺少左括号"
- 替代关键字高亮：ENDIF/ENDFOR/ENDWHILE/ENDCASE/ENDREPEAT 加入 tmLanguage
- extension.js 中文乱码全部修复（完整重写）
- 状态栏版本号同步 1.3.7

**配置修复**
- package.json repository URL 指向正确仓库
- .vscodeignore 排除 macro-samples/ 和 G0915，VSIX 体积从 65KB 缩减

---

## [1.3.6] - 2026-04-19

### 规范修正（依据控制器实测）

**GOTO 语法修正**
- `GOTO 100;`（不带 N）而非 `GOTO N100;`
- `GOTO #变量;` 变量必须是整数
- N 标签格式：`N100;` 才合法，`N100:` 和裸 `N100` 都报错

**移除不支持功能**
- `INT()` 函数不支持（从补全列表移除）
- `ELSIF` 关键字不存在（控制器实测报错）
- `[]` 不能用于运算，仅限间接定值和特定函数
- `NOT` 只能对整数使用

**修复中文乱码**
- 重写 validator.js，修复所有 UTF-8 编码问题

---

## [1.3.5] - 2026-04-17

### 规范对齐（依据 MACRO开发应用手册）

**新增关键字支持**
- 替代关键字（不带下划线）：`ENDIF` / `ENDFOR` / `ENDWHILE` / `ENDCASE` / `ENDREPEAT`
- `ELSIF`（IF 分支关键字）
- `EXIT`（跳出循环块）

**新增诊断规则**
- `%@MACRO` 文件头检查：第一行非注释且为裸 `%`（非 `%@MACRO`）时报 warning
- `GOTO` 标签验证：引用目标 `Nxxx` 不存在时报 warning（支持 `GOTO N数字` 和 `GOTO #变量` 两种形式）
- N标签行格式：`N数字;` 或 `N数字:`（同行含 `GOTO Nxx` 时不误判为标签）

**架构改进**
- `getKeywordPositions` 改用下划线占位法解决 `ENDREPEAT`/`REPEAT` 子串冲突
- EXIT 跳出循环时标记嵌套 IF 为 `exited`，避免误报未闭合

### 文档
- 新增 `MACRO开发应用手册.md` 和 `Macro变数规格.md`（用户提供的完整参考手册）

## [1.3.4] - 2026-04-17

### 新增
- 支持 `.nc` 文件类型
- 新增 validator 单元测试（51个测试用例）

### Bug 修复
- `MSG("END_IF")` 字符串内的关键字被误报
- 嵌套块缺少 END 时内层 warning 被吞掉
- `ELSE` 后接 `ELSEIF` 时误匹配
- 相邻多个 CJK 字符报多条重复 error

---

## [1.3.3] - 2025-04-15

### 新增
- **中文字符诊断**：代码中的中文标点（；：，。等）和中文字符报错，注释和字符串内不报错

---

## [1.3.2] - 2025-04-15

### Bug 修复
- **颜色装饰器**：禁用 syntec-macro 语言的 VSCode 内置颜色预览（`#201` 等变量不再显示 RGB 色块）

---

## [1.3.1] - 2025-04-15

### Bug 修复
- **CASE ELSE 误报**：`CASE ... OF ... ELSE ... END_CASE` 中的 ELSE 不再报"没有匹配的 IF"（ELSE 现在正确匹配最近的 IF 或 CASE 块）
- **ELSEIF 约束**：ELSEIF 仍然只匹配 IF，不会错误匹配 CASE 块

---

## [1.3.0] - 2025-04-15

### Bug 修复
- **诊断误报**：重写 validator.js 块匹配逻辑，修复 IF/ELSEIF/ELSE 嵌套场景下 ELSEIF/ELSE 孤立误报（根因：BLOCK_KEYWORDS 反向查找 bug，END_IF 作为 key 查找返回 undefined）
- **变量高亮**：修复 `#321` 等多位数变量高亮异常（grammar pattern 交替顺序：`#\\[...\\]` → `#[1-9]\\d*` → `#[A-Za-z_]...`）

### 重构
- 项目目录重组：`src/` `syntaxes/` `snippets/` `build/` `data/` `dist/`

---

## [1.2.0]

### 新增功能
- **智能补全**：60+ 内置函数列表，含参数签名
- **Hover 文档**：悬停函数名/G/M代码，显示说明与示例
- **GOTO 跳转**：Ctrl+点击 N标签跳转；G65 P123 跳转宏程序文件
- **实时语法诊断**：IF/END_IF/FOR/WHILE/CASE 块匹配检查，括号配对检查
- **Outline 大纲**：N标签行自动出现在符号导航中

### 架构
- 新增 src/functions.js、src/keywords.js、src/validator.js、extension.js

---

## [1.1.0]
- 完整语法高亮（TextMate grammar）
- 40个代码片段
- 文件关联与自动缩进配置
