---
name: syntec-packaging
description: "Use when: 新代/SYNTEC 域控环境打包与发布（domain-controlled packaging for Python/C#），包含命名规范、版本信息、PyInstaller 与 dotnet publish、故障排查与发布清单。"
argument-hint: "说明项目类型、入口文件/项目、目标 exe 名称、版本号、输出目录"
---

# SYNTEC 域控打包技能

## 适用场景

当用户要在 SYNTEC 域控环境部署程序时，使用本技能统一处理：

- Python 程序 PyInstaller 打包。
- C#/.NET 程序发布 exe。
- 域控阻断项检查（文件名、版本信息、语言代码、UPX、ctypes）。
- 发布前检查清单生成与审查。

## 阻断规则（未满足即不可发布）

1. 最终 exe 文件名必须以 `SYNTEC` 开头。
2. 版本信息中公司和版权必须包含 `SYNTEC`。
3. 版本号必须是四段数字（如 `1.0.0.0`）。
4. Python 打包必须禁用 UPX（`--noupx` 或 `upx=False`）。
5. Python 代码禁止使用 `ctypes` 调用 Windows API（如 `windll` / `ShowWindow`）。
6. Python 版本资源必须使用中性语言：`StringTable`=`000004B0`，`Translation`=`[0, 1200]`。
7. Python 打包路径必须为纯英文路径（无中文、空格、特殊字符）。
8. Python one-dir 产物必须验证 `_internal` 关键文件存在。

## 关键输入信息

执行前优先确认：

- 项目类型：Python 或 C#/.NET。
- 入口：`.py` / `.csproj` / `.sln`。
- 输出 exe 名称（需以 `SYNTEC` 开头）。
- 版本号（默认 `1.0.0.0`）。
- 发布年份（默认当前年份）。
- 输出目录和目标运行时（默认 `win-x64`）。

若缺失关键信息且无法推断，只问最少必要问题。

## 标准执行流程

### 1. 选择打包路径

- Python GUI：`--onedir --windowed --noupx --clean`。
- Python CLI：`--onedir --noupx --clean`。
- C#/.NET：配置 `.csproj` 元数据后 `dotnet publish`。

### 2. 配置版本信息

C#/.NET `.csproj` 关键字段：

```xml
<Company>SYNTEC</Company>
<Copyright>Copyright © SYNTEC YYYY</Copyright>
<Description>SYNTEC-应用程序</Description>
<Product>SYNTEC-产品</Product>
<FileVersion>1.0.0.0</FileVersion>
<Version>1.0.0.0</Version>
```

Python `version_info.txt` 关键点：

- `StringTable('000004B0', ...)`
- `VarStruct('Translation', [0, 1200])`
- `CompanyName` 与 `LegalCopyright` 含 `SYNTEC`

### 3. 打包命令模板

Python：

```powershell
py -m PyInstaller --onedir --windowed --version-file version_info.txt --name "SYNTEC-应用名" --noupx --clean app.py
```

C#/.NET：

```powershell
dotnet publish -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -p:EnableCompressionInSingleFile=true -o "输出目录"
```

### 4. 验证命令模板

Python：

```powershell
$exe = ".\dist\SYNTEC-应用名\SYNTEC-应用名.exe"
(Get-Item $exe).VersionInfo | Format-List CompanyName, LegalCopyright, FileVersion, ProductVersion, Language
Test-Path ".\dist\SYNTEC-应用名\_internal\python311.dll"
Test-Path ".\dist\SYNTEC-应用名\_internal\_ctypes.pyd"
```

C#/.NET：

```powershell
$exe = ".\输出目录\SYNTEC-应用名.exe"
(Get-Item $exe).VersionInfo | Format-List CompanyName, LegalCopyright, FileVersion, ProductVersion, ProductName, FileDescription
```

## 故障排查优先级

1. Python 打包路径是否纯英文。
2. exe 名称是否以 `SYNTEC` 开头。
3. `CompanyName/Company` 与 `LegalCopyright/Copyright` 是否含 `SYNTEC`。
4. Python 语言代码是否 `000004B0` + `[0, 1200]`。
5. 是否存在 `ctypes` / `windll` / `ShowWindow`。
6. 是否已使用 `--noupx` 或 `upx=False`。
7. one-dir `_internal` 是否包含核心 DLL/PYD。

## 输出格式（发布检查清单）

当用户要求“生成/审查发布清单”时，使用以下结构输出：

````markdown
# SYNTEC 发布前检查清单

## 项目信息
- 类型：
- 入口：
- 输出 exe：
- 版本：
- 发布年份：

## 阻断项
- [ ] ...

## 打包命令
```powershell
...
```

## 验证命令
```powershell
...
```

## 人工验收
- [ ] 双击启动
- [ ] 常用 GUI/CLI 冒烟
- [ ] 目标域控环境试运行

## 风险和待确认
- ...
````
