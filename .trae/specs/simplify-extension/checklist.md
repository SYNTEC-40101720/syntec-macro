# Checklist

- [x] `vscode.workspace` 拼写正确，无任何 `workspacee` 残留
- [x] extension.js 中文注释全部可读，无乱码字符
- [x] 输入 `#` 后弹出变量补全列表（`#1`~`#20` 及常用大号变量）
- [x] Completion Provider 和 Hover Provider 共用 `getAllKeywords()` 函数
- [x] M 代码描述由 `getMCodeDesc()` 统一管理，无重复硬编码
- [x] `keywords.js` 中 `varPatterns` 导出已移除
- [x] `keywords.js` 中 `endCodes` 导出已移除
- [x] `keywords.js` 中 `labelPattern` 导出已移除
- [x] 魔法数字已替换为命名常量（`RECURSIVE_SEARCH_DEPTH`、`VARIABLE_COMPLETION_COUNT`、`DIAGNOSTIC_DEBOUNCE_MS`）
- [x] `provideCompletionItems` 已拆分为多个聚焦子函数
- [x] `findMacroFile` 已拆分为 `normalizeProgramName` 和 `buildFileCandidates`
- [x] `node tests/validator.test.js` 全部 72 个测试通过
- [x] 打包安装后功能正常