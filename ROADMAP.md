# Roadmap

## Next

- 扩展跳转能力：已覆盖静态跳转；动态变量、表达式或运行期生成的宏呼叫目标不做静态跳转。

## Completed

- 已拆出 `src/functionArgumentValidator.js`，负责内置函数静态参数诊断。
- 已拆出 `src/robotValidator.js`，负责机器人/LTP 单行语法和跨行状态诊断。
- 已拆出 `src/controlFlowValidator.js`，负责控制流栈、CASE 同行风格和未闭合块诊断。
- 已新增 VS Code 集成测试，覆盖扩展激活、补全、悬停、GOTO 跳转、大纲符号和诊断配置开关。
- 已新增保守 formatter，只调整缩进和尾随空白，不重排或改写宏语句。
- 已扩展 Definition Provider，支持 G66/G66.1 P_ 跳转 G 宏程序，以及 M98/M198 P_ 跳转 O 副程序。
- 已支持 G65/G66/G66.1 P"Name" 静态字符串宏名跳转，同步保留动态目标不跳转边界。
- 已新增 `src/codeDocs.js`，以可维护数据表提供常用 G/M 代码 Hover 签名和说明。

## Release Hygiene

- 打包前固定执行 `npm.cmd test`、`npm.cmd run test:integration`、`npm.cmd run lint`、`npm.cmd run package`。
- 发布前检查 README、CHANGELOG、package 版本号和 VSIX 内容是否一致。

