# SYNTEC 宏程序 VSCode 扩展

![Version](https://img.shields.io/badge/version-2.0.0-blue)
![Downloads](https://img.shields.io/vscode-marketplace/d/syntec-team.syntec-macro)
![Rating](https://img.shields.io/vscode-marketplace/r/syntec-team.syntec-macro)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20Linux%20%7C%20macOS-lightgrey)

为新代（Syntec）CNC 宏程序提供完整的开发环境：语法高亮、智能补全、悬停文档、代码跳转、实时语法检查。

## 📖 目录

- [功能特性](#功能特性)
- [安装](#安装)
- [快速开始](#快速开始)
- [详细功能](#详细功能)
- [配置选项](#配置选项)
- [代码片段](#代码片段)
- [已知限制](#已知限制)
- [控制器语法规则](#控制器语法规则)
- [故障排除](#故障排除)
- [贡献](#贡献)
- [许可证](#许可证)

---

## ✨ 功能特性

| 功能 | 说明 | 状态 |
|------|------|------|
| **语法高亮** | `%@MACRO`、控制流、60+ 函数、G/M 代码、变量、字符串 | ✅ |
| **智能补全** | 输入函数名 → 自动弹出含签名参数的补全列表 | ✅ 增强 v2.0.0 |
| **悬停文档** | 悬停函数名/G/M 代码 → 显示完整说明、参数解释、使用示例 | ✅ |
| **代码跳转** | Ctrl+点击 N 标签 → 跳转到定义行；G65 Pxxx → 跳转宏程序 | ✅ |
| **实时诊断** | IF/END_IF/FOR/WHILE/CASE 块配对、括号匹配、中文字符检测 | ✅ |
| **Outline 大纲** | N 标签 → VSCode 大纲/符号导航 | ✅ |
| **代码片段** | 40+ 模板（IF/FOR/DB/IO/报警等） | ✅ |
| **诊断防抖** | 300ms 防抖，打字时不再卡顿 | 🆕 v2.0.0 |
| **includePath** | 配置额外搜索路径，G65 跳转支持多目录 | 🆕 v2.0.0 |

---

## 📦 安装

### 方法 1：从 VSIX 文件安装（推荐）

1. 下载 `syntec-macro-2.0.0.vsix`
2. 在 VS Code 中按 `Ctrl+Shift+P`
3. 输入 `Install from VSIX...`
4. 选择下载的 `.vsix` 文件
5. 重新加载窗口

### 方法 2：从 VS Code 市场安装（待发布）

```
1. 打开 VS Code
2. 进入扩展市场（Ctrl+Shift+X）
3. 搜索 "SYNTEC 宏程序"
4. 点击安装
```

### 方法 3：从源代码构建

```bash
# 克隆仓库
git clone https://github.com/SYNTEC-40101720/syntec-macro-vscode.git
cd syntec-macro-vscode

# 安装依赖
npm install

# 构建（如果需要修改语法文件）
npm run build

# 打包
npm run package

# 安装生成的 .vsix 文件
code --install-extension syntec-macro-2.0.0.vsix
```

---

## 🚀 快速开始

### 1. 创建宏程序文件

创建新文件，保存为 `.macro`、`.G` 或 `.scp` 扩展名，或以 `.nc` 结尾。

**示例**：`O0001.macro`

```macro
%@MACRO
#1 := 100;  赋值
#2 := 200;

N10; 主程序开始
IF #1 > #2 THEN
  #3 := #1 - #2;
  MSG("Result: " + STR(#3));
ELSE
  #3 := #2 - #1;
END_IF;

G00 X#1 Y#2;  快速定位
M99;  子程序返回
```

### 2. 基本操作

| 操作 | 快捷键 | 说明 |
|------|--------|------|
| 触发补全 | `Ctrl+Space` 或自动 | 输入函数名时自动弹出 |
| 查看文档 | 悬停函数名 | 显示完整说明和示例 |
| 跳转到定义 | `Ctrl+Click` | 点击 N 标签或 G65 Pxxx |
| 查看大纲 | `Ctrl+Shift+O` | 显示所有 N 标签 |
| 格式化文档 | 右键 → 格式化 | 自动缩进（需配置） |

---

## 📋 详细功能

### 1. 语法高亮

**支持的元素**：

| 元素 | 示例 | 颜色 |
|------|------|------|
| 宏程序头 | `%@MACRO` | 关键字 |
| 控制流 | `IF`, `FOR`, `WHILE`, `CASE` | 控制关键字 |
| 函数 | `ABS()`, `STR()`, `SQRT` | 函数名 |
| 变量 | `#1`, `@100`, `#name` | 变量 |
| G 代码 | `G00`, `G01`, `G65` | G 代码 |
| M 代码 | `M03`, `M30`, `M99` | M 代码 |
| 字符串 | `"Hello"` | 字符串 |
| 注释 | `// 注释` 或 `(* 注释 *)` | 注释 |
| 数字 | `100`, `3.14` | 数字 |
| 运算符 | `:=`, `=`, `<>`, `AND` | 运算符 |

**示例**：

```macro
%@MACRO
#1 := 100;  (* 局部变量 *)
@100 := 200;  (* 全局变量 *)

IF #1 > 50 THEN  (* 条件判断 *)
  #2 := ABS(#1 - 50);
  MSG("Value: " + STR(#2));
END_IF;

FOR #3 := 1 TO 10 BY 1;
  G01 X[#3 * 10] F500;
ENDFOR;

WHILE #4 < 100;
  #4 := #4 + 1;
ENDWHILE;

CASE #5 OF
  1: G00 X0;
  2: G00 X100;
  ELSE: G00 X50;
ENDCASE;
```

### 2. 智能补全

**触发方式**：
- 输入函数名的前几个字母（如 `ST` → 显示 `STR`, `STR2INT`）
- 输入 `#` → 显示常用变量 `#1`~`#20`
- 输入 `G` 或 `M` → 显示对应的 G/M 代码

**v2.0.0 新增**：补全项自动添加括号 snippet
- 输入 `STR` → 补全为 `STR(${1})`
- 光标自动定位到括号内，方便输入参数

**补全来源**：

| 类型 | 数量 | 示例 |
|------|------|------|
| 内置函数 | 60+ | `ABS`, `STR`, `SQRT`, `READDI` |
| 控制关键字 | 20+ | `IF`, `FOR`, `WHILE`, `CASE` |
| G 代码 | 60+ | `G00`, `G01`, `G65`, `G66.1` |
| M 代码 | 80+ | `M03`, `M30`, `M99`, `M65` |

### 3. 悬停文档

**支持的元素**：

| 元素 | 悬停显示内容 |
|------|--------------|
| 函数 | 函数签名 + 完整说明 + 使用示例 |
| 变量 | 变量类型和名称 |
| G/M 代码 | 代码含义和说明 |
| 关键字 | 关键字说明 |

**示例**：

悬停 `STR` 函数：

```
STR(num)
将数字转换为字符串
STR(123) -> "123"
```

悬停 `M99`：

```
M代码: M99
子程序返回 / 宏程序结束
```

### 4. 代码跳转

**支持的跳转类型**：

#### a) GOTO 跳转

```macro
GOTO 100;  (* Ctrl+Click "100" → 跳转到 N100; *)
...
N100;  (* 目标标签 *)
```

#### b) G65 宏程序跳转

```macro
G65 P1000;  (* Ctrl+Click "P1000" → 打开 G01000.macro *)
```

**搜索规则**（按优先级）：
1. 工作区根目录：`G01000` 或 `G01000.macro`
2. 工作区子目录（递归搜索深度 5）
3. `includePath` 配置中的额外路径（v2.0.0 新增）

**配置 includePath**（v2.0.0 新增）：

打开 VS Code 设置（`Ctrl+,`），搜索 `syntecMacro.includePath`，添加路径：

```json
{
  "syntecMacro.includePath": [
    "C:\\CNC\\MACROS",
    "D:\\PROJECTS\\COMMON"
  ]
}
```

### 5. 实时语法诊断

**检测的问题**：

| 类型 | 示例 | 严重度 |
|------|------|--------|
| 块不匹配 | `IF` 没有 `END_IF` | ❌ Error |
| 括号不匹配 | 多余的 `)` 或缺少 `(` | ⚠️ Warning |
| 中文字符 | 中文标点 `；` 或中文字符 `变量` | ❌ Error |
| GOTO 目标不存在 | `GOTO 999;` 但无 `N999;` | ⚠️ Warning |
| 不支持的语法 | 使用 `ELSIF`（应为 `ELSEIF`） | ❌ Error |

**示例诊断**：

```macro
IF #1 > 0 THEN
  #2 := #1 + 1;
  (* 警告：缺少 END_IF *)

FOR #i := 1 TO 10;
  #sum := #sum + #i;
ENDFOR;  (* 正确 *)

N100；  (* 错误：中文分号 *)
```

**v2.0.0 优化**：诊断防抖 300ms，打字时不再卡顿。

### 6. Outline 大纲

按 `Ctrl+Shift+O` 打开符号导航，显示：
- 所有 N 标签（如 `N10`, `N100`）
- 宏程序入口（`%@MACRO`）

---

## ⚙️ 配置选项

打开 VS Code 设置（`Ctrl+,`），搜索 `syntecMacro`：

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `syntecMacro.enableDiagnostics` | boolean | `true` | 启用语法诊断（IF/END_IF 配对、括号匹配） |
| `syntecMacro.enableCompletions` | boolean | `true` | 启用函数和关键字补全 |
| `syntecMacro.enableHover` | boolean | `true` | 启用悬停文档 |
| `syntecMacro.includePath` | array | `[]` | G65 宏程序文件额外搜索路径（绝对路径） |

**示例配置**：

```json
{
  "syntecMacro.enableDiagnostics": true,
  "syntecMacro.enableCompletions": true,
  "syntecMacro.enableHover": true,
  "syntecMacro.includePath": [
    "C:\\CNC\\MACROS",
    "\\\\SERVER\\SHARE\\MACROS"
  ]
}
```

---

## 📝 代码片段

输入前缀 + `Tab` 快速生成代码块。

### 控制流片段

| 前缀 | 生成的代码 |
|------|-------------|
| `if` | `IF...THEN...END_IF` |
| `ife` | `IF...THEN...ELSEIF...ELSE...END_IF` |
| `for` | `FOR...TO...BY...ENDFOR` |
| `while` | `WHILE...ENDWHILE` |
| `case` | `CASE...OF...ENDCASE` |
| `repeat` | `REPEAT...UNTIL` |

### 函数片段

| 前缀 | 生成的代码 |
|------|-------------|
| `abs` | `ABS(num)` |
| `str` | `STR(num)` |
| `sqrt` | `SQRT(num)` |
| `random` | `RANDOM()` |

### 完整片段列表

详见 [`snippets/syntec-macro.json`](https://github.com/SYNTEC-40101720/syntec-macro-vscode/blob/main/snippets/syntec-macro.json)

---

## ⚠️ 已知限制

### 1. GOTO 跳转限制
- 依赖工作区中存在目标宏程序文件
- `GOTO #变量`（运行期跳转）无法静态验证目标标签是否存在

### 2. 诊断限制
- 仅做块匹配和字符检查，不做完整语义分析
- 无法检测运行时错误（如除零错误）

### 3. 暂不支持的功能
- 宏变量重命名
- 查找所有引用
- 深度语义分析

### 4. 控制器语法限制

详见 [控制器语法规则](#控制器语法规则)

---

## 📏 控制器语法规则

**重要**：以下规则已通过控制器实测确认，扩展严格按照这些规则进行语法检查和补全。

| 规则 | 说明 | 示例 |
|------|------|------|
| **GOTO 语法** | `GOTO 100;`（不带 N），目标为 `N100;` | ✅ `GOTO 100;` → 跳转到 `N100;` |
| **N 标签格式** | `N100;`（必须分号结尾） | ✅ `N100;` / ❌ `N100:` / ❌ 裸 `N100` |
| **ELSIF 不支持** | 请使用 `ELSEIF` | ❌ `ELSIF` / ✅ `ELSEIF` |
| **INT() 不支持** | 请使用 `FLOOR()` 或 `CEIL()` | ❌ `INT(3.8)` / ✅ `FLOOR(3.8)` |
| **[] 不能用于运算** | 仅限间接定值和特定函数 | ✅ `@[#变量]` / ❌ `#1 := #[#2]` |
| **NOT 只能对整数使用** | | ✅ `NOT 5` / ❌ `NOT 3.14` |
| **XOR 支持两种形式** | `IF #1 XOR #2` 和 `IF (1=1) XOR (1=1)` | ✅ |

---

## 🔧 故障排除

### 问题 1：语法高亮不工作

**原因**：文件类型未正确识别。

**解决方法**：
1. 确认文件扩展名为 `.macro`、`.G`、`.scp` 或 `.nc`
2. 或确认文件首行为 `%@MACRO`
3. 手动选择语言：右下角选择语言模式 → `Syntec 新代宏程序`

### 问题 2：补全不弹出

**原因**：补全被禁用或触发条件未满足。

**解决方法**：
1. 检查配置：`syntecMacro.enableCompletions` 是否为 `true`
2. 手动触发：`Ctrl+Space`
3. 确认光标前有字母（如输入 `ST` 再触发）

### 问题 3：G65 跳转不工作

**原因**：目标文件不在搜索路径中。

**解决方法**：
1. 确认目标文件存在于工作区中
2. 文件名约定：`G01000.macro`（补足到 4 位）
3. 配置 `includePath` 添加额外搜索路径
4. 检查诊断：目标不存在时会显示警告

### 问题 4：诊断报错但代码正确

**原因**：可能遇到了未覆盖的边缘情况。

**解决方法**：
1. 检查是否是中文标点符号（如 `；` 应为 `;`）
2. 检查是否是控制器不支持的语法（如 `ELSIF`）
3. 提交 Issue 到 GitHub，附上代码示例

---

## 🤝 贡献

欢迎贡献！请遵循以下步骤：

### 1. Fork 仓库

```bash
# 点击 GitHub 上的 Fork 按钮
git clone https://github.com/<your-username>/syntec-macro-vscode.git
cd syntec-macro-vscode
```

### 2. 创建分支

```bash
git checkout -b feature/your-feature-name
```

### 3. 开发和测试

```bash
# 安装依赖
npm install

# 修改代码...

# 调试：按 F5 启动扩展开发宿主

# 运行 ESLint 检查
npx eslint src/

# 构建（如果需要修改语法文件）
npm run build

# 打包测试
npm run package
code --install-extension syntec-macro-<version>.vsix
```

### 4. 提交更改

```bash
git add -A
git commit -m "feat: your feature description"
git push origin feature/your-feature-name
```

### 5. 创建 Pull Request

1. 访问你的 Fork 页面
2. 点击 "New Pull Request"
3. 填写 PR 描述，包括：
   - 功能说明
   - 测试方法
   - 截图（如果有 UI 变更）

---

## 📄 许可证

MIT License

Copyright (c) 2026 SYNTEC Team

 Permission is hereby granted, free of charge, to any person obtaining a copy
 of this software and associated documentation files (the "Software"), to deal
 in the Software without restriction, including without limitation the rights
 to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 copies of the Software, and to permit persons to whom the Software is
 furnished to do so, subject to the following conditions:

 The above copyright notice and this permission notice shall be included in all
 copies or substantial portions of the Software.

 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 SOFTWARE.

---

## 📧 联系

- **Issue Tracker**: [GitHub Issues](https://github.com/SYNTEC-40101720/syntec-macro-vscode/issues)
- **Discussions**: [GitHub Discussions](https://github.com/SYNTEC-40101720/syntec-macro-vscode/discussions)

---

**Happy Coding! 🎉**
