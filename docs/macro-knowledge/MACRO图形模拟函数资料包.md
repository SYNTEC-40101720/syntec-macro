# MACRO 图形模拟函数资料包

本资料包执行 [MACRO 知识与验证规划](MACRO知识与验证规划.md) 的 FUN-F 审计，范围为 `SETDRAW` 与 `DRAWHOLE`。两者服务于控制器图形模拟；插件只说明函数表可确认的绘图状态语义，不以静态源码判断颜色、半径、当前位置或模拟渲染结果。

更新日期：2026-07-13
状态：已完成首轮官方函数表审计与 hover 回归；实际模拟画面、颜色范围和机型差异仍待模拟器或控制器验证。

## 1. 函数能力矩阵

| ID | 函数 | 已核实规则 | 当前插件状态 | 后续动作 |
|---|---|---|---|---|
| FUN-F-01 | `SETDRAW(color[, fill, radius])` | 设定图形模拟路径与画圆样式；颜色使用 BGR 码；回传原路径颜色，可暂存后恢复。 | 已有补全与 hover。 | 不验证颜色、半径或运行时绘图状态。 |
| FUN-F-02 | `DRAWHOLE()` | 在当前位置画圆，使用当前 `SETDRAW` 的颜色与刀具半径。 | 已有补全与 hover。 | 在目标模拟器确认不同系统的实际渲染边界。 |

## 2. 已核实的关键边界

- `SETDRAW` 的颜色为 BGR 码，而非直接使用 RGB 码；官方示例说明 RGB 红色 `0xFF0000` 对应 BGR 值 `0x0000FF = 255`。
- `SETDRAW` 同时影响路径和 `DRAWHOLE` 的颜色。若圆形与后续路径需要不同颜色，可将回传的原路径颜色存入变量，在 `DRAWHOLE()` 后再次调用 `SETDRAW` 恢复。
- `DRAWHOLE` 在当前模拟位置画圆，并使用当前绘图样式；它是图形模拟功能，不应被静态分析当作实际加工动作。
- 颜色值、填充、刀具半径、当前位置与模拟器渲染均为运行时上下文，插件不新增范围或调用顺序诊断。

## 3. 实现审查与回归

审查范围：`src/functions.js`、`tests/extension.test.js`。

| 结论 | 说明 |
|---|---|
| 已实现 | `SETDRAW` hover 说明 BGR 编码、原路径颜色返回值和 `DRAWHOLE` 后的恢复方式。 |
| 已实现 | `DRAWHOLE` hover 说明仅在图形模拟内有效，且依赖当前 `SETDRAW` 状态。 |
| 有意保留 | 不对颜色、填充、半径、调用顺序或当前位置新增静态诊断。 |

## 4. 后续验证

| ID | 工作 | 完成条件 |
|---|---|---|
| FUN-F-03 | 验证 BGR 色码与路径颜色恢复。 | 在目标模拟器执行 `SETDRAW`、`DRAWHOLE`、恢复路径颜色的最小样例，并保存控制器版本与截图。 |
| FUN-F-04 | 验证颜色、填充与半径边界。 | 记录支持范围、超界行为及不同机型/版本差异。 |
| FUN-F-05 | 固定已核实 hover 语义。 | 已完成：模块测试覆盖 BGR、路径颜色恢复、模拟器范围和当前样式依赖。 |

## 5. 来源

1. [Macro Function List](https://syntecclub.atlassian.net/wiki/spaces/TechManual/pages/44133992/9.+Macro_Function_List)：`SETDRAW`、`DRAWHOLE` 的 BGR 色码、回传值、路径/圆形共享样式和恢复示例。
2. [MACRO开发应用手册](https://syntecclub.atlassian.net/wiki/spaces/TechManual/pages/44106050/MACRO)：`SETDRAW` 引数定义维护记录与 MACRO 图形模拟背景。