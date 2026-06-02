# Tasks

- [x] Task 1: 修复 `vscode.workspacee` 拼写错误及中文注释乱码
  - [x] 全局替换 `vscode.workspacee` → `vscode.workspace`（extension.js 共 7 处）
  - [x] 恢复所有中文注释为正确 UTF-8 编码（extension.js 中约 24 处乱码）
  - [x] 运行 `node tests/validator.test.js` 验证 validator 测试通过

- [x] Task 2: 修复 `#` 变量补全逻辑
  - [x] 取消 `if (textBefore.endsWith('#'))` 的注释，恢复变量补全触发
  - [x] 将变量补全逻辑提取为独立函数 `provideVariableCompletions()`
  - [x] 修复补全注释中的中文乱码

- [x] Task 3: 消除重复代码 — 关键字聚合
  - [x] 在 `keywords.js` 中新增 `getAllKeywords()` 导出函数
  - [x] 替换 extension.js 中两处重复的关键字展开逻辑
  - [x] 提取 M 代码描述为 `getMCodeDesc(code)` 函数

- [x] Task 4: 移除死代码
  - [x] 从 `keywords.js` 移除 `endCodes` 导出
  - [x] 从 `keywords.js` 移除 `varPatterns` 导出
  - [x] 从 `keywords.js` 移除 `labelPattern` 导出
  - [x] 验证所有现有测试通过

- [x] Task 5: 提取魔法数字为常量
  - [x] 在 `extension.js` 顶部添加常量区：`RECURSIVE_SEARCH_DEPTH = 5`、`VARIABLE_COMPLETION_COUNT = 20`、`DIAGNOSTIC_DEBOUNCE_MS = 300`
  - [x] 替换所有硬编码数值引用

- [x] Task 6: 拆分长函数 — `provideCompletionItems`
  - [x] 提取 `provideFunctionCompletions(prefix)` 独立函数
  - [x] 提取 `provideKeywordCompletions(prefix)` 独立函数
  - [x] 提取 `provideGCodeCompletions(prefix)` 独立函数
  - [x] 提取 `provideMCodeCompletions(prefix)` 独立函数
  - [x] 保持 `provideCompletionItems` 作为编排函数

- [x] Task 7: 拆分长函数 — `findMacroFile`
  - [x] 提取 `normalizeProgramName(progNo)` 函数
  - [x] 提取 `buildFileCandidates(dir, fileName)` 函数
  - [x] 简化 `findMacroFile` 主逻辑

- [x] Task 8: 最终验证
  - [x] 运行 `node tests/validator.test.js` 确认全部 72 个测试通过
  - [x] 打包并本地安装验证功能正常

# Task Dependencies
- Task 2 依赖 Task 1（修复乱码后才能正确写中文注释）
- Task 3 依赖 Task 1（修复拼写错误后才能正确引用新函数）
- Task 4 可与 Task 1 并行（独立文件修改）
- Task 5 依赖 Task 1（修复拼写错误后才能正确引用常量）
- Task 6 依赖 Task 3（关键字聚合函数就绪后拆分）
- Task 7 可与 Task 6 并行（独立函数拆分）
- Task 8 依赖所有前置任务