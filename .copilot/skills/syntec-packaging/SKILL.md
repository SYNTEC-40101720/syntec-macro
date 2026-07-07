---
name: syntec-packaging
description: "Use when: 新代/SYNTEC 域控环境部署、打包 exe、发布 C#/.NET 或 Python 程序、配置版本信息、排查 exe 无法打开、验证 CompanyName/LegalCopyright/SYNTEC 命名、PyInstaller --noupx/windowed、dotnet publish self-contained。"
argument-hint: "说明应用类型、入口项目/文件、目标名称和输出目录"
---

# SYNTEC Packaging

## When to Use

Use this skill for SYNTEC domain-controlled Windows environments when the user needs to:

- Package a Python application with PyInstaller.
- Publish a C#/.NET desktop application as an exe.
- Configure executable version metadata so domain policy allows execution.
- Rename or validate release artifacts that must start with `SYNTEC`.
- Diagnose packaged exe startup failures in the SYNTEC environment.
- Create a release checklist or packaging command for deployment.

## Core Rules

Treat these as blocking requirements unless the user explicitly says the target is not a SYNTEC domain-controlled environment.

1. The final executable file name must start with `SYNTEC` exactly, such as `SYNTEC-OpenPoll.exe` or `SYNTEC_OpenPoll.exe`.
2. Version metadata must include `SYNTEC` in company and copyright fields.
3. Copyright metadata must use the release year, such as `Copyright © SYNTEC 2026`.
4. Version numbers must use four numeric parts, such as `1.0.0.0`.
5. Python packages must disable UPX compression and avoid `ctypes` Windows API calls.
6. Python PyInstaller version resources must use neutral language metadata: `StringTable` `000004B0` and `Translation` `[0, 1200]`.
7. Python packaging must run from a pure English path without spaces, Chinese characters, or special characters.

## Information to Gather

Before editing or running packaging commands, identify:

- Application type: Python, C#/.NET, Avalonia, WinForms, WPF, console, or GUI.
- Entry point: `.py`, `.csproj`, `.sln`, or specific project folder.
- Target executable name, ensuring it starts with `SYNTEC`.
- Version number, defaulting to `1.0.0.0` if the user has no preference.
- Release year for copyright metadata, defaulting to the current year.
- Output directory and runtime target, usually `win-x64` for Windows deployment.
- Whether the app should show a console window.

If any blocking detail is missing and cannot be inferred from the project, ask a concise clarifying question.

## Workflow

### 1. Classify the Packaging Path

Choose the smallest valid path:

- Python GUI app: PyInstaller `--onedir --windowed --noupx --clean` with a version file.
- Python console app: PyInstaller `--onedir --noupx --clean` with a version file.
- C#/.NET app: project metadata in `.csproj`, then `dotnet publish` for `win-x64`.
- Existing published output: validate and rename only if metadata is already correct.

Do not apply Python-only requirements to C# builds except the SYNTEC file name and metadata intent.

### 2. Prepare Metadata

For C#/.NET, ensure the project file contains equivalent metadata. Replace `YYYY` with the release year:

```xml
<Company>SYNTEC</Company>
<Copyright>Copyright © SYNTEC YYYY</Copyright>
<Description>SYNTEC-应用程序</Description>
<Product>SYNTEC-产品</Product>
<FileVersion>1.0.0.0</FileVersion>
<Version>1.0.0.0</Version>
```

Use application-specific values for `Description` and `Product`, but keep `SYNTEC` present.

For Python, create or update `version_info.txt` with neutral language metadata. Replace `YYYY` with the release year:

```python
VSVersionInfo(
  ffi=FixedFileInfo(
    filevers=(1, 0, 0, 0),
    prodvers=(1, 0, 0, 0),
    mask=0x3f,
    flags=0x0,
    OS=0x4,
    fileType=0x1,
    subtype=0x0,
    date=(0, 0)
    ),
  kids=[
    StringFileInfo(
      [
      StringTable(
        u'000004B0',
        [StringStruct(u'CompanyName', u'SYNTEC'),
        StringStruct(u'FileDescription', u'SYNTEC-应用程序'),
        StringStruct(u'FileVersion', u'1.0.0.0'),
        StringStruct(u'ProductName', u'SYNTEC-产品'),
        StringStruct(u'ProductVersion', u'1.0.0.0'),
        StringStruct(u'LegalCopyright', u'Copyright © SYNTEC YYYY')])
      ]),
    VarFileInfo([VarStruct(u'Translation', [0, 1200])])
  ]
)
```

### 3. Package

For Python, use:

```powershell
py -m PyInstaller --onedir --windowed --version-file version_info.txt --name "SYNTEC-应用名" --noupx --clean app.py
```

For a Python console app, remove `--windowed` only when a console is required.

For C#/.NET, use:

```powershell
dotnet publish -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -p:EnableCompressionInSingleFile=true -o "输出目录"
```

If the output exe does not start with `SYNTEC`, rename the final artifact. Prefer configuring the project assembly name when practical so the published name is correct by default.

### 4. Validate

Always include a validation step before declaring the package ready.

For C#/.NET:

```powershell
$exe = ".\输出目录\SYNTEC-应用名.exe"
(Get-Item $exe).VersionInfo | Format-List CompanyName, LegalCopyright, FileVersion, ProductVersion, ProductName, FileDescription
```

For Python one-dir output:

```powershell
$exe = ".\dist\SYNTEC-应用名\SYNTEC-应用名.exe"
(Get-Item $exe).VersionInfo | Format-List CompanyName, LegalCopyright, FileVersion, ProductVersion, ProductName, FileDescription, Language
Test-Path ".\dist\SYNTEC-应用名\_internal\python311.dll"
Test-Path ".\dist\SYNTEC-应用名\_internal\_ctypes.pyd"
```

Validation passes only when:

- The executable exists and starts with `SYNTEC`.
- Company and copyright metadata contain `SYNTEC`.
- Version fields use four numeric components.
- Python `_internal` dependencies exist for one-dir builds.
- The app launches locally, or the user confirms a local launch test when GUI launch cannot be automated.

### 5. Diagnose Failures

Use this order for SYNTEC domain failures:

1. Check whether the packaging path contains non-English characters, spaces, or special characters for Python builds.
2. Check whether the exe file name starts with `SYNTEC`.
3. Check `CompanyName`/`Company` and `LegalCopyright`/`Copyright` for `SYNTEC`.
4. For Python, check neutral language metadata: `000004B0` and `[0, 1200]`.
5. For Python, search for `ctypes`, `windll`, `ShowWindow`, or direct Windows API calls.
6. Confirm PyInstaller used `--noupx` or the spec file has `upx=False`.
7. Confirm Python one-dir `_internal` includes core DLL/PYD files.
8. Consider antivirus, code-signing, or domain whitelist only after the above checks pass.

## Quality Bar

A good answer or edit from this skill should produce one of these outcomes:

- A ready-to-run packaging command with SYNTEC-compliant naming and metadata.
- A corrected project/version metadata file.
- A release checklist tailored to the project type.
- A focused diagnosis explaining which SYNTEC requirement failed and how to fix it.

When modifying files, keep changes narrow: metadata, packaging scripts, version resources, or documentation directly related to SYNTEC deployment.
