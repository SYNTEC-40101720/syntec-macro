# SYNTEC 宏程序 VS Code 扩展

![Version](https://img.shields.io/badge/version-2.11.6-blue)

为新代宏程序（syntec-macro）提供语法高亮、补全、悬停说明、代码跳转和实时诊断。


## 快速开始

打开或创建以下文件之一：

- 无后缀的 G/O 程序，例如 `G1000`、`O8000`
- `.nc`、`.cnc`、`.tap`、`.prt`、`.mpf`、`.ptp` 等加工档
- 首行为 `%@MACRO` 的文件，会自动识别为 MACRO 格式

示例：

```macro
%@MACRO
#1 := 100;
#2 := 200;

IF #1 < #2 THEN
    #3 := #2 - #1;
    MSG("Result ready");
END_IF;
```

如果没有自动识别语言，可点击右下角语言模式，选择 **Syntec 新代宏程序**。

## 常用功能

| 功能 | 用法 |
| --- | --- |
| 补全 | 输入函数、关键字、G/M 代码或 `#`，也可按 `Ctrl+Space` |
| 悬停说明 | 将鼠标移到函数、G/M 代码或关键字上 |
| 跳转定义 | `Ctrl+Click` 跳转 N 标签、G65/G66、M98/M198 目标 |
| 查找引用 | 在静态调用目标上按 `Shift+F12` |
| 符号导航 | `Ctrl+Shift+O` 查看 N 标签和宏入口 |
| 工作区符号 | `Ctrl+T` 搜索 G/O 程序、宏入口和 N 标签 |
| 格式化 | 右键选择“格式化文档” |

支持的机器人指令包括 `MOVJ`、`MOVL`、`MOVC`、`USERCOR`、`TOOLCOR`、`SKIP`、`SWAITSIG`、`SYNCOUT` 等。

## 配置

在 VS Code 设置中搜索 `syntecMacro`：

| 配置项 | 默认值 | 说明 |
| --- | --- | --- |
| `syntecMacro.enableDiagnostics` | `true` | 启用实时语法诊断 |
| `syntecMacro.enableCompletions` | `true` | 启用补全 |
| `syntecMacro.enableHover` | `true` | 启用悬停文档 |
| `syntecMacro.includePath` | `[]` | G65/G66 目标的额外搜索目录 |

例如：

```json
{
  "syntecMacro.includePath": [
    "C:\\CNC\\MACROS",
    "D:\\PROJECTS\\COMMON"
  ]
}
```

目标文件通常按以下规则搜索：`G65 P1000` 对应 `G1000`，`M98 P8000` 对应 `O8000`，命名宏对应同名文件。变量或表达式目标无法静态跳转。

## 诊断与写法

扩展会检查括号、控制结构、GOTO 目标、中文字符、函数参数、机器人指令和分号等问题，并在适用时提供 Quick Fix。

新代宏程序常用写法：

```macro
GOTO 100;
N100;

IF #1 = 1 THEN
    #2 := #2 + 1;
ELSEIF #1 = 2 THEN
    #2 := #2 + 2;
END_IF;
```

- 使用 `ELSEIF`，不要使用 `ELSIF`。
- 使用单独的 `=` 比较，不要使用 `==`。
- 使用 `/` 做除法，不要使用 `DIV`。
- `N` 标签和完整语句通常以 `;` 结尾；控制结构头不应额外加 `;`。
- 使用半角标点和控制器支持的变量格式。

完整规则、诊断代码和修复动作见：[诊断规则与修复动作](docs/诊断规则与修复动作.md)。

## 代码片段

输入前缀后按 `Tab`，可快速插入控制流、函数、G10 L 指令和机器人指令模板。完整列表见：[snippets/syntec-macro.json](snippets/syntec-macro.json)。

## 常见问题

**没有高亮或补全**

确认文件语言模式为 **Syntec 新代宏程序**，并检查 `syntecMacro.enableCompletions` 是否为 `true`。

**G65/M98 无法跳转**

确认目标文件名称和编号匹配，并将目标目录加入 `syntecMacro.includePath`。动态变量和表达式目标不支持静态跳转。

**出现中文字符错误**

将中文标点（如 `；`、`（`、`）`）替换为半角标点；字符串中的中文内容可以正常使用。

**变量显示异常**

可在 VS Code 设置中关闭颜色装饰器：

```json
{
  "editor.colorDecorators": false
}
```