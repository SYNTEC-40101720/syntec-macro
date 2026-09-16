# MACRO LTP 专项资料包

本资料包记录 LTP 机器人语法的正式页面证据，并把 LTP 专属语法与共享 MACRO 核心分开。它不把机器人指令的版本或限制外推到一般 CNC MACRO。

更新日期：2026-09-16
状态：ROB-001 部分核实；已取得 LTP《语法指令规格》和《机器人语法对应 G 码与支援版本》页面，并登记 20 个独立指令规格页面入口；完整参数、警报边界、机型范围和运行时行为仍需逐项审计。
> 插件状态与后续动作见 [能力矩阵](MACRO能力矩阵.md) 对应能力 ID(ROB-001)。本资料包只维护审计细节与运行时证据,不重复登记状态。
## 1. 适用范围

- 来源空间：Atlassian `LTP`（联达产品/LEANTEC Products）。
- 规则对象：机器人语法、机器人专用指令、配合人机编辑/显示的替代 G 码。
- 共享规则：`%@MACRO` 格式、变量、控制流、调用和函数仍沿用统一 MACRO 分析链路。
- 专项边界：LTP 指令的版本、替代语法、互斥关系、警报和运动时序只在有 LTP 来源或目标机器人验证时使用；不作为一般 CNC 的强诊断依据。

## 2. 已核实的版本基线

| 类别 | 指令 | 替代/对应 G 码 | 官方版本要点 |
| --- | --- | --- | --- |
| 运动 | `MOVL`、`MOVJ`、`MOVC` | `G01.102`、`G53.102`；`MOVC` 无替代码 | 基本语法自 `10.118.0A`；`10.118.27` 以前使用旧式 `G1.1/G1.2/G1.4` |
| 增量运动 | `INCMOVL`、`INCMOVJ` | `G01.101`、`G53.101` | 自 `10.118.9`；`10.118.27` 以前使用旧式 `G1.5/G1.6` |
| 信号与输出 | `SWAITSIG`、`SYNCOUT` | `G04.101`、`G11.103` 等替代包装 | `SWAITSIG` 自 `10.118.0A`；`SYNCOUT` 自 `10.118.0E` |
| 坐标 | `TOOLCOR`、`USERCOR`、`OBJCORON/OFF/CLEAR` | `G43.15`、`G68.15`、`G52.15/G52.16/G52.17` | `TOOLCOR` 自 `10.118.11`；用户坐标自 `10.118.0A`；工件坐标自 `10.118.28E`/`10.118.32` 分阶段支援 |
| 同步与姿态 | `WAITSYNC/ENDSYNC`、`CIRMODE` | `G190.1/G190.2`、`G141.1` | `WAITSYNC/ENDSYNC` 自 `10.118.0A`；`CIRMODE` 自 `10.118.25` |
| 路径与跳脱 | `SHIFTON/OFF`、`SKIPCOND`、`SKIP`、`POSEMAP` | `G52.20/G52.21`、`G31.15`、无替代码、`G142.1` | `SHIFTON/OFF` 自 `10.118.28E`/`10.118.32`；`SKIPCOND` 与 `SKIP` 自 `10.118.28G`/`10.118.33` |
| 附加参数 | `FJ/FEJ/FL/FR`、`PL/PQ/PR`、`ACC/DEC` | 无 | 速度和平滑自 `10.118.0A`；`ACC/DEC` 自 `10.118.25` |

替代语法页面另列出 `G01.101/G01.102/G02.101/G04.101/G04.102/G10.101/G11.101/G52.101/G53.101/G68.18` 等人机包装形式，统一基线为 `10.118.40G`、`10.118.44` 及之后版本。替代语法是编辑/显示包装，不应覆盖正式机器人语法的补全优先级。

版本表中的旧式 G 码只用于资料与兼容性说明；没有目标控制器版本上下文时，插件不将新旧版本差异直接报为 error。

## 3. 当前插件对应关系

| 能力 | 当前实现 | 本批结论 |
| --- | --- | --- |
| 机器人关键字和 G 码 | `src/keywords.js`、语法高亮、补全与 hover | 已覆盖主要移动、坐标、同步、输出、偏移和替代 G 码名称；仍需按正式总表逐项核对遗漏。 |
| 直接引数与第二语法 | `src/robotValidator.js` | 已有 `MOVJ/MOVL/MOVC/INCMOV*` 等直接引数检查和 `MOVJ-II` 保守提示；本批新增 `MOVL/MOVC/INCMOVJ/INCMOVL` 的 `P/Q` 静态范围，以及 `WEAVEON` 的 `P/L/R` 静态范围；动态值不推断，不新增版本推断。 |
| 跨行状态 | `src/robotValidator.js` | 已有 `MOVC` 成对、`SWAITSIG/SYNCOUT` 次数和若干机器人区间互斥检查；需按 LTP 页面逐项核对警报与适用范围。 |
| 文档与样例 | `docs/新代MACRO语法规范手册.md` | 已登记主要指令与部分版本；本资料包补充正式 LTP URL、版本表和产品边界。 |

## 3.5 逐指令 CF 公开页面入口（SOURCES-4 首轮采编，2026-09-15）

本节为每个已找到 CF 公开独立页面的 LTP 指令登记单页 URL 与核心引数范围；完整引数表以 [语法规范手册 §6](../新代MACRO语法规范手册.md#6-机器人移动指令) 为准，资料包不重复登记。CF 页面 fetch 全文需要登录态，通过 Rovo Search 摘要可获取核心引数与版本；后续逐项实机复核仍按 [能力矩阵 ROB-001](MACRO能力矩阵.md) 的"后续验证"推进。

| 指令 | CF 页面 | 关键引数与版本线索（CF 摘要证实） |
| --- | --- | --- |
| `MOVL` | [MOVL-末端直线运动](https://syntecclub.atlassian.net/wiki/spaces/LTP/pages/64815333/MOVL-) | `P`(指定用户座标系)范围 `0~20`，自 `10.118.12` 起；`Q`(指定工具)范围 `0~20`，自 `10.118.12` 起；`FL` 范围 `0.1~Pr405`；`PL/PQ/PR` 三选一，否则 `RBT-103`。 |
| `MOVJ` 第一语法 | [MOVJ-关节运动](https://syntecclub.atlassian.net/wiki/spaces/LTP/pages/64815337/MOVJ-) | `C1~C6`/`A1~A6` 用 `=`；不支持 `P`；自 `10.118.0A` 起；`GP/LP` 参考点语法自 `10.118.40I`、`10.118.41I`、`10.118.45` 起。 |
| `MOVJ` 第二语法 | [MOVJ-关节运动II-末端位置输入](https://syntecclub.atlassian.net/wiki/spaces/LTP/pages/64815339/MOVJ-+II-) | `LP`/`GP` 参考点编号范围 `1~1000`，需整数；区域参考点自 `10.120.32.x/10.120.x/12.0.x` 起；副程序使用参考点规格见 CF 页面注意事项。 |
| `MOVC` | [MOVC-圆弧运动](https://syntecclub.atlassian.net/wiki/spaces/LTP/pages/64815341/MOVC-) | `P`/`Q` 范围 `0~20`，自 `10.118.12` 起；`FL` 范围 `0.1~Pr405`；中间点与结束点单节模态相同，座标系必须相同，否则 `RBT-124`；中间允许指令上限 10 个，否则 `RBT-127`。 |
| `INCMOVL` | [INCMOVL-增量末端直线运动](https://syntecclub.atlassian.net/wiki/spaces/LTP/pages/64815409/INCMOVL-) | `P_` 必填范围 `1~2`；`PL/PQ/PR` 三选一，否则 `RBT-103`；`FL` 范围同 `MOVL`。 |
| `INCMOVJ` | [INCMOVJ-增量关节运动](https://syntecclub.atlassian.net/wiki/spaces/LTP/pages/64815405/INCMOVJ-) | 各轴同动，运动过程中末端点非直线；自 `10.118.9` 起；`Q` 范围 `0~20`，自 `10.118.82B` 起；外部轴单位 mm/deg，不支援英制命令输入。 |
| `STITCHON/STITCHOFF` | [STITCHON/STITCHOFF-连续脉冲输出](https://syntecclub.atlassian.net/wiki/spaces/LTP/pages/64815646/STITCHON+STITCHOFF-) | 中间不可使用 `MOVJ`，否则 `RBT-115`；RESET/加工结束视为自动执行 `STITCHOFF`。 |
| `WEAVEON/WEAVEOFF` | [WEAVEON/WEAVEOFF-摆动](https://syntecclub.atlassian.net/wiki/spaces/LTP/pages/64815586/WEAVEON+WEAVEOFF-) | `P` 范围 `1~50`，需整数，否则 `COR-064`；自 `10.120.28.x/10.120.32.x/10.120.x` 起；`L` 范围 `0~1000000` ms，不可加小数点；`R` 摆动方向 `0~1`，不可加小数点；中间不可使用 `MOVJ`，否则 `RBT-322`。 |
| `SWAITSIG` | [SWAITSIG 独立规格页](https://syntecclub.atlassian.net/wiki/spaces/LTP/pages/64815315) | CF 摘要确认引数集合 `P/Q/R/L/T`；完整数值范围、版本条件与警报仍待逐页核对。 |
| `SYNCOUT` | [SYNCOUT 独立规格页](https://syntecclub.atlassian.net/wiki/spaces/LTP/pages/64815335) | 独立规格页面入口已确认；当前摘要不足以确认完整引数、版本条件与警报，不作强结论。 |
| `TOOLCOR` | [TOOLCOR 独立规格页](https://syntecclub.atlassian.net/wiki/spaces/LTP/pages/64815465) | 对应 `G43.15`；版本表登记自 `10.118.11` 起；完整引数范围、警报与机型条件仍待逐页核对。 |
| `USERCOR` | [USERCOR 独立规格页](https://syntecclub.atlassian.net/wiki/spaces/LTP/pages/64815329) | 对应 `G68.15`；版本表登记自 `10.118.0A` 起；完整引数范围、警报与机型条件仍待逐页核对。 |
| `OBJCORON/OFF/CLEAR` | [OBJCORON/OFF/CLEAR 独立规格页](https://syntecclub.atlassian.net/wiki/spaces/LTP/pages/64815319) | 对应 `G52.15/G52.16/G52.17`；工件坐标支持自 `10.118.28E`/`10.118.32` 分阶段登记；完整引数与警报仍待逐页核对。 |
| `POSEMAP` | [POSEMAP 独立规格页](https://syntecclub.atlassian.net/wiki/spaces/LTP/pages/64816822) | 对应 `G142.1`；独立规格页面入口已确认；完整引数、版本条件与警报仍待逐页核对。 |
| `SHIFTON/SHIFTOFF` | [SHIFTON/SHIFTOFF 独立规格页](https://syntecclub.atlassian.net/wiki/spaces/LTP/pages/64816348) | 对应 `G52.20/G52.21`；版本表登记 `10.118.28E`/`10.118.32` 分阶段支援；完整引数与警报仍待逐页核对。 |
| `SKIPCOND/SKIP` | [SKIPCOND/SKIP 独立规格页](https://syntecclub.atlassian.net/wiki/spaces/LTP/pages/64816276) | `SKIPCOND` 对应 `G31.15`、版本表登记自 `10.118.28G`；`SKIP` 自 `10.118.33`，总表未列替代 G 码；完整引数与警报仍待逐页核对。 |
| `WAITSYNC/ENDSYNC` | [WAITSYNC/ENDSYNC 独立规格页](https://syntecclub.atlassian.net/wiki/spaces/LTP/pages/64815317) | 对应 `G190.1/G190.2`；版本表登记自 `10.118.0A` 起；完整引数、同步边界与警报仍待逐页核对。 |
| `CIRMODE` | [CIRMODE 独立规格页](https://syntecclub.atlassian.net/wiki/spaces/LTP/pages/64815775) | 对应 `G141.1`；版本表登记自 `10.118.25` 起；完整引数、姿态条件与警报仍待逐页核对。 |
| `G192.1/G192.2` | [G192.1/G192.2 独立规格页](https://syntecclub.atlassian.net/wiki/spaces/LTP/pages/64817515) | 独立 G 码规格页面入口已确认；当前摘要不足以确认完整语法、版本条件与警报，不作强结论。 |
| `G68.18` | [G68.18 独立规格页](https://syntecclub.atlassian.net/wiki/spaces/LTP/pages/64817502) | 替代语法页面列入 `G68.18`；替代语法版本线索为 `10.118.40G`、`10.118.44` 及后续；独立页面的完整引数与警报仍待逐页核对。 |

入口登记已完成：上述 12 个页面与前述 8 个页面合计 20 个独立规格入口。入口已登记不等于参数、警报、版本、机型和运行时审计完成；后续按能力矩阵 ROB-001 逐页补证据。

## 4. 未完成项与验证边界

- 《语法指令规格》是总表，不等同于每个指令的完整引数、错误码和运行时保证；参数规则应逐页审计。
- 当前已实现的静态范围仅限 CF 摘要明确且可由文本确认的常量：`MOVL/MOVC` 的 `P/Q` 为 `0~20`、`INCMOVJ Q` 为 `0~20`、`INCMOVL P` 为 `1~2`、`WEAVEON P` 为 `1~50`、细节语法 `WEAVEON L` 为 `0~1000000` 且 `R` 为 `0~1`；表达式和变量保持不诊断。
- 版本表没有为所有指令提供机型、轴数、选配或控制器产品线条件；未知条件继续保持 hover/文档级说明。
- `STITCHON/WEAVEON/WAITSYNC/G192.*` 等区间互斥涉及运动与控制器状态，静态规则必须逐项对照 LTP 警报页并补正反例。
- `81RA` 上 `G66/G66.1` 的实测差异不能由 LTP 语法总表解释，也不能推广到 CNC；仍需目标机器人/控制器记录。
- 除上述已实现的静态范围外，本阶段不再新增未经逐页核实的 validator 规则；不改变通用 CNC 诊断、不新增版本设置项。

## 5. 自动验证计划

1. 以正式总表逐项核对 `src/keywords.js`、语法高亮和补全名称。
2. 为每个新增或修正的机器人规则补充 `tests/validator.test.js` 的 LTP 范围样例，并验证普通 MACRO 不因机器人专属限制误报。
3. 需要运动、I/O、插补或版本条件的规则，补充目标机器人/模拟器记录后再升级为强诊断。
4. 每批修改后运行 `npm.cmd test`、`npm.cmd run lint` 和相关 VS Code 集成测试。

## 6. 来源

- [语法指令规格](https://syntecclub.atlassian.net/wiki/spaces/LTP/pages/64815294)：机器人语法总表、替代语法和指令分类，页面更新于 2026-08-06。
- [机器人语法对应 G 码与支援版本](https://syntecclub.atlassian.net/wiki/spaces/LTP/pages/64816914/G)：机器人语法对应 G 码、最低支援版本和旧版本替代说明，页面更新于 2026-01-09。
- [机器人语法对应 G 码与支援版本（英文版）](https://syntecclub.atlassian.net/wiki/spaces/LTP/pages/64816927)：同一版本矩阵的英文页面，仅作交叉参考。
