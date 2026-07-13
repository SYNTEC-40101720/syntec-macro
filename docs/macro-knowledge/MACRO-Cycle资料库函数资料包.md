# MACRO Cycle 资料库函数资料包

本资料包记录 `DBOPEN`、`DBNEW`、`DBLOAD`、`DBSAVE`、`DBINSERT` 与 `DBDELETE` 的首轮审计结论。资料以官方 [Macro Function List](https://syntecclub.atlassian.net/wiki/spaces/TechManual/pages/44133992/9.+Macro_Function_List) 为主，并以 XMLDB 教学文件补充明确返回码。

更新日期：2026-07-13
状态：Cycle 档案生命周期、共享 Cycle name 及 `DBDELETE` 失败码已完成文档化；实际档案路径、并行执行与控制器版本差异待模拟器或实机验证。

## 1. 已核实语义

| 函数 | 官方结论 | 插件状态 |
|---|---|---|
| `DBOPEN` / `DBNEW` | 同时间只能开启一个 Cycle 档案；后调用会取代当前档案。 | 已在 Hover 说明。 |
| `DBLOAD(index)` | 读取指定资料，并将目前 Cycle name 指定为该笔资料的 name。 | Hover 已说明此状态变更。 |
| `DBINSERT(index, name)` | 插入资料并将目前 Cycle name 指定为引数 `name`；与 `DBLOAD` 连续调用时，后令覆盖前令。 | Hover 已说明覆盖关系。 |
| `DBDELETE(index)` | 回传 `1=成功`、`0=失败`、`-1=超出范围`、`-2=未开档`。 | Hover 已列出明确返回码。 |
| `DBSAVE(index)` | 需先开档并成功 `DBLOAD` 或 `DBINSERT`。 | 既有 Hover 已说明。 |

## 2. 保守边界

- 不根据静态代码推断档案是否存在、是否已经开启、索引是否在运行时范围内，避免工作区缺少真实 Cycle 档时造成误报。
- 不对 `DBLOAD` 与 `DBINSERT` 的调用顺序报错。覆盖 Cycle name 是官方定义的正常运行时行为，应由程序作者决定是否符合加工逻辑。
- 不将 `DBDELETE` 的 `-1/-2` 提升为静态诊断；它们分别依赖运行时索引与开档状态。

## 3. 后续验证

| ID | 场景 | 验收目标 |
|---|---|---|
| FUN-D-01 | `DBLOAD` 后执行 `DBINSERT` | 确认后者的 Cycle name 覆盖前者。 |
| FUN-D-02 | 未开档执行 `DBDELETE` | 确认回传 `-2`。 |
| FUN-D-03 | 空档案、边界 index 与删除后保存 | 核实各控制器版本的实际行为和返回码。 |