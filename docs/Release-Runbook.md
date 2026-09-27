# 发布收口 Runbook

> 通用发布流程，对应 `docs/Rust-Wasm切换验收门禁.md` §「发布收口」第 1–6 步。
> 仅在 `npm.cmd run check:release:readiness -- --strict` 全 PASS（除 SKIP）后启动；任一 FAIL 不许发布。
> 具体版本号由 user 选定；agent 不擅自选定。
> 执行过程中如需回滚（restoring 旧标签和 VSIX），按 §「Rollback」操作。

## Release 路径选择（主备关系）

本 Runbook 对应两条发布路径，**CI 路径为主、本机脚本为域控离线 fallback**，产物 SHA 一致：

| 维度 | 主路径 (CI) | 备路径 (域控离线) |
| ------ | ------------- | ------------------- |
| 触发方式 | `git push origin vX.Y.Z` 触发 `.github/workflows/release.yml` + `workflow_dispatch` 手动调起 | 本机 PowerShell 跑 `npm.cmd run release:create -- vX.Y.Z` |
| Release 创建 | `softprops/action-gh-release@v2` | `scripts/createGitHubRelease.js` 走 `git credential fill` + `curl.exe` |
| 门禁 | `check:release --tag` + `check:release:readiness -- --strict` + `npm test` + `lint` + `test:integration` + `package` 全跑 | 发布前 user 本机先跑 `check:release:readiness -- --strict`，agent 不替 user 跑 `release:create` |
| VSIX 产物 | CI 上 `npm run package`（`package` 已前置 `check:rust:wasm:asset`） | 同一 `syntec-macro-X.Y.Z.vsix`（本地打包与 CI 打包字节一致因 wasm 资产 bundle 进仓） |
| 适用场景 | 远程 push tag 即可自动完成全链 | 域控 WDAC 环境 `gh` CLI 被拦截时用本地 `git credential fill + curl.exe` fallback |

选择规则：

- 能 push tag 且 GitHub Actions 可跑 → 用主路径 (release.yml)。
- 域控环境 `gh` 被拦截且无法走 Actions → 用备路径 (`npm.cmd run release:create -- vX.Y.Z`)。
- 两条路径都依赖 §0 前置门禁与 §1 版本号切换；任一 FAIL 不许发。

---

## 0. 前置门禁 + 全量验收（一条命令）

> 2026-09-26 起 `npm.cmd run release:verify` 把原 §0 readiness 门禁与 §2 全量验收命令串成一条硬链（任一失败即停）：

```powershell
Set-Location D:\FN\syntec-macro
npm.cmd run release:verify
```

链内依次执行（全部必须 PASS）：

1. `check:release:readiness -- --strict` — 7 项 readiness（期望 6 PASS + 1 SKIP + 0 FAIL）
2. `check:diagnostic-governance -- --strict` — 四件套治理 HARD+SOFT
3. `check:all`（= `npm test` 含 release 一致性/VSIX/数据/资产校验 + 29 个测试文件 + lint）
4. `typecheck:analysis`
5. `test:integration` + `test:integration:navigation` — 真 VS Code 端到端
6. `check:vsix` — VSIX 内容复核
7. `package` — 打 VSIX（内含 `check:rust:wasm:asset`）
8. `smoke:installed` — 安装级 smoke（真实 VS Code 装刚打的 VSIX 验证激活）

任一 FAIL：先回到 `docs/Rust-Wasm切换验收门禁.md` 对应小节修复，不允许「先发后补」。需要单跑某一步时仍可单独执行对应 `npm run` 命令。

---

## 1. 切换版本号到选定的 X.Y.Z

> 这一动作必须由 user 决定具体版本号；agent 不得擅自选定。

执行步骤：

1. 决定目标版本号（例如 `4.3.1`）：bug 修复/小改进发 patch，新功能发 minor，破坏性变更（配置/行为不兼容）才发 major。
2. 修改 `package.json` `version` 字段。
3. 修改 `package-lock.json` 的 `version` 与 `packages[""].version`。
4. 修改 `README.md` 中 `version-X.Y.Z-blue` 徽章。
5. 在 `CHANGELOG.md` 中把 `## [Unreleased]` 段落改为 `## X.Y.Z - YYYY-MM-DD`（用当日日期），并在上方再开一个新的 `## [Unreleased]` 空段落，保持后续 iteration 入口。
6. 同步更新 `docs/开发交接说明.md` 与 `docs/Rust-Wasm切换验收门禁.md`「### P1 §1 状态」转为「### 发布收口状态」。
7. 重新运行 release 一致性检查：

   ```powershell
   npm.cmd run check:release -- --tag vX.Y.Z
   ```

   PASS 才能继续第 2 步。

## 2. 全量验收命令

已并入 §0 的 `npm.cmd run release:verify`（2026-09-26 起单命令硬链）。本节保留步骤索引供单独复跑与 CI release.yml 对照；CI 路径（release.yml）内嵌同样的门禁序列，两路径验收口径一致。

## 3. VSIX 内容校验

`npm.cmd run check:vsix` 已是 `npm test` 一部分；发布前再次跑：

```powershell
npm.cmd run check:vsix
```

验收点（对照规划 §3 第 3 项）：

- ✅ 生产 src/代码、grammar、snippet、CHANGELOG、images/icon.png、language-configuration 全部进 VSIX；
- ✅ `assets/rust-wasm/manifest.json` + `syntec_core.wasm` **进 VSIX**（`.vscodeignore` 已包含 assets/，`check:vsix` 的 REQUIRED 文件清单强制要求这两个文件，缺了会 fail）；
- ❌ 不含 Rust target、debug artifact、测试 fixture、脚本探针或 session 文件；`check:vsix` 如果多出未知文件会列出来。

## 4. 提交 + 推送 + tag

```powershell
# 本机 staging 前先跑 dry-run 确认 diff 干净
git --no-pager diff --check
git --no-pager status --porcelain

# 提交发布 commit
git add -A
git commit -m "Release vX.Y.Z"
git push origin main

# 打 tag（与 package.json version 一致，check:release -- --tag vX.Y.Z 已验证）
git tag vX.Y.Z
git push origin vX.Y.Z
```

## 5. 发布 GitHub Release 并上传 VSIX

```powershell
# 域控环境用 REST API + git credential fill
npm.cmd run release:create -- vX.Y.Z
```

该脚本流程详见 `scripts/createGitHubRelease.js` 顶部注释：

1. 校验 tag 与 package.json version 一致
2. 从 CHANGELOG.md 解析对应版本段落作 body
3. `git credential fill` 取 github.com token
4. 用 curl.exe 在 `https://api.github.com/repos/SYNTEC-40101720/syntec-macro/releases` 中创建 release
5. 通过 `https://uploads.github.com/...` 上传 VSIX 资产
6. 上传 `latest.json` 升级清单（`npm run package` 时由 `scripts/reportVsixArtifact.js` 生成；插件激活后经 `releases/latest/download/latest.json` 发现新版本并提示用户下载，见 `src/updateCheck.js`）
7. 输出 release HTML URL 与 VSIX 下载 URL

## 6. 发布后核对

| 项目 | 核对方式 | 期望结果 |
| ------ | ---------- | ---------- |
| git tag `vX.Y.Z` 已推送 | `git ls-remote --tags origin vX.Y.Z` | 列出 `vX.Y.Z` |
| GitHub Release URL 可访问 | 在浏览器访问 release HTML URL | 可见 Release 页面与 CHANGELOG body |
| VSIX 资产已上传 | GitHub API `releases/tags/vX.Y.Z` 或浏览器 asset section | `syntec-macro-X.Y.Z.vsix` 与 `latest.json` 均已列出 |
| VSIX SHA-256 | 本地 vs `assets/rust-wasm/syntec_core.wasm` SHA-256（如进 VSIX） | GitHub UI 上 asset 的 sha 应与本机 `Get-FileHash` 一致 |
| 升级清单可达 | `curl.exe -sL https://github.com/SYNTEC-40101720/syntec-macro/releases/latest/download/latest.json` | 返回 JSON 且 `version` 为本次发布版本 |
| VSIX 安装版本 | `code --install-extension ./syntec-macro-X.Y.Z.vsix` 后看 Extensions panel 显示版本号 | 显示 X.Y.Z |
| 分析后端标识 | 安装后打开宏程序文件，看诊断/格式化工作 + `Syntec Macro Worker` 输出通道 | `rust-wasm` 唯一后端（v4.0.0 起无配置项；加载失败在输出通道可见原因） |

```powershell
# 一键 SHA-256 计算（如打 wasm asset 进 VSIX）
Get-FileHash -Algorithm SHA256 .\syntec-macro-X.Y.Z.vsix
Get-FileHash -Algorithm SHA256 .\assets\rust-wasm\syntec_core.wasm
```

## Rollback

如果发布后发现问题、需要回退到上一版本：

1. **git/Release 层**：`git push origin :vX.Y.Z && git tag -d vX.Y.Z`，Release 在 GitHub Web UI 删除。
2. **VSIX 层**：在已安装的 VS Code 中卸载 `syntec-macro@X.Y.Z`，重装上一版本 VSIX（GitHub Release 下载）。
3. **CHANGELOG 层**：保留该版本段落，但顶上加 `## [Unreleased]`，避免后续 iteration 重新输入条目。
4. **回滚门禁**：`workerLifecycle.test.js` 已 cover fallback path；如果发布后回滚由 production user 触发，必须先在仓库内 issue 记录原因，关联到 `docs/开发交接说明.md` 中。