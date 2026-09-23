# 发布收口 Runbook

> 通用发布流程，对应 `docs/Rust-Wasm切换验收门禁.md` §「发布收口」第 1–6 步。
> 仅在 `npm.cmd run check:release:readiness -- --strict` 全 PASS（除 SKIP）后启动；任一 FAIL 不许发布。
> 具体版本号由 user 选定；agent 不擅自选定。
> 执行过程中如需回滚（restoring 旧标签和 VSIX），按 §「Rollback」操作。

> **历史示例（2026-09-20 v3.0.0）**: §0 readiness `6 PASS + 1 SKIP + 0 FAIL`；§1 版本号 `3.0.0`；§2 全量验收 `npm test 367/367`、`check:release --tag v3.0.0` 一致、`benchmark:compare` 三场景 parity=equal、`compare:rust 130+10+17`、`probe:rust:wasm` ok、`test:integration`+`test:integration:navigation` exit 0、`npm run package` 产 `syntec-macro-3.0.0.vsix` (246275 bytes, SHA-256 `97cb18c2...`)、`smoke:installed` 通过；§3 `check:vsix` 44 文件含 `assets/rust-wasm/{manifest.json, syntec_core.wasm}`；§4 commit `dea6439 Release v3.0.0` + tag `v3.0.0` 已 push；§5 `gh release upload v3.0.0 syntec-macro-3.0.0.vsix --clobber` 完成。Release URL: https://github.com/SYNTEC-40101720/syntec-macro/releases/tag/v3.0.0

## Release 路径选择（主备关系）

本 Runbook 对应两条发布路径，**CI 路径为主、本机脚本为域控离线 fallback**，产物 SHA 一致：

| 维度 | 主路径 (CI) | 备路径 (域控离线) |
|------|-------------|-------------------|
| 触发方式 | `git push origin v3.x.x` 触发 `.github/workflows/release.yml` + `workflow_dispatch` 手动调起 | 本机 PowerShell 跑 `npm.cmd run release:create -- v3.x.x` |
| Release 创建 | `softprops/action-gh-release@v2` | `scripts/createGitHubRelease.js` 走 `git credential fill` + `curl.exe` |
| 门禁 | `check:release --tag` + `check:release:readiness -- --strict` + `npm test` + `lint` + `test:integration` + `package` 全跑 | 发布前 user 本机先跑 `check:release:readiness -- --strict`，agent 不替 user 跑 `release:create` |
| VSIX 产物 | CI 上 `npm run package`（v3.0.0 起 `package` 已前置 `check:rust:wasm:asset`） | 同一 `syntec-macro-3.x.x.vsix`（本地打包与 CI 打包字节一致因 wasm 资产 bundle 进仓） |
| 适用场景 | 远程 push tag 即可自动完成全链 | 域控 WDAC 环境 `gh` CLI 被拦截时用本地 `git credential fill + curl.exe` fallback |

选择规则：
- 能 push tag 且 GitHub Actions 可跑 → 用主路径 (release.yml)。
- 域控环境 `gh` 被拦截且无法走 Actions → 用备路径 (`npm.cmd run release:create -- v3.x.x`)。
- 两条路径都依赖 §0 前置门禁与 §1 版本号切换；任一 FAIL 不许发。

---

## 0. 前置门禁（必跑，由 user 执行）

```powershell
# 自动验 7 项 readiness：
Set-Location D:\FN\syntec-macro
npm.cmd run check:release:readiness -- --strict
# 期望：6 PASS + 1 SKIP + 0 FAIL；任一 FAIL 不许继续发布。
```

如果任一项 FAIL：先回到 `docs/Rust-Wasm切换验收门禁.md` 对应小节修复，不允许「先发后补」。

---

## 1. 切换版本号到选定的 3.x.x

> 这一动作必须由 user 决定具体版本号（如 `3.0.0`）；agent 不得擅自选定。

执行步骤：

1. 决定目标版本号（例如 `3.0.0`），并确认是否需要做 Major vs Minor 升级：
   - Major (3.0.0)：默认 backend 从 `javascript` 切换到 `rust-wasm`，向后不兼容。
   - Minor (3.x.0)：仅新增 Rust/Wasm 选项与 parity、shadow 模式、CI 矩阵；默认仍是 `javascript`。
2. 修改 `package.json` `version` 字段。
3. 修改 `package-lock.json` 的 `version` 与 `packages[""].version`。
4. 修改 `README.md` 中 `version-2.15.0-blue` 徽章。
5. 在 `CHANGELOG.md` 中把 `## [Unreleased]` 段落改为 `## 3.0.0 - YYYY-MM-DD`（用当日日期），并在上方再开一个新的 `## [Unreleased]` 空段落，保持后续 iteration 入口。
6. 同步更新 `docs/开发交接说明.md`、`docs/macro-knowledge/MACRO知识与验证规划.md` 与 `docs/Rust-Wasm切换验收门禁.md`「### P1 §1 状态」转为「### 发布收口状态」。
7. 重新运行 release 一致性检查：
   ```powershell
   npm.cmd run check:release -- --tag v3.0.0
   ```
   PASS 才能继续第 2 步。

## 2. 全量验收命令

按规划 §「3.x 发布收口」第 2 项硬执行（任一失败立即 abort）：

```powershell
Set-Location D:\FN\syntec-macro
npm.cmd test
npm.cmd run lint
npm.cmd run test:integration
npm.cmd run test:integration:navigation
npm.cmd run package
npm.cmd run smoke:installed
```

- 任一失败：不提交、不打 tag、不发布；按日志修复后再跑全套。
- `test:integration` 与 `test:integration:navigation` 需要 `xvfb-run`，本机 Windows 可直接跑；CI Linux 上用 `xvfb-run -a` 包裹。

## 3. VSIX 内容校验

`npm.cmd run check:vsix` 已是 `npm test` 一部分；发布前再次跑：

```powershell
npm.cmd run check:vsix
```

验收点（对照规划 §3 第 3 项）：
- ✅ 生产 src/代码、grammar、snippet、CHANGELOG、images/icon.png、language-configuration 全部进 VSIX；
- ✅ 是否包含 `assets/rust-wasm/manifest.json` + `syntec_core.wasm` 由 user 决定：

  | 选项 | `.vscodeignore` 改动 | source 组件 |
  |------|----------------------|-------------|
  | 进 VSIX（推荐 3.0） | 移除 `assets/` 行，`scripts/buildRustWasmAsset.js` 自动包括 manifest+wasm | `rustWasmAsset.js` 已在 `src/` |
  | 不进 VSIX（保守 2.x → 3.x 分两次） | 保持 `assets/` 排除 | 用户首次启动时按 manifest 拉 wasm asset（当前尚未实现） |

  当前默认：`.vscodeignore` 排除 `assets/`，wasm 不进 VSIX；如果 3.0 决定进 VSIX，请把 `.vscodeignore` 中 `assets/` 行删除，并把 `src/rustWasmWorkerAdapter.js` 的 fallback 路径默认指向 bundled `assets/rust-wasm/manifest.json`。
- ❌ 不含 Rust target、debug artifact、测试 fixture、脚本探针或 session 文件；`check:vsix` 如果多出未知文件会列出来。

## 4. 提交 + 推送 + tag

```powershell
# 本机 staging 前先跑 dry-run 确认 diff 干净
git --no-pager diff --check
git --no-pager status --porcelain

# 提交发布 commit
git add -A
git commit -m "Release v3.0.0"
git push origin main

# 打 tag（与 package.json version 一致，check:release -- --tag v3.0.0 已验证）
git tag v3.0.0
git push origin v3.0.0
```

## 5. 发布 GitHub Release 并上传 VSIX

```powershell
# 域控环境用 REST API + git credential fill
npm.cmd run release:create -- v3.0.0
```

该脚本流程详见 `scripts/createGitHubRelease.js` 顶部注释：
1. 校验 tag 与 package.json version 一致
2. 从 CHANGELOG.md 解析 v3.0.0 段落作 body
3. `git credential fill` 取 github.com token
4. 用 curl.exe 在 `https://api.github.com/repos/SYNTEC-40101720/syntec-macro/releases` 中创建 release
5. 通过 `https://uploads.github.com/...` 上传 VSIX 资产
6. 输出 release HTML URL 与 VSIX 下载 URL

## 6. 发布后核对（对照规划 §「3.x 发布收口」第 6 项）

| 项目 | 核对方式 | 期望结果 |
|------|----------|----------|
| git tag `v3.0.0` 已推送 | `git ls-remote --tags origin v3.0.0` | 列出 `v3.0.0` |
| GitHub Release URL 可访问 | 在浏览器访问 release HTML URL | 可见 Release 页面与 CHANGELOG body |
| VSIX 资产已上传 | `gh release view v3.0.0 --repo ...`（如可用）或浏览器 asset section | `syntec-macro-3.0.0.vsix` 已列出 |
| VSIX SHA-256 | 本地 vs `assets/rust-wasm/syntec_core.wasm` SHA-256（如进 VSIX） | GitHub UI 上 asset 的 sha 应与本机 `Get-FileHash` 一致 |
| VSIX 安装版本 | `code --install-extension ./syntec-macro-3.0.0.vsix` 后看 Extensions panel 显示版本号 | 显示 3.0.0 |
| 默认 backend 标识 | VSIX 安装后 VS Code settings 里 `syntecMacro.analysisBackend` | 3.0: `rust-wasm` （如 Major 切换） / 3.0: `javascript` （如 Minor 不切换，仅提供开关） |

```powershell
# 一键 SHA-256 计算（如打 wasm asset 进 VSIX）
Get-FileHash -Algorithm SHA256 .\syntec-macro-3.0.0.vsix
Get-FileHash -Algorithm SHA256 .\assets\rust-wasm\syntec_core.wasm
```

## Rollback

如果发布后发现问题、需要回退到 2.15.0：

1. **git/Release 层**：`gh release delete v3.0.0 --yes --repo ...; git push origin :v3.0.0; git tag -d v3.0.0`（如可用） / GitHub Web UI 删除 Release 与 tag。
2. **VSIX 层**：在已安装的 VS Code 中卸载 `syntec-macro@3.0.0`，重装 `syntec-macro@2.15.0`，本机仓库 `git checkout v2.15.0 -- package.json package-lock.json README.md` 即可。
3. **CHANGELOG 层**：保留 `## 3.0.0` 段落，但顶上加 `## [Unreleased]`，避免后续 iteration 重新输入条目。
4. **回滚门禁**：`workerLifecycle.test.js` 已 cover fallback path；如果发布后回滚由 production user 触发，必须先在仓库内 issue 记录原因，关联到 `docs/开发交接说明.md` 中。

---

## 当前 readiness 自检结果（2026-09-20 3.0.0 切换后）

PASS=6, SKIP=1, FAIL=0
（Skip 项是第 7 项 tag/Release/VSIX 校验，由本 runbook §5 实际执行后由 release workflow 与 user 对账。）

## 3.0.0 实测产物摘要（2026-09-20）

- VSIX：`syntec-macro-3.0.0.vsix` — 46 文件、246275 bytes、SHA-256 `97cb18c2858369fbde2c72a01478fc7f78e9fb5a224e9236b1912a3f3fc68618`。
- 默认 backend：仍为 `javascript`，遵守规划文档 §3「没有稳定收益或出现回归时保持 JavaScript 默认后端」。`syntecMacro.analysisBackend` 可选切换到 `rust-wasm-shadow`（影子差分）或 `rust-wasm`（主用 Rust 失败回退 JS）。
- 资产 bundle 状态：`assets/rust-wasm/{manifest.json, syntec_core.wasm}` 已 through `check:vsix` 进入 VSIX（44 文件中已包含），`src/rustWasmAsset.js` 加载器从 bundled manifest 读取资产。
- Rust 诊断 parity：`compare:rust` 130 diagnostics + 10 nav + 17 edits 等价（与 JS 全 parity）。
- Wasm ABI：`probe:rust:wasm` 通过 ABI 校验，`syntec_core_analyze_request_json` + `syntec_core_analyze_json` + `syntec_core_protocol_version` + `syntec_core_alloc`/`syntec_core_dealloc`/`syntec_core_free_output` + `format_document` 全部可用。
- Worker 集成 fallback：`workerLifecycle.test.js` 9 项覆盖启动/重启/并发/取消/版本竞态/缓存淘汰/资产缺失优雅回退/未知 backend 守护回退 javascript 7 类边界。
