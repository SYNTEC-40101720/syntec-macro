---
name: "SYNTEC Release Checklist"
description: "生成或审查新代/SYNTEC 域控环境发布前检查清单。优先复用 syntec-packaging 主技能规则。"
argument-hint: "说明项目类型、入口项目/文件、exe 名称、输出目录和版本号"
agent: "agent"
---

请基于 `syntec-packaging` 技能生成或审查当前项目的发布前检查清单。

要求：

- 以 `syntec-packaging` 的阻断规则为唯一权威来源。
- 优先给出可直接执行的打包与验证命令。
- 若关键信息缺失，先提出最少必要问题；能从工作区推断时直接生成。
- 不修改协议名、文件格式名、CLI 参数、JSON 字段或 API 路径。

输出结构：

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
