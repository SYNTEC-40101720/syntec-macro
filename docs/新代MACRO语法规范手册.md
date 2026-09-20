# 新代 MACRO 语法规范手册

本文档用于沉淀新代控制器 MACRO / LTP 机器人语法规范，作为 VS Code 插件的语法真源草案。

本文档目标：

- 记录已确认语法，减少规则散落在代码、snippet、README、测试和范例中的漂移。
- 区分正式语法、兼容但不推荐语法、不支持语法、待确认语法。
- 为 hover、snippet、diagnostics、TextMate grammar、测试用例提供统一依据。


> **本文为顶层索引**。手册按主题聚类拆分为 7 个独立文档，便于按主题维护；全部章节标题（含 `###`/`####`）保留在本文，外部链接锚点（如 `#25-公用变量--1`）仍指向本文件的对应标题。每个章节的内容已迁移到对应主题文件，上方表格与下方章节标题均为指针。

| 主题文件 | 覆盖章节 |
| --- | --- |
| [01-format.md](macro-handbook/01-format.md) — 基础文件格式与状态标记 | 0. 状态标记、1. 基础文件格式、14. 后续维护流程 |
| [02-variables.md](macro-handbook/02-variables.md) — 变量系统与运算子 | 2. 变量系统、3. 运算子 |
| [03-syntax.md](macro-handbook/03-syntax.md) — MACRO 语法指令 | 4. MACRO 语法指令 |
| [04-call.md](macro-handbook/04-call.md) — 子程序与宏呼叫 | 5. 子程序与宏呼叫 |
| [05-robot.md](macro-handbook/05-robot.md) — 机器人移动、坐标系与应用指令 | 6. 机器人移动指令、7. 坐标系与工具系、8. 应用指令 |
| [06-functions.md](macro-handbook/06-functions.md) — 函数规则 | 9. 函数规则 |
| [07-notes.md](macro-handbook/07-notes.md) — 撰写注意事项与待确认项 | 10. MACRO 撰写注意事项、11. 已落地规则索引、12. 待落地优先级、13. 待确认项 |

## 0. 状态标记

详见 [基础文件格式与状态标记](macro-handbook/01-format.md)。

## 1. 基础文件格式

详见 [基础文件格式与状态标记](macro-handbook/01-format.md)。

### 1.1 MACRO 格式判定

内容已迁移到 [基础文件格式与状态标记](macro-handbook/01-format.md)。

### 1.2 文件后缀与加工档选择

内容已迁移到 [基础文件格式与状态标记](macro-handbook/01-format.md)。

### 1.3 扩充 G 码宏程序命名

内容已迁移到 [基础文件格式与状态标记](macro-handbook/01-format.md)。

### 1.4 O 码副程序命名

内容已迁移到 [基础文件格式与状态标记](macro-handbook/01-format.md)。

### 1.5 文件存放路径与优先级

内容已迁移到 [基础文件格式与状态标记](macro-handbook/01-format.md)。

### 1.6 Macro 转换工具输入格式

内容已迁移到 [基础文件格式与状态标记](macro-handbook/01-format.md)。

### 1.7 插件识别策略

内容已迁移到 [基础文件格式与状态标记](macro-handbook/01-format.md)。

### 1.8 注释

内容已迁移到 [基础文件格式与状态标记](macro-handbook/01-format.md)。

### 1.9 字符集

内容已迁移到 [基础文件格式与状态标记](macro-handbook/01-format.md)。

### 1.10 MACRO 读取/处理流程

内容已迁移到 [基础文件格式与状态标记](macro-handbook/01-format.md)。

## 2. 变量系统

详见 [变量系统与运算子](macro-handbook/02-variables.md)。

### 2.1 区域变量 `#`

内容已迁移到 [变量系统与运算子](macro-handbook/02-variables.md)。

### 2.2 宏程序引数映射

内容已迁移到 [变量系统与运算子](macro-handbook/02-variables.md)。

### 2.3 区域变量生命周期

内容已迁移到 [变量系统与运算子](macro-handbook/02-variables.md)。

### 2.4 VACANT `#0`

内容已迁移到 [变量系统与运算子](macro-handbook/02-variables.md)。

### 2.5 公用变量 `@`

内容已迁移到 [变量系统与运算子](macro-handbook/02-variables.md)。

### 2.6 变量类型对比

内容已迁移到 [变量系统与运算子](macro-handbook/02-variables.md)。

### 2.7 变量使用建议

内容已迁移到 [变量系统与运算子](macro-handbook/02-variables.md)。

### 2.8 常见变量警报

内容已迁移到 [变量系统与运算子](macro-handbook/02-variables.md)。

### 2.9 AR / MAR

内容已迁移到 [变量系统与运算子](macro-handbook/02-variables.md)。

## 3. 运算子

详见 [变量系统与运算子](macro-handbook/02-variables.md)。

### 3.1 运算子优先级

内容已迁移到 [变量系统与运算子](macro-handbook/02-variables.md)。

### 3.2 赋值运算子

内容已迁移到 [变量系统与运算子](macro-handbook/02-variables.md)。

### 3.3 算术运算子

内容已迁移到 [变量系统与运算子](macro-handbook/02-variables.md)。

### 3.4 除法

内容已迁移到 [变量系统与运算子](macro-handbook/02-variables.md)。

### 3.5 MOD

内容已迁移到 [变量系统与运算子](macro-handbook/02-variables.md)。

### 3.6 关系运算子

内容已迁移到 [变量系统与运算子](macro-handbook/02-variables.md)。

### 3.7 逻辑运算子

内容已迁移到 [变量系统与运算子](macro-handbook/02-variables.md)。

### 3.8 括号运算子

内容已迁移到 [变量系统与运算子](macro-handbook/02-variables.md)。

### 3.9 型态转换规则

内容已迁移到 [变量系统与运算子](macro-handbook/02-variables.md)。

### 3.10 运算子常见应用

内容已迁移到 [变量系统与运算子](macro-handbook/02-variables.md)。

### 3.11 常见错误与警报

内容已迁移到 [变量系统与运算子](macro-handbook/02-variables.md)。

### 3.12 实用建议

内容已迁移到 [变量系统与运算子](macro-handbook/02-variables.md)。

## 4. MACRO 语法指令

详见 [MACRO 语法指令](macro-handbook/03-syntax.md)。

### 4.1 语法总览

内容已迁移到 [MACRO 语法指令](macro-handbook/03-syntax.md)。

### 4.2 变量指定

内容已迁移到 [MACRO 语法指令](macro-handbook/03-syntax.md)。

### 4.3 GOTO

内容已迁移到 [MACRO 语法指令](macro-handbook/03-syntax.md)。

### 4.4 IF

内容已迁移到 [MACRO 语法指令](macro-handbook/03-syntax.md)。

### 4.5 CASE

内容已迁移到 [MACRO 语法指令](macro-handbook/03-syntax.md)。

### 4.6 REPEAT

内容已迁移到 [MACRO 语法指令](macro-handbook/03-syntax.md)。

### 4.7 WHILE

内容已迁移到 [MACRO 语法指令](macro-handbook/03-syntax.md)。

### 4.8 FOR

内容已迁移到 [MACRO 语法指令](macro-handbook/03-syntax.md)。

### 4.9 EXIT

内容已迁移到 [MACRO 语法指令](macro-handbook/03-syntax.md)。

### 4.10 注释

内容已迁移到 [MACRO 语法指令](macro-handbook/03-syntax.md)。

### 4.11 巢状语法

内容已迁移到 [MACRO 语法指令](macro-handbook/03-syntax.md)。

### 4.12 循环选择

内容已迁移到 [MACRO 语法指令](macro-handbook/03-syntax.md)。

### 4.13 分号规则

内容已迁移到 [MACRO 语法指令](macro-handbook/03-syntax.md)。

### 4.14 完整警报速查

内容已迁移到 [MACRO 语法指令](macro-handbook/03-syntax.md)。

### 4.15 无穷循环防护

内容已迁移到 [MACRO 语法指令](macro-handbook/03-syntax.md)。

## 5. 子程序与宏呼叫

详见 [子程序与宏呼叫](macro-handbook/04-call.md)。

### 5.1 呼叫方式

内容已迁移到 [子程序与宏呼叫](macro-handbook/04-call.md)。

### 5.2 返回方式

内容已迁移到 [子程序与宏呼叫](macro-handbook/04-call.md)。

### 5.3 登录 G / M / T 码宏程序

内容已迁移到 [子程序与宏呼叫](macro-handbook/04-call.md)。

#### 5.3.1 扩充 G 码

内容已迁移到 [子程序与宏呼叫](macro-handbook/04-call.md)。

#### 5.3.2 登录 G 码

内容已迁移到 [子程序与宏呼叫](macro-handbook/04-call.md)。

#### 5.3.3 登录 M 码

内容已迁移到 [子程序与宏呼叫](macro-handbook/04-call.md)。

#### 5.3.4 T 码宏程序

内容已迁移到 [子程序与宏呼叫](macro-handbook/04-call.md)。

#### 5.3.5 同一单节解译与引数占用

内容已迁移到 [子程序与宏呼叫](macro-handbook/04-call.md)。

#### 5.3.6 Pr3598 M 码引数模式

内容已迁移到 [子程序与宏呼叫](macro-handbook/04-call.md)。

#### 5.3.7 常见警报与速查

内容已迁移到 [子程序与宏呼叫](macro-handbook/04-call.md)。

## 6. 机器人移动指令

详见 [机器人移动、坐标系与应用指令](macro-handbook/05-robot.md)。

### 6.0.1 指令总表

内容已迁移到 [机器人移动、坐标系与应用指令](macro-handbook/05-robot.md)。

### 6.0 路径扩充引数

内容已迁移到 [机器人移动、坐标系与应用指令](macro-handbook/05-robot.md)。

### 6.1 MOVJ 第一语法

内容已迁移到 [机器人移动、坐标系与应用指令](macro-handbook/05-robot.md)。

### 6.2 MOVJ 第二语法

内容已迁移到 [机器人移动、坐标系与应用指令](macro-handbook/05-robot.md)。

### 6.3 MOVL

内容已迁移到 [机器人移动、坐标系与应用指令](macro-handbook/05-robot.md)。

### 6.4 MOVC

内容已迁移到 [机器人移动、坐标系与应用指令](macro-handbook/05-robot.md)。

### 6.5 INCMOVJ

内容已迁移到 [机器人移动、坐标系与应用指令](macro-handbook/05-robot.md)。

### 6.6 INCMOVL

内容已迁移到 [机器人移动、坐标系与应用指令](macro-handbook/05-robot.md)。

### 6.7 移动附加指令

内容已迁移到 [机器人移动、坐标系与应用指令](macro-handbook/05-robot.md)。

## 7. 坐标系与工具系

详见 [机器人移动、坐标系与应用指令](macro-handbook/05-robot.md)。

### 7.1 USERCOR

内容已迁移到 [机器人移动、坐标系与应用指令](macro-handbook/05-robot.md)。

### 7.2 G68.18

内容已迁移到 [机器人移动、坐标系与应用指令](macro-handbook/05-robot.md)。

### 7.3 OBJCORON / OBJCOROFF / OBJCORCLEAR

内容已迁移到 [机器人移动、坐标系与应用指令](macro-handbook/05-robot.md)。

### 7.4 G43.16

内容已迁移到 [机器人移动、坐标系与应用指令](macro-handbook/05-robot.md)。

### 7.5 TOOLCOR

内容已迁移到 [机器人移动、坐标系与应用指令](macro-handbook/05-robot.md)。

### 7.6 POSEMAP

内容已迁移到 [机器人移动、坐标系与应用指令](macro-handbook/05-robot.md)。

### 7.7 SHIFTON / SHIFTOFF

内容已迁移到 [机器人移动、坐标系与应用指令](macro-handbook/05-robot.md)。

### 7.8 其他坐标系设定

内容已迁移到 [机器人移动、坐标系与应用指令](macro-handbook/05-robot.md)。

## 8. 应用指令

详见 [机器人移动、坐标系与应用指令](macro-handbook/05-robot.md)。

### 8.1 SKIPCOND / SKIP

内容已迁移到 [机器人移动、坐标系与应用指令](macro-handbook/05-robot.md)。

### 8.2 SWAITSIG

内容已迁移到 [机器人移动、坐标系与应用指令](macro-handbook/05-robot.md)。

### 8.3 SYNCOUT

内容已迁移到 [机器人移动、坐标系与应用指令](macro-handbook/05-robot.md)。

### 8.4 G10 L 指令

内容已迁移到 [机器人移动、坐标系与应用指令](macro-handbook/05-robot.md)。

#### 8.4.1 G10 L1000 - R 寄存器写入

内容已迁移到 [机器人移动、坐标系与应用指令](macro-handbook/05-robot.md)。

#### 8.4.2 G10 L1803 - MACRO IO TYPE-1 新格式

内容已迁移到 [机器人移动、坐标系与应用指令](macro-handbook/05-robot.md)。

#### 8.4.3 G10 L1805 - MACRO IO TYPE-2

内容已迁移到 [机器人移动、坐标系与应用指令](macro-handbook/05-robot.md)。

#### 8.4.4 G10 L1803/L1805 共通限制与 Q 引数范例

内容已迁移到 [机器人移动、坐标系与应用指令](macro-handbook/05-robot.md)。

#### 8.4.5 G10 L1810 - 设定讯号条件

内容已迁移到 [机器人移动、坐标系与应用指令](macro-handbook/05-robot.md)。

#### 8.4.6 G10 L1820 - 等待讯号条件成立

内容已迁移到 [机器人移动、坐标系与应用指令](macro-handbook/05-robot.md)。

#### 8.4.7 G10 通讯相关指令

内容已迁移到 [机器人移动、坐标系与应用指令](macro-handbook/05-robot.md)。

##### G10 L1021 - 发送 ENIP 通讯命令

内容已迁移到 [机器人移动、坐标系与应用指令](macro-handbook/05-robot.md)。

##### G10 L1022 - EtherCAT 物件字典读写功能

内容已迁移到 [机器人移动、坐标系与应用指令](macro-handbook/05-robot.md)。

##### G10 L1900/L1901/L1910/L1911 - MODBUS 通讯指令

内容已迁移到 [机器人移动、坐标系与应用指令](macro-handbook/05-robot.md)。

### 8.5 STITCHON / STITCHOFF

内容已迁移到 [机器人移动、坐标系与应用指令](macro-handbook/05-robot.md)。

### 8.6 WEAVEON / WEAVEOFF

内容已迁移到 [机器人移动、坐标系与应用指令](macro-handbook/05-robot.md)。

### 8.7 G04.102

内容已迁移到 [机器人移动、坐标系与应用指令](macro-handbook/05-robot.md)。

### 8.8.1 G192.1 / G192.2

内容已迁移到 [机器人移动、坐标系与应用指令](macro-handbook/05-robot.md)。

### 8.9 WAITSYNC / ENDSYNC

内容已迁移到 [机器人移动、坐标系与应用指令](macro-handbook/05-robot.md)。

### 8.10 CIRMODE

内容已迁移到 [机器人移动、坐标系与应用指令](macro-handbook/05-robot.md)。

### 8.11 其他机器人应用指令

内容已迁移到 [机器人移动、坐标系与应用指令](macro-handbook/05-robot.md)。

### 8.12 机械手臂支援的 CNC 标准 G 码

内容已迁移到 [机器人移动、坐标系与应用指令](macro-handbook/05-robot.md)。

### 8.13 机器人指令互斥关系

内容已迁移到 [机器人移动、坐标系与应用指令](macro-handbook/05-robot.md)。

### 8.14 机器人警报速查

内容已迁移到 [机器人移动、坐标系与应用指令](macro-handbook/05-robot.md)。

### 8.15 G193.110

内容已迁移到 [机器人移动、坐标系与应用指令](macro-handbook/05-robot.md)。

## 9. 函数规则

详见 [函数规则](macro-handbook/06-functions.md)。

### 9.1 函数分类总览

内容已迁移到 [函数规则](macro-handbook/06-functions.md)。

### 9.2 数学运算函数

内容已迁移到 [函数规则](macro-handbook/06-functions.md)。

### 9.3 单位转换函数

内容已迁移到 [函数规则](macro-handbook/06-functions.md)。

### 9.4 引数与变量读取函数

内容已迁移到 [函数规则](macro-handbook/06-functions.md)。

### 9.5 系统诊断函数

内容已迁移到 [函数规则](macro-handbook/06-functions.md)。

### 9.6 I/O 读写函数

内容已迁移到 [函数规则](macro-handbook/06-functions.md)。

### 9.7 文件操作函数

内容已迁移到 [函数规则](macro-handbook/06-functions.md)。

### 9.8 Cycle 数据库函数

内容已迁移到 [函数规则](macro-handbook/06-functions.md)。

### 9.9 堆栈操作函数

内容已迁移到 [函数规则](macro-handbook/06-functions.md)。

### 9.10 讯息与警报函数

内容已迁移到 [函数规则](macro-handbook/06-functions.md)。

### 9.11 流程控制函数

内容已迁移到 [函数规则](macro-handbook/06-functions.md)。

### 9.12 图形模拟函数

内容已迁移到 [函数规则](macro-handbook/06-functions.md)。

### 9.13 安全验证函数

内容已迁移到 [函数规则](macro-handbook/06-functions.md)。

### 9.14 函数相关警报

内容已迁移到 [函数规则](macro-handbook/06-functions.md)。

## 10. MACRO 撰写注意事项

详见 [撰写注意事项与待确认项](macro-handbook/07-notes.md)。

### 10.1 档案格式与命名

内容已迁移到 [撰写注意事项与待确认项](macro-handbook/07-notes.md)。

### 10.2 预解与 WAIT

内容已迁移到 [撰写注意事项与待确认项](macro-handbook/07-notes.md)。

### 10.3 模态备份与还原

内容已迁移到 [撰写注意事项与待确认项](macro-handbook/07-notes.md)。

### 10.4 座标系统禁忌

内容已迁移到 [撰写注意事项与待确认项](macro-handbook/07-notes.md)。

### 10.5 引数处理

内容已迁移到 [撰写注意事项与待确认项](macro-handbook/07-notes.md)。

### 10.6 变量使用建议

内容已迁移到 [撰写注意事项与待确认项](macro-handbook/07-notes.md)。

### 10.7 运算与型态陷阱

内容已迁移到 [撰写注意事项与待确认项](macro-handbook/07-notes.md)。

### 10.8 循环与格式

内容已迁移到 [撰写注意事项与待确认项](macro-handbook/07-notes.md)。

### 10.9 调试与排查

内容已迁移到 [撰写注意事项与待确认项](macro-handbook/07-notes.md)。

### 10.10 撰写模板

内容已迁移到 [撰写注意事项与待确认项](macro-handbook/07-notes.md)。

## 11. 已落地规则索引

详见 [撰写注意事项与待确认项](macro-handbook/07-notes.md)。

## 12. 待落地优先级

详见 [撰写注意事项与待确认项](macro-handbook/07-notes.md)。

## 13. 待确认项

详见 [撰写注意事项与待确认项](macro-handbook/07-notes.md)。

## 14. 后续维护流程

详见 [基础文件格式与状态标记](macro-handbook/01-format.md)。
