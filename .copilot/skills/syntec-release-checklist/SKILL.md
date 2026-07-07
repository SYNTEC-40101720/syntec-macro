---
name: syntec-release-checklist
description: "Use when: 生成或审查新代/SYNTEC 域控环境发布前检查清单，覆盖 exe 命名、版本信息、打包参数与部署验收。"
argument-hint: "说明项目类型、入口项目/文件、exe 名称、输出目录和版本号"
---

# SYNTEC Release Checklist

## When to Use

Use this skill when you need a release readiness checklist for SYNTEC domain-controlled environments.

- Generate a pre-release checklist for Python or C#/.NET desktop apps.
- Review an existing package against SYNTEC blocking rules.
- Provide build, metadata verification, and smoke-test commands.

## Required Checks

1. Project type identified: Python, C#/.NET, Avalonia, WinForms, WPF, CLI, or GUI.
2. Final executable name starts with `SYNTEC`.
3. Version format uses four numeric parts, such as `1.0.0.0`.
4. Company and copyright metadata include `SYNTEC`, with release year.
5. For C#/.NET, `.csproj` metadata includes `Company`, `Copyright`, `Description`, `Product`, `FileVersion`, `Version`.
6. For Python, packaging uses `--noupx` or `upx=False`, includes a version resource, uses neutral language metadata (`000004B0` and `[0, 1200]`), and avoids `ctypes` Windows API calls.
7. For Python one-dir outputs, `_internal` contains core DLL/PYD files such as `python311.dll` and `_ctypes.pyd`.

## Output Template

Return the checklist using this Markdown structure:

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

## Behavior Rules

- Prefer rules from the `syntec-packaging` skill when both apply.
- If required fields are missing and cannot be inferred, ask the minimum set of clarifying questions.
- Do not alter protocol names, file format names, CLI flags, JSON field names, or API paths.
