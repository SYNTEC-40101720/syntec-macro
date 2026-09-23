# 文档地图

本目录是 syntec-macro 插件的全部文档。核心结论沉淀在「语法规范手册 + 能力矩阵」，过程记录见根目录 `CHANGELOG.md`；官方权威来源为 Confluence SYNTech 手册（需登录 <https://syntecclub.atlassian.net>），文档不再保存证据原文。

## 文档清单

| 文档 | 角色 | 何时读 |
| --- | --- | --- |
| [新代 MACRO 语法规范手册](新代MACRO语法规范手册.md) | MACRO 规则唯一沉淀处（索引，正文在 [macro-handbook/](macro-handbook/) 分册与 §9 专题小节） | 学习/查询语法规则，或新增规则时先改这里 |
| [MACRO 能力矩阵](MACRO能力矩阵.md) | 能力 ID、版本基线、插件覆盖与证据状态的唯一登记点 | 某项能力是否已实现/已核实时查这里 |
| [诊断规则与修复动作](诊断规则与修复动作.md) | 诊断 code、严重度、Quick Fix 与说明（由 `npm.cmd run docs:diagnostics` 生成，不手改） | 查诊断 code 含义与修复方式 |
| [Rust 诊断 parity 清单](Rust诊断parity清单.md) | 稳定诊断 code 的 Rust 覆盖状态与 code↔能力 ID 交叉引用 | 新增/迁移诊断 code 时登记 |
| [Rust/Wasm 切换验收门禁](Rust-Wasm切换验收门禁.md) | 永久有效的验收门禁、不变约束与 readiness 7 项门禁 | 发布前后必读 |
| [Release-Runbook](Release-Runbook.md) | 发布到 GitHub Release 的操作手册 | 发布时照单执行 |
| [开发交接说明](开发交接说明.md) | 接续点、本机验证命令、架构入口、GitHub 同步与发布流程 | 每个新会话/新批次先读 |

## 诊断/规则变更的四件套

新增或修改诊断 code、规则时按顺序登记（由 `npm.cmd run check:diagnostic-governance` 守卫）：

1. [MACRO 能力矩阵](MACRO能力矩阵.md) + [语法规范手册](新代MACRO语法规范手册.md) — 规则与能力状态；
2. `src/diagnosticCodes.js` 注册 + Rust `crates/syntec-core/src/lib.rs` emit；
3. [Rust 诊断 parity 清单](Rust诊断parity清单.md) — code 登记与交叉引用；
4. `src/diagnosticActions.js` `DIAGNOSTIC_HELP` 用户文案（SOFT）。

验证入口与发布门禁集中在 [Rust/Wasm 切换验收门禁](Rust-Wasm切换验收门禁.md) §2；接续工作与本机操作见 [开发交接说明](开发交接说明.md)。
