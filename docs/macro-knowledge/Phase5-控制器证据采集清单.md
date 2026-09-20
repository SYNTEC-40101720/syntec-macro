# Phase 5 控制器证据采集清单

本清单用于在目标控制器环境（CNC 模拟器或实机）按 Phase 5.1 要求采集跨行状态 parity 所需证据。资料包已存在的首轮记录（`CALL-RUN-01..07` 在 81RA / 10.120.44C）作为基线，本清单在此基础上补充 CNC 侧复核 + `GETPR/SETPR` 签名/权限 + 跨行状态机运行时证据采集指引。

使用流程：
1. 下次上控制器前，先打印本清单作为采集脚本。
2. 每场景跑完后填一行到对应资料包的「验证结果记录」表。
3. 证据等级必须为 A 级（CF 正式函数页）或 B 级（控制器实测记录）；C/D 级言词描述不可单独作 parity 依据。
4. 完成后将本清单连同更新后的资料包提交到工作区，触发 Phase 5.2 设计 Rust 跨行状态 struct（agent 接续）。

更新日期：2026-09-20

---

## A. CALL-RUN-01..07：CNC 控制器复核（资料包：`MACRO调用语义资料包.md` §4）

**阻塞原因**：首轮 81RA 记录中 `CALL-RUN-03/04`（G66/G66.1 模式宏触发频率）与 CF 文档存在差异 —— 81RA 只触发一次，需在 CNC 控制器复核是否每个移动单节触发。

### 采集表（CNC 侧）

| 验证 ID | 程序目标 | 预期观察（CF 文档） | 81RA 首轮结果 | CNC 待测 | 控制器机型 | 软件版本 | 实测结果 | 结论 | 日期 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| CALL-RUN-01 | `G65` 调用前后写同名 `#27` | 父/子值隔离；返回后父值保持 | 通过 (81RA / 10.120.44C) | ☐ | | | | | |
| CALL-RUN-02 | `M98` / `M198` 子程序修改 `#27` | 父程序可观察到子程序修改 | 通过 (81RA / 10.120.44C) | ☐ | | | | | |
| CALL-RUN-03 | `G66` + 穿插移动/非移动 + `G67` | 仅移动单节后触发；取消后不再触发 | **差异**（81RA 只触发 1 次） | ☐ | | | | | |
| CALL-RUN-04 | `G66.1` + 穿插移动/非移动 + `G67` | 每个单节后触发；取消后不再触发 | **差异**（81RA 只触发 1 次） | ☐ | | | | | |
| CALL-RUN-05 | 运动 + `WAIT()` + `M98/M198` 组合 | `WAIT()` 对 M98/M99/M198 不提供完成保证 | 通过 (81RA) | ☐ | | | | | |
| CALL-RUN-06 | `M198` 调用前更新目标文件 | 强制重读；Pr3601~3610 注册后失效 | 通过 (81RA) | ☐ | | | | | |
| CALL-RUN-07A/B/C | `M99` / `M99 P_` / `M99 Q_` | 分别返回下一行/N 序号/行号 | P/Q 已通过 (81RA) | ☐ | | | | | |

### 记录模板（每行实测试跑都用此模板打日志）

```
验证 ID: CALL-RUN-XX
控制器机型:
软件版本:
参数状态（相关 Pr 编号 + 值）:
完整程序（贴 %@MACRO .. M30 全文）:
实测顺序:
  Step 1: <操作描述> → <观察>
  Step 2: <操作描述> → <观察>
  ...
@/`#` 变量实际值（人机监视或 print）:
  @1=<值>, #27=<值>, ...
异常/警报编号（COR-XXX / RBT-XXX）:
截图/录像/日志路径:
结论: 通过 / 差异 / 不通过
差异说明（若有）:
风险与不能外推的边界:
```

---

## B. GETPR / SETPR：A 级签名采集（资料包：`MACRO函数审计资料包.md` §4.1）

**阻塞原因**：CF TechManual `Macro Function List` 当前未见 `GETPR/SETPR` 专页，仓库历史记录的版本号 `10.118.56Z` / `10.118.60T+` 需实机复核。证据空缺直接阻塞 Phase 5.3 JS 端 emit 入口与 Phase 5.4 Rust 侧 parity。

### 采集表

| 验证 ID | 函数调用 | 采集目标 | 控制器机型 | 软件版本 | 实测结果 | 结论 | 日期 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| FUN-A-13A | `GETPR(3401)` | 返回值类型（int/float/string）、固定还是可变、读到 VACANT 还是 0 的边界 | | | | | |
| FUN-A-13B | `GETPR(<越界编号>)` | 是否触发 `COR-016` 或其他警报；返回 VACANT 还是抛错 | | | | | |
| FUN-A-13C | `SETPR(3401, <值>)` | 写入权限边界（哪些 Pr 可写、哪些只读、哪些需权限等级）；写入后是否即时生效还是需重启 | | | | | |
| FUN-A-13D | `SETPR(<越界编号>, <值>)` | 警报编号与失败行为 | | | | | |
| FUN-A-13E | `SETPR(3401, <超范围值>)` | 是否触发 `COR-023` / `COR-024` 或其他警报 | | | | | |
| FUN-A-13F | `GETPR(3401)` 在不同轴群下 | 是否有 `axisGroup` 可选第二引数；若有机型差异记录 | | | | | |

### 记录模板

```
验证 ID: FUN-A-13X
控制器机型:
软件版本:
函数调用（贴代码行）:
  <例子：#1 := GETPR(3401);>
调用前后变量值:
  调用前: #1=<值>
  调用后: #1=<值>
警报/异常（若有）:
权限等级（SETPR 时）:
是否需要重启生效:
签名确认: GETPR(prNo) / GETPR(prNo, axisGroup) / 其他
返回类型: int / float / string / VACANT(#0)
结论: 通过 / 差异 / 不通过
风险与不能外推的边界:
```

---

## C. 跨行状态机运行时边界（资料包：`MACRO-LTP专项资料包.md` §3.6 与 §4）

**阻塞原因**：当前 `src/robotValidator.js` 的 `RobotLineState` 处理 `MOVC pair` / `SWAITSIG`/`SYNCOUT` counters / `STITCHON/WEAVEON/WAITSYNC/G192.*` 生效范围禁忌，但这些跨行规则在控制器上的实际警报编号与生效位置需复核以保 Rust 侧 parity。

### 采集表

| 验证 ID | 场景 | 期望警报（CF 页面） | 实测警报（控制器） | 控制器机型 | 软件版本 | 结论 | 日期 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| ROB-LTP-01 | `MOVC` 中间点单节模态不同 | `RBT-124` | | | | | |
| ROB-LTP-02 | `MOVC` 中间点超过 10 个 | `RBT-127` | | | | | |
| ROB-LTP-03 | `STITCHON` 中间用 `MOVJ` | `RBT-115` | | | | | |
| ROB-LTP-04 | `WEAVEON` 中间用 `MOVJ` | `RBT-322` | | | | | |
| ROB-LTP-05 | `SWAITSIG` 跨运动单节未配对 | 跨行状态机警报（待确认编号） | | | | | |
| ROB-LTP-06 | `SYNCOUT` 单运动单节超过 10 个 | 跨行状态机警报（待确认编号） | | | | | |
| ROB-LTP-07 | `WAITSYNC` / `ENDSYNC` 区间内用 `SHIFTON` | 跨行状态机警报（待确认编号） | | | | | |
| ROB-LTP-08 | `G192.1` 作用区间用禁忌指令 | 跨行状态机警报（待确认编号） | | | | | |

### 跨行状态机特别记录要求

```text
验证 ID: ROB-LTP-XX
场景文本:
控制器机型:
软件版本:
触发程序的完整文本（含 %@MACRO .. M30）:
触发顺序（哪一行报错、行号、列位置）:
警报编号:
警报消息:
异常状态下 RobotLineState 应追踪的内部计数器值:
  MOVC_pair_count: ?
  SWAITSIG_pending: ?
  SYNCOUT_count: ?
  STITCHON_active: bool
  WEAVEON_active: bool
  WAITSYNC_active: bool
  G192_scope_active: bool
结论: 警报编号/位置与文档一致 / 差异说明
差异说明（若有）:
```

---

## D. 采集完成后 agent 端的接续工作

完成上述全部/部分采集并提交后，agent 将自动启动：

| Phase 5 步骤 | 接续工作（agent） | 依赖 |
| --- | --- | --- |
| 5.2 设计 Rust 跨行状态 struct | 在 `crates/syntec-core/src/lib.rs` 新增 `RobotLineState`/变量生命周期表/M198 重读缓存/WAIT 时序状态，与 JS `src/robotValidator.js` 字段对齐 | 全部 A/B/C 采集至少一轮 |
| 5.3 JS 端跨行 emit 入口 | 对照证据，在 `validateRobotLineState` / `finalize_robot_state` 补登记 emit；dead code `SWAITSIG_Q_RANGE` / `SYNCOUT_Q_RANGE` / `SKIPCOND_Q_RANGE` 若补 emit 需同步迁 Rust | C 全部 + A CALL-RUN-03/04 |
| 5.4 Rust 侧 parity 实现 | 在 `crates/syntec-core/src/lib.rs` 同名函数 + 参数化排序与 col 对齐 | 5.3 完成 |
| 5.5 接入 `analyze_request` 主循环 | 在 `analyze_request` 主循环调用跨行状态机；`result_to_json` 输出完整诊断序列 | 5.4 完成 |
| 5.6 更新 parity 清单与能力矩阵 | `Rust诊断parity清单.md` 顶部状态从 67/67 扩展；能力矩阵对应能力 ID 状态从 «资料阻塞» 改为 «已覆盖» | 5.5 完成 |

---

## E. 阻塞风险与最低证据门槛

- **A 级证据**：CF TechManual / LTP 公开独立函数专页；本清单 A/B/C 三类在 CF 不足时以 B 级（控制器实测记录）补足。
- **C/D 级不可单独作 parity 依据**：仓库历史记录、博客、口述、推断均不可单独作为 Rust 端 parity 的 emit 依据。
- **81RA ↔ CNC 不可外推**：81RA 机器人系统的运行时差异（如 G66/G66.1 只触发一次）不能推广到 CNC，必须按目标控制器分别采集。
- **未完成 Phase 5 任一步骤前，不将跨行规则升级为静态 error**：与现有 `MACRO调用语义资料包.md` §1 的 CALL-001 / CALL-002 边界一致。

---

## F. 已确认 CF 页面入口（首轮资料采编，2026-09-15）

| 指令 | CF 页面 | 用于 parity 的关键引数 |
| --- | --- | --- |
| `MOVL`/`MOVJ`/`MOVC`/`INCMOV*` | 见 `MACRO-LTP专项资料包.md` §3.5 | P/Q 范围、FL 范围、`RBT-103/124/127` |
| `SWAITSIG` | 见 §3.5 | P=1~3、R=0~1、L/T=0~2^31、Q 联动 |
| `SYNCOUT` | 见 §3.5 | S=1~3、P=0~100、R=0~1、L=0~10000、K=-10000~10000、Q 联动 |
| `STITCHON/STITCHOFF` | 见 §3.5 | `RBT-115` 中间不可用 MOVJ |
| `WEAVEON/WEAVEOFF` | 见 §3.5 | P=1~50、L=0~1000000 ms、R=0~1、`RBT-322` |
| `TOOLCOR/USERCOR` | 见 §3.5 | P=0~20、不支持混用语法 |
| `G192.1/G192.2` | 见 §3.5 | P=0~20、Q=0~65530、R=1~2、E=-10~10（可选） |
| `G66/G66.1/G67` | 见 `MACRO调用语义资料包.md` §3 | C-Type 移动单节/每单节触发 |
| `M98/M198/M99` | 见 §3 | `COR-052` P 必填、`M02/M30` 子程序结束、`M99 P/Q` |

---

更新本清单后，请同步在下列资料包追加一行版本记录：
- `docs/macro-knowledge/MACRO调用语义资料包.md` — CALL-RUN-XX 实测行追加到 §4 表
- `docs/macro-knowledge/MACRO函数审计资料包.md` — FUN-A-13X 实测行追加到 §4 表 + §4.1 阻塞状态更新
- `docs/macro-knowledge/MACRO-LTP专项资料包.md` — ROB-LTP-XX 实测行追加到 §3/§4
