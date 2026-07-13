# Roadmap

## Next

- `v2.10.0` 已正式发布；发布收口记录见 [docs/v2.10.0-发布规划.md](docs/v2.10.0-发布规划.md)。
- 当前工作聚焦 MACRO 语义证据、保守诊断与回归测试，详见 [MACRO 知识库](docs/macro-knowledge/README.md) 和 [执行规划](docs/macro-knowledge/MACRO知识与验证规划.md)。
- 历史规划见 [docs/v2.9.0-规划.md](docs/v2.9.0-规划.md)。

## Current Release Posture

- v2.8.x 已集中完成诊断体系增强、Quick Fix、诊断 code、集成测试、规则注册表、诊断工厂和文档生成。
- v2.10.0 是当前已发布版本，包含复杂宏程序导航、性能优化与发布自动化。
- 每次发布保留 `npm run docs:diagnostics:check`、`npm test`、`npm run test:integration`、`npm run test:integration:navigation`、`npm run lint`、`npm run package` 的本地验证节奏。
- 换设备继续开发时，按 [`docs/开发交接说明.md`](docs/开发交接说明.md) 检查拉取、验证和发布流程。

## Completed

- 已拆出 `src/functionArgumentValidator.js`，负责内置函数静态参数诊断。
- 已拆出 `src/robotValidator.js`，负责机器人/LTP 单行语法和跨行状态诊断。
- 已拆出 `src/controlFlowValidator.js`，负责控制流栈、CASE 同行风格和未闭合块诊断。
- 已新增 VS Code 集成测试，覆盖扩展激活、补全、悬停、GOTO 跳转、大纲符号和诊断配置开关。
- 已新增保守 formatter，只调整缩进和尾随空白，不重排或改写宏语句。
- 已扩展 Definition Provider，支持 G66/G66.1 P_ 跳转 G 宏程序，以及 M98/M198 P_ 跳转 O 副程序。
- 已支持 G65/G66/G66.1 P"Name" 静态字符串宏名跳转，同步保留动态目标不跳转边界。
- 已新增 `src/codeDocs.js`，以可维护数据表提供常用 G/M 代码 Hover 签名和说明。
- 已新增诊断 code、Quick Fix、说明型 CodeAction，覆盖分号、不支持语法、控制流、变量、函数参数和机器人/LTP 诊断。
- 已新增 `src/diagnosticActions.js`、`src/diagnosticFactory.js`、`src/diagnosticRules.js`，收敛诊断动作元数据、诊断对象创建、行级规则执行与诊断排序/过滤。
- 已新增 `docs/诊断规则与修复动作.md` 与 `npm run docs:diagnostics`，用于生成和维护诊断规则参考。
- 已新增 Workspace Symbol 与 Reference Provider，支持静态 G/O 程序、命名宏及 N 标签的跨文件导航。
- 已新增 `npm run docs:diagnostics:check` 和 GitHub Actions CI，防止诊断元数据与生成文档不同步。

## Release Hygiene

- 打包前固定执行 `npm.cmd run docs:diagnostics:check`、`npm.cmd test`、`npm.cmd run test:integration`、`npm.cmd run lint`、`npm.cmd run package`。
- 发布前检查 README、CHANGELOG、package 版本号和 VSIX 内容是否一致。

