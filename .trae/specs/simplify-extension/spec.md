# 项目代码精简与改进 Spec

## Why
当前 `syntec-macro-vscode` 扩展代码存在多处 Bug（`vscode.workspacee` 拼写错误、`#` 变量补全被注释掉导致功能失效、中文注释乱码）以及重复逻辑、死代码，影响可维护性和功能正确性。

## What Changes
- 修复 `vscode.workspacee` → `vscode.workspace` 拼写错误（**BREAKING**：修复后所有 Provider 和诊断功能才能真正生效）
- 修复 extension.js 中文注释乱码，恢复为可读中文
- 修复 `#` 变量补全逻辑（当前被注释掉导致不生效）
- 消除重复代码：关键字聚合、M 代码描述、Hover 文档渲染
- 拆分过长的单文件函数（`provideCompletionItems`、`findMacroFile`、`validateDocument`）
- 移除 `keywords.js` 中未使用的 `varPatterns`、`endCodes` 死代码
- 提取魔法数字为常量（递归深度、变量数量等）

## Impact
- Affected specs: 无（首次规范）
- Affected code: `src/extension.js`, `src/keywords.js`, `src/validator.js`, `tests/validator.test.js`

## ADDED Requirements

### Requirement: Bug 修复 — 拼写错误
系统 SHALL 使用 `vscode.workspace`（而非 `vscode.workspacee`）访问 VSCode 工作区 API。

#### Scenario: 配置读取正常
- **WHEN** 扩展激活
- **THEN** `getConfig()` 能正确读取 `syntecMacro` 配置项

#### Scenario: 文档监听正常
- **WHEN** 用户打开或编辑 `.macro` 文件
- **THEN** 诊断自动刷新

### Requirement: Bug 修复 — 中文注释恢复
系统 SHALL 在所有源文件中使用 UTF-8 编码的正确中文注释。

#### Scenario: 注释可读
- **WHEN** 开发者阅读 extension.js 源码
- **THEN** 所有中文注释清晰可读，无乱码字符

### Requirement: Bug 修复 — `#` 变量补全恢复
系统 SHALL 在用户输入 `#` 后弹出常用变量补全列表。

#### Scenario: 输入 # 后触发补全
- **WHEN** 用户在 syntec-macro 文件中输入 `#`
- **THEN** 补全列表显示 `#1`~`#20` 及常用大号变量

### Requirement: 消除重复代码
系统 SHALL 将重复出现的关键字聚合逻辑封装为独立函数。

#### Scenario: 关键字聚合复用
- **WHEN** Completion Provider 和 Hover Provider 需要完整关键字列表
- **THEN** 两者调用同一个 `getAllKeywords()` 函数获取

### Requirement: 移除死代码
系统 SHALL 移除 `keywords.js` 中未被任何模块引用的 `varPatterns` 和 `endCodes` 导出。

#### Scenario: 死代码移除后功能不变
- **WHEN** 移除未使用的导出
- **THEN** 所有现有测试通过，补全和 Hover 功能正常

### Requirement: 魔法数字常量化
系统 SHALL 将硬编码的魔法数字提取为命名常量。

#### Scenario: 递归深度可配置
- **WHEN** 需要修改递归搜索深度
- **THEN** 只需修改 `RECURSIVE_SEARCH_DEPTH` 常量值

## MODIFIED Requirements
无（首次规范）

## REMOVED Requirements
无（首次规范）