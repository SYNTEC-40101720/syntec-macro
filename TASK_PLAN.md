# SYNTEC Macro VSCode Extension — 优化实施计划

## 目标
全面修复 Bug、增强功能、补全项目配置，使扩展达到生产级质量。

## 实施步骤

### Phase 1: 项目配置（调试 + 构建）
- [x] 1.1 创建 `.vscode/launch.json` — F5 调试支持
- [x] 1.2 创建 `.vscode/tasks.json` — Ctrl+Shift+B 构建支持

### Phase 2: P0 Bug 修复
- [x] 2.1 `extension.js` — `getRegexRangeAtPosition` 重置 `lastIndex`
- [x] 2.2 `validator.js` — `stripCommentsAndStrings` 处理转义引号 `\"`

### Phase 3: P1 功能增强
- [x] 3.1 `extension.js` — 补全项添加括号 snippet `fn(${1})`
- [x] 3.2 `extension.js` — Hover 文档使用代码块渲染

### Phase 4: P2 性能 + 功能
- [x] 4.1 `extension.js` — `refreshDiagnostics` 添加 300ms 防抖
- [x] 4.2 `extension.js` + `package.json` — `includePath` 配置支持 G65 跳转

### Phase 5: P3 代码质量
- [x] 5.1 创建 `.eslintrc.js` + 安装 eslint 依赖
- [x] 5.2 运行 eslint 修复代码风格问题

### Phase 6: 验证 + 打包
- [x] 6.1 运行 `npm run build` 确认无报错
- [x] 6.2 运行 `vsce package` 打包 .vsix
- [x] 6.3 更新 CHANGELOG.md 添加 v1.4.3 条目

## 文件变更清单
```
.vscode/launch.json       新建
.vscode/tasks.json        新建
.eslintrc.js              新建
package.json              添加 includePath 配置定义 + eslint devDependency
src/extension.js          修复 lastIndex + 防抖 + snippet + includePath
src/validator.js          修复转义引号
CHANGELOG.md              添加 v1.4.3 条目
```

## 版本号
当前: 1.4.2 → 新版本: 1.4.3
