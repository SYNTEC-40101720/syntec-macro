# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

_Nothing yet._

## 3.0.0 - 2026-09-20

### Changed

- **版本号 Major 升级 2.15.0 → 3.0.0**: `package.json` / `package-lock.json`（顶层与 `packages[""]`） / `README.md` 徽章统一切到 `3.0.0`；`package.json` `syntecMacro.analysisBackend` enumDescriptions 改为「JavaScript analyzer（默认，v2.15.0 起生产后端；3.0.0 起与 Rust/Wasm 并存）」对齐当前实际状态。**默认 backend 保持 `javascript` 不变**：实测 large-20k JS p50 422ms vs Rust 457ms，仍存微弱回归；遵守规划文档 §3「没有稳定收益或出现回归时保持 JavaScript 默认后端，不强行切换」；用户可手动切到 `rust-wasm-shadow`（影子差分）或 `rust-wasm`（主用 Rust 失败回退 JS）。

### Added

- **生产 Wasm 资产 bundle 进 VSIX**: 把 `.vscodeignore` 中 `assets/` 排除行改为 `!assets/`，把 `assets/rust-wasm/{manifest.json, syntec_core.wasm}`（约 312KB、SHA-256 `7b69e5dc...`）作为 P0-C 第 1 项「固定版本/target 的 wasm 资产」正式纳入 VSIX 分发；`scripts/checkVsixContents.js` `REQUIRED_STATIC_FILES` 增加两个必填项，`check:vsix` 由 42 文件升到 44 文件，确保生产 wasm 资产与 `src/rustWasmAsset.js` 加载器一起入 VSIX；按规划文档 §3「不得把开发态 Wasm 复制进 VSIX」要求，本批 bundle 进 VSIX 的是经 `scripts/buildRustWasmAsset.js` 写入 manifest + SHA-256 + 必需 exports 子集断言的**生产资产**（非 `target/wasm32-unknown-unknown/release/*.wasm`），不带 Rust target/debug artifact/测试 fixture/脚本探针。`npm run package` 产出 `syntec-macro-3.0.0.vsix`（46 files, 246275 bytes, SHA-256 `97cb18c2858369fbde2c72a01478fc7f78e9fb5a224e9236b1912a3f3fc68618`），`npm run smoke:installed` 验证激活 `syntec-team.syntec-macro@3.0.0` exit code 0。

- **3.x 收口状态全局文档同步**: 把 `docs/开发交接说明.md`「3.x 架构发布计划阶段性状态」段延续到 P1 第 1/2/3 项 + §5 readiness + 3.x Release Runbook 全部合上，并把「下一步建议」段从 v2.14.0 旧 baseline 更新为「所有 Rust/Wasm 3.x 切换的代码/CI/工具链/Readiness 门禁均已 ready；具体 3.x.x 版本号由 user 决定 Major vs Minor 后按 `docs/3.x-Release-Runbook.md` §1–§6 执行；agent 不擅自启动 release workflow」；同步把 `docs/macro-knowledge/MACRO知识与验证规划.md` §8「迭代记录」表续写 P1 第 1/2/3 项 + §5 readiness + 3.x Runbook 5 行节点记录。本批是文档同步收口节点，不动版本号、不动 ready 状态、不修改 release toolchain；`npm test` 367/367、lint 0、`check:release:readiness -- --strict` 6 PASS + 1 SKIP + 0 FAIL 仍 green。下一步等 user 选定 3.x.x 版本号后由 user 启动 Runbook。

- **3.x 发布收口 Runbook**: 新增 `docs/3.x-Release-Runbook.md`，把 `docs/3.x-Rust-Wasm切换剩余任务规划.md` §「3.x 发布收口」第 1–6 步预演为可执行 step-by-step 流程：§0 前置门禁（`npm.cmd run check:release:readiness -- --strict` 6 PASS+1 SKIP+0 FAIL） → §1 版本号切换步骤（user 决定 3.0.0 Major 切换默认 backend 还是 3.x.0 Minor 仅提供开关，未由 agent 擅自选定） → §2 全量验收命令（`npm test`/`npm run lint`/`npm run test:integration`/`npm run test:integration:navigation`/`npm run package`/`npm run smoke:installed`） → §3 VSIX 内容校验对照表（包含 wasm asset 是否进 VSIX 的二选一决策表） → §4 git tag 提交 / 推送流程 → §5 `npm.cmd run release:create -- v3.0.0` GitHub Release + VSIX 上传 → §6 发布后 git tag/Release/VSIX URL/SHA-256/默认 backend 核对表。新增 §「Rollback」一节：git tag/Release/VSIX 卸载重装 2.15.0 工作流，配套 `workerLifecycle.test.js` 已 cover fallback path。`README.md` 末尾新增「3.x Rust/Wasm 后端路径」一节：说明 2.15.0 默认 javascript backend、3.x 可选 `rust-wasm-shadow`/`rust-wasm` 开关、3.x.x 版本切换完全由 user 决定，引用 runbook 与规划文档。本节点不升级版本号、不动 package.json/README 的 2.15.0 徽章、不修改 `assets/` 进 VSIX 状态——严格遵守 §3「不得在 Rust parity/Request/TextEdit/跨平台构建/回滚门禁 完成前升级 3.x 版本号」与「不得把开发态 Wasm 复制进 VSIX 作为先切换再补齐」。当前 readiness 门禁 6 PASS+1 SKIP+0 FAIL，由 user 决定具体 3.x.x 版本号再启动本 runbook。

- **Wasm P1 §5 发布前 readiness 自检工具**: 新增 `scripts/checkReleaseReadiness.js` 与 npm 脚本 `check:release:readiness`：对照 `docs/3.x-Rust-Wasm切换剩余任务规划.md` §5「完成定义」7 项门禁一次性自动 review：(1) Rust/Wasm 完整 `AnalysisResult` parity — `compareRustCore.js` 至少 130 CASES； (2) 稳定诊断 + navigation + format parity — `Rust诊断parity清单.md` 含 67/67 标志； (3) 生产 Wasm 资产 + 加载器 + Worker + fallback — manifest/wasm/`rustWasmAsset.js`/`rustWasmWorkerAdapter.js`/`workerLifecycle.test.js` 全部存在； (4) 跨平台 CI 矩阵 — `rust-wasm.yml` 同时含 `matrix:`/`ubuntu-latest`/`windows-latest`/`cross-platform-alert`； (5) 性能/内存/启动/fallback 数据采集 — `benchmarkCompare.js`/`comparePerfData.js`/`benchmarkCompare.test.js` 全部落地； (6) VSIX + 集成 + 回滚 — `checkVsixContents.js`/`workerLifecycle.test.js`/`integration/runTest.js` 存在； (7) GitHub tag/Release/VSIX 校验值一致 — `createGitHubRelease.js`/`checkReleaseConsistency.js` 工具就位 (tag 选定后由 release 流程跑，readiness 阶段标 SKIP)。每个 check 运行返回 `PASS`/`SKIP`/`FAIL` 与详情字符串；任一 check 抛错自动转 `FAIL` 不阻塞 stream；`main()` 默认 `exitCode=0`（非门禁）；`--strict` flag 在任一 `FAIL` 出现时置 `exitCode=1`。`.github/workflows/release.yml` 在 `Verify release metadata` 之后新增 `3.x release-readiness gate (--strict)` 步骤把 §5 7 项作为发布前硬门禁。新增 `tests/checkReleaseReadiness.test.js` 8 项测试：`CHECKS` 数组 7 项 id 完整性、id/name/run() 唯一性、`run()` 返回结构契约、`main()` 无参不置 exitCode、`main --strict` 在 stubbed FAIL 置 1、非 strict 容错 FAIL、`run()` 抛错转 FAIL、strict 抛错仍计 FAIL 置 1。`npm test` 测试集合扩展到 367 项（359 + 8）；`npm.cmd run check:release:readiness -- --strict` 本机实测：6 PASS + 1 SKIP + 0 FAIL。本节点合上 §5「完成定义」7 项 readiness 自动化复核基础设施；下一步进入真正的「3.x.x 选定 + tag/Release/VSIX 发」流程 (遵守 §3「稳定诊断 parity/Request/TextEdit/跨平台构建/回滚门禁完成前不升级 3.x 版本号」约束 — 当前所有 readiness 门禁 PASS)。

- **Wasm P1 第 3 项 CI 真实性能数据采集 + 跨平台告警**: `.github/workflows/rust-wasm.yml` 把 `build-and-verify` job 由 `runs-on: ubuntu-latest` 升级为矩阵 `os: [ubuntu-latest, windows-latest]`（开发机 Windows + CI 主力 Ubuntu），`fail-fast: false` 单平台失败不阻塞另一平台。每个平台跑完 smoke 后新增 `Capture P1 perf data as GitHub artifact` 步骤：直接调 `node scripts/benchmarkCompare.js --iterations 5 --no-threshold --json` 把 stdout 写入 `perf-data/benchmark-<os>.json` 避免 npm banner 行污染，用 `actions/upload-artifact@v4` 上传为 `p1-perf-<os>` 名 30 天保留。新增 `cross-platform-alert` job，`needs: build-and-verify` `if: always()` 后 checkout + npm ci + `actions/download-artifact@v4` 取下两平台 perf-data 后 flatten 到 `perf-data/` 再用 `find ... -name 'benchmark-*.json'` 拿列表参数传 `node scripts/comparePerfData.js` 做跨平台对比报告；单平台失败只 `::warning::` 不阻塞发布。新增 `scripts/comparePerfData.js`：解析任意数量 perf-data JSON 文件，按场景 × metric × platform 汇总 fixture/large-20k/nav batch JS/Rust p50/p95/startup/batch 指标到 stdout，`flagAnomalies` 检测 parity mismatch / fallback total / regressions count ≥1 的平台；`formatRow` 健壮除 undefined scenario/metric；只打 stdout 不抛错（CI alert step 只记 notice，不门禁）。新增 `npm.cmd run compare:perf` 脚本与 `tests/comparePerfData.test.js` 14 项测试：`loadPerfFile` 三类错误路径（missing/empty/non-JSON/missing-results）+ 成功路径、`flagAnomalies` 覆盖 results parity mismatch / nav parity mismatch / fallback / regressions、`formatRow` undefined 健壮性、`main` 无参 + 单文件 + 多平台 anomaly 路径均不抛错。`npm test` 测试集合扩展到 359 项（345 + 14）；本机实测 `node scripts/benchmarkCompare.js --iterations 3 --no-threshold --json | node scripts/comparePerfData.js` 输出「no parity / fallback / regression anomalies detected」。本节点合上 P1 第 3 项「CI 真实性能数据采集（不同平台 runner）+ 跨平台告警」基础设施；下一步进入「3.x 发布收口」。

- **Wasm P1 第 2 项 正式性能数据采集 + 阈值门禁**: 在 `scripts/benchmarkCompare.js` 中扩展三场景的 P1 §「启动时间 / p50 p95 分析延迟 / JSON 内存占用 / 首次与重复查询 / fallback 比例」全套指标：新增 `computeResultJsonBytes(result)` 用 `Buffer.byteLength(JSON.stringify(result), 'utf8')` 采集 JS/Rust 各 scenario 与 nav batch 代表性 JSON 字节大小（修正中文/emoji 多字节场景的内存占用统计，避免用 `string.length` 当字节大小）；`runScenarios` 改用 try/catch 包裹 JS 与 Rust 测量路径，把任何运行时异常计入 `fallbackCount`，并把 `resultBytes`、错误路径 `{ firstMs/p50/p95/maxMs=0, lastResult:null }` fallback 状态推入每场景结果对象；500 文件 nav batch 同样收 try/catch `rustFallbackCount`，输出 `jsResultBytes/rustResultBytes/rustFallbackCount` 字段。新增 `REGRESSION_THRESHOLDS` 阈值表（按 scenario 锚定 JS/Rust 各自 p50/p95/batch/startup 上限），`main` 流程在测量后对每个场景与 nav batch 比对阈值；任何场景超过上限即加入 `regressions` 数组并 `process.exitCode = 1`，作为 P1 §「没有稳定收益或出现回归时，保持 JavaScript 默认后端，不强行切换」的正式回归保护门禁；`--no-threshold` 关闭阈值检查（CI smoke 路径留宽松开关，因 Linux runner 与 Windows dev machine 速度基线不同）。新增 fallback 比例输出：`fallback: <total>/<runs> (ratio <%)` 走 scenario × 2 + 500 files 总和。`.github/workflows/rust-wasm.yml` 的 CI smoke 步骤切到 `--no-threshold`（CI 不做硬阈值门禁，只验证 parity 与运行无错）。新增 `tests/benchmarkCompare.test.js` 4 项测试（共 15 项）：`REGRESSION_THRESHOLDS` 覆盖三个场景且有限数字契约、`computeResultJsonBytes` UTF-8 字节与中文多字节场景、`runScenarios` 在正常路径下 `fallbackCount=0`、`stableFingerprint` 空形状确定性。`npm test` 测试集合扩展到 345 项（330 + 15）；`npm.cmd run benchmark:compare -- --iterations 5` 本机实测：fixture JS p50 13.10ms / Rust 14.06ms / JSON 11528 vs 21906 bytes；large-20k JS p50 422.29ms / Rust 457.46ms / JSON 375425 vs 717838 bytes；nav-500-files JS batch 645.85ms / Rust 602.68ms / JSON 2119 vs 2118 bytes；startup JS 0.002ms / Rust 8.10ms / artifact 311963 bytes；fallback 0/504 runs（0%）；parity 全 `equal`。下一步进入 P1 第 3 项「CI 真实性能数据采集（与开发机不同平台）+ 平台矩阵告警」与 3.x 发布收口。

- **Wasm P1 第 1 项 JS/Rust/Wasm 三方对照基准**: 新增 `scripts/benchmarkCompare.js` 与 npm 脚本 `benchmark:compare`。脚本在 P1 三类场景下同步测量 JS (`analyzeDocument` + `analyzeNavigationDocument` 等价合并路径) 与 Rust/Wasm (`createRustWasmAdapter` 真实 request ABI) 的启动延迟、首次运行、p50/p95/max 分析延迟、批量 navigation 耗时与 parity 校验：(1) 真实 fixture（394 行测试 fixture）— 记录首次/p50/p95/max 与 parity； (2) 20,000 行档案 — 同上； (3) 500 文件 × 40 行 navigation 批量 — 记录单 batch 累计耗时与 parity 抽样全检。脚本通过 `stableFingerprint` 形状比对器把 JS 与 Rust `AnalysisResult` 折算为 `{diagnostics,symbols,hasNavigation}` 等价比对形态，剥离 `backend`/bytes 非不变量；任何场景 parity mismatch 即 `process.exitCode = 1`——这是 P1 "没有稳定收益或出现回归时，保持 JavaScript 默认后端，不强行切换" 的硬门禁。新增辅助函数 `runJavaScriptEquivalent(request, filePath)`：把 JS analyze-only 与 navigation-only 路径合到与 Rust `analyze_request` 输出形状一致的桥接函数（macro 文件产出 navigation+symbols、非 macro 文件产出 `navigation: null` 与 `symbols: []`），确保 JS 与 Rust 走同一 fingerprint 形态。新增 `tests/benchmarkCompare.test.js`（11 项测试）：`stableFingerprint` 形状契约、parity 等价/mismatch 检测、`buildNavigationFixture` 500 文件确定性 + macro header 断言、`measure` warm-up 阶段 + p50/p95/max 单调契约、`runJavaScriptEquivalent` macro/非 macro 分支、`createLargeMacroText` 20000 行 + IF 块标记、`runScenarios` parity 通过后 `process.exitCode` 保持 0、JS vs Rust 在 macro 片段上的 fingerprint 实测等价。`npm test` 测试集合扩展到 341 项（330 + 11）。`.github/workflows/rust-wasm.yml` 新增 `P1 JS/Rust/Wasm parity + perf comparison (smoke, 3 iterations)` 步骤挂在 `benchmark:rust:wasm` 之后作为 CI 性能/parity 门禁。本节点合上 P1 第 1 项 P1 §「真实 fixture / 20,000 行档案 / 500 文件 navigation 必须记录 JS/Rust/Wasm 的启动时间、p50/p95 延迟、JSON/内存占用与 fallback 比例」的对照基准基础设施，`npm.cmd run benchmark:compare -- --iterations 5` 在 fixture/large-20k/nav-500-files 三场景现场报告全部 `parity=equal`；下一步进入 P1 第 2 项「正式性能数据采集 + 阈值门禁」与 3.x 发布收口。

- **Wasm P0-C 第 3 项 Worker 生命周期与 fallback 集成测试**: 新增 `tests/workerLifecycle.test.js`（9 项真实 `worker_threads` 集成测试），通过 `new Worker(require.resolve('../src/validatorWorker.js'), {workerData})` 起真实 worker，覆盖 P0-C 第 3 项「启动/重启/并发/取消/版本竞态/缓存淘汰/资产加载失败 fallback/未知 backend 回退」7 类边界：(1) 启动 javascript backend 正常返回带 `backend:'javascript'` 标记的 AnalysisResult；(2) `worker.terminate()` 后再起新 Worker 仍能分析（模拟配置切换/重启场景）；(3) 同时发 8 条并发请求，全部按唯一 id resolve、`pendingSize()` 归零；(4) terminate 时 pending 请求被 `resolve(null)`，无永挂 Promise；(5) 同 URI 不同 version+text 走独立缓存槽不互相覆盖，`MAX_ENTRIES=8` 超出后最旧条目被淘汰；(6) `rust-wasm-shadow`/`rust-wasm` backend 资产路径不存在时优雅回退 JS，`backend` 标记不为 `rust-wasm`（绝不静默成功），并通过 `parentPort` control 消息 `{kind:'log'}` 上报 fallback 原因给 host 的 `setShadowLogSink`；shadow 模式 Rust 运行时错误路径只走 `onFallback` 不触发 `onShadowMismatch`（对齐 P0-C 第 2 项的单测 expectation）；(7) 未知 backend 守护回退 javascript 并记录 unknown 日志。所有日志仅记录 message 摘要，断言不含 `require(`/`import ` 路径细节，不泄露源码/敏感路径。`npm test` 测试集合扩展到 330 项（新增 9 项）。本节点合上 P0-C 第 3 项「集成测试」边界门禁（`.vscodeignore` 仍排除 `assets/`，资产进 VSIX 由 P1 发布收口前 review 决定；生产 wasm artifact 必须在最终发布环境构建，本地构建只作开发态对照）。下一步进入 P1 真实性能/内存/启动/fallback 数据达标与 3.x 发布收口。

- **Wasm P0-C 第 1 项 生产 Wasm 资产与加载器**: 新增 `src/rustWasmAsset.js`（生产加载器，独立于开发态探针），通过 `assets/rust-wasm/manifest.json` 与 wasm 二进制做完整流程校验——形状校验（`protocolVersion`/`crateVersion`/`targetTriple`/`wasmPath`/`byteLength`/`sha256`/`exports`/`abiFlags`/`builtAt`）→ 字节长度 cheap 比对 → SHA-256 strong 比对 → `WebAssembly.instantiate` → 必需 exports 子集断言；每步失败抛 `RustWasmAssetError`（带 `reason` 字段：`manifest-missing`/`manifest-invalid`/`wasm-path-missing`/`wasm-bytes-mismatch`/`wasm-sha-mismatch`/`wasm-instantiation-failed`/`exports-mismatch`/`protocol-version-mismatch`），上层 `createAnalysisBackend` 的 `onFallback` 据 reason 记录日志并回退 JavaScript，不把加载失败转成成功形状，也不泄露仓库内部路径。新增 `scripts/buildRustWasmAsset.js` 与 npm 脚本 `build:rust:wasm:asset`/`check:rust:wasm:asset`：默认从 `crates/syntec-core/Cargo.toml` 解析 crate 版本，从开发态 `target/wasm32-unknown-unknown/release/syntec_core.wasm` 拷贝到生产资产目录 `assets/rust-wasm/`，写入 manifest；`--check` 模式不重写磁盘只校验 manifest 与 wasm 的字节/SHA 一致，挂到 `npm test` 链路的 check 阶段以确保 CI 检出仓库后资产完整性是门禁。新增 `assets/rust-wasm/manifest.json` 与 `assets/rust-wasm/syntec_core.wasm`（约 311963 字节、SHA-256 `7b69e5dcac2adc78aae592b51bbddd4f9c79bf41e1a2dda1effd0156c38ba669`）作为 P0-C 第 1 项「固定版本/target 的 wasm 资产」的物理载体；资产目录经 `.gitignore` 进入仓库（不进 `.vscodeignore` 同步排除项的开发产物子目录），但 P0-C 第 3 项「Worker 接入」未完成前经 `.vscodeignore` 仍不进 VSIX。`scripts/probeRustWasm.js`/`scripts/benchmarkRustWasm.js` 改为默认走 `loadRustWasmAsset(DEFAULT_MANIFEST_PATH)` 的生产加载路径，开发态 `SYNTEC_RUST_WASM` 仍可用作绕过 manifest 的逃逸端口（cargo build 刚生成的 artifact 即测即试），但不再硬编码 `crates/.../target/` 路径。新增 `tests/rustWasmAsset.test.js`（16 项测试：`computeSha256`/`assertManifestShape` 必填+格式+abiFlags+required 子集、`assertRequiredExports` 缺失列举、`loadRustWasmAsset` 成功+manifest 缺失/JSON 非法/byte 不匹配/SHA 不匹配/实例化失败/exports 缺失/wasmPath 缺失 共 8 类失败路径、`parseCrateVersion` 与 `buildManifestData` 与磁盘 wasm 产物一致）；`npm test` 测试集合扩展到 312 项。本节点合上 P0-C 第 1 项「生产 Wasm 资产与加载器」；下一步进入 P0-C 第 2 项「Worker 注入 AnalysisHost + shadow/differential 模式」与 P0-C 第 3 项「默认 backend 切换 + 集成测试」，Worker 仍未注入生产 Provider，Rust/Wasm 仍不默认启用。

- **Wasm P0-B 第 2 项 edits/TextEdit parity（完整结果合上）**: Rust 试点新增 `format_document` 函数完整移植 `src/formatter.js` (`getKeywords`/`getLeadingWhitespace`/`normalizeKeywordAliases`/`normalizeAssignmentOperator`/`removeControlStructureTerminator`/`normalizeStatementTerminator`/`buildIndent`/`formatSyntecMacroDocument`)，并补齐 `classify_statement_for_formatter` 与 `get_statement_terminator_info` 离线 JSON regex-free 实现；`analyze_request` 调用 `format_document` 后视文本差异产出整文档 `TextEdit`，镜像 JS `analysisCore.formatDocument` 的「单 edit 整文档替换」契约；`result_to_json` 新增 `document`/`profile`/`edits` 字段输出以匹配 AnalysisResult 协议形状；`compare:rust` 增加 P0-B 第 2 项 edits 差分环节——17 项样例覆盖 blank/macro header/ISO delimiter/IF 块/nested 嵌套/CASE/REPEAT·UNTIL/赋值 `=`→`:=`/控制结构尾部分号/danglingComparison/注释/跨行块注释/字符串内关键字/CRLF EOL/IF 行内体等边界，逐字段比较 JS 与 Rust 的 `AnalysisResult.edits`（17/17 等价）；profile 协商当前透传非空字符串（与 JS `assertNonEmptyString` 一致），未知 profile 当 generic 等价处理，产品 profile 后续接入专属规则。**P0-B 第 2 项「完整结果」三件套（diagnostics / symbols / navigation / edits / profile 协商）已合上**——下一步进入 P0-C 生产 Wasm 资产与 Worker 接入。

- **Wasm 重建/恢复**: 通过 `rustup target add wasm32-unknown-unknown` 重新安装缺失的 wasm32-unknown-unknown target，恢复 wasm artifact 构建能力；新 wasm artifact（约 ~312KB）含 `syntec_core_analyze_request_json` + `format_document` + `analyze_request` 完整路径，probe:rust:wasm 增加 P0-B 真实 request ABI 校验（document.uri/profile 透传 + AnalysisResult JSON 协议形状）。

- **Wasm P0-B 第 2 项 完整结果— navigation parity**: Rust 试点新增 `portable_file_name` / `get_program_entry_name` / `is_macro_file_content` / `get_macro_program_name` 辅助函数（与 `src/navigationSymbols.js` 同名/语义），在 Rust 侧依据 `document.uri` 完整计算 `programEntryName`/`macroProgramName`，不再依赖 JS 适配层事后补齐；非 macro 文件输出 `navigation: null` 并清空顶层 `symbols`，镜像 JS `buildNavigationIndexEntry` 早返路径；`analyze_request` 调用 `extract_navigation` 后依据 `document.uri`/`%@MACRO` header 选择性构造 `AnalysisNavigation`，`AnalysisResult.symbols` 镜像 `AnalysisNavigation.symbols`；`compare:rust` 增加 P0-B 第 2 项 navigation 差分环节——10 项样例覆盖 macro file（含 `%.nc`/`%.cnc` 命名调用/M198）与 ISO 文件/非 macro 文件/裸 basename 边界，逐字段比较 JS 与 Rust 的 `programEntryName`/`macroProgramName`/`symbols`/`calls` (10/10 等价)。本节点合上 P0-B 第 2 项 navigation parity。

- **Wasm P0-B 真实 request 传输**: Rust 试点新增 `analyze_request_json` 入口与 `parse_analysis_request` JSON 解析器（不引入 serde、保留 ~50KB Wasm 足迹），在 Rust 侧校验完整 `AnalysisRequest` 的 `protocolVersion`、`document.uri`、`document.version`、`document.languageId`、`document.text`、`profile`，不再由 JS 适配层事后补齐 document/profile；CLI 新增 `--request` 模式从 stdin 读取一份 `AnalysisRequest` JSON 并输出协议兼容的 `AnalysisResult` JSON，与默认文本模式共存；新增 Wasm 导出 `syntec_core_analyze_request_json`（接收整份 Request JSON，校验失败返回 0 以触发显式 fallback），`result_to_json` 修正顶层对象闭合 `}` 并补齐完整 navigation 字段序列化（programEntryName/macroProgramName/symbols/calls）；`createRustWasmAdapter` 优先走新 ABI，把整份 Request JSON 传给 Rust，缺失新 ABI 时显式降级到 legacy 文本路径并保持 `onFallback` 路径；`compare:rust` 增加 P0-B 差分环节——对 130 类样例同时跑 legacy text mode 与 `--request` 模式，确认两者诊断序列完全等价 (130/130)；新增 `tests/rustWasmAdapter.test.js` 4 项 `createRustWasmAdapter` 选择逻辑测试（请求 ABI 优先、拒绝错误请求、legacy 兼容降级、双 ABI 缺失抛错）。本节点合上 P0-B 真实 request 传输。

- **Rust 诊断 parity 清单**: 新增 `docs/Rust诊断parity清单.md`，对照 `src/diagnosticCodes.js` 全部 67 个 code 登记 Rust 覆盖状态、未覆盖项与迁移批次，作为 3.x Rust/Wasm 切换 P0-A.1 的执行依据。

### Changed

- **Wasm P0-A.2 调用与引用边界 parity**: Rust 试点补齐 `collectMetadata` 中的「% 缺 %@MACRO 文件头」warning（JS 在 `src/validator.js` 用 codeless warning 提示首行 `%` 而非 `%@MACRO`，将被视为 ISO 格式文件；Rust 在 `analyze_document` 主循环中按 `collectMetadata` 的 `firstNonCommentIdx`/`firstNonCommentIsBarePercent`/`hasMacroHeader` 一致顺序判定，在文件末尾用 `push_diagnostic_without_code` 输出等价内容与 col）；并 codified 已有的 `extract_goto_target` 静态标签收集、`n_label_name` `N100;` 形式、GOTO 目标缺失 codeless warning、`validate_macro_call_g_code_order` 的 `G65/G66/G66.1` 非行末 G 码 warning、`M98/M198/M99/G67` 调用与返回边界的 parity 状态；新增 15 项差分样例覆盖 `% 缺头`、`%@MACRO 不报`、`GOTO #变量` 不静态跳转、GOTO 在字符串/块注释中被豁免、多目标并存、`M99 P<target>` 返回、`G67` 取消、`G65/G66/G66.1/M98/M198` 合法调用；差分扩展到 130 类。P0-A.2 节点合上，可进入 P0-B 共享 `AnalysisResult` 合同。

- **Wasm ROBOT-SIGNAL parity (67/67 收口)**: Rust 试点补齐末批机器人状态机 parity——`SYNTEC_ROBOT_SWAITSIG_LIMIT`（运动单节后超过 1 个 SWAITSIG）、`SYNTEC_ROBOT_SYNCOUT_LIMIT`（同一有移动量移动单节超过 10 个 SYNCOUT）、`SYNTEC_ROBOT_RANGE_FORBIDDEN_COMMAND`（STITCHON/WEAVEON/WAITSYNC/G192.1 生效范围内的禁忌指令与 M96 中断型副程序 warning）；扩 `RobotLineState` 增加 `current_movement_line`/`swaitsig_count`/`syncout_count`/`in_stitch_on`/`in_weave_on`/`in_wait_sync`/`in_g192` 字段，重写 `validate_robot_line_state` 完整覆盖 MOVC pair、运动/WAIT 计数重置、SWAITSIG/SYNCOUT 计数与限制、STITCHON/WEAVEON/WAITSYNC/G192.1 生效范围禁忌（含 STITCHON 区间内 MOVL+SKIP 禁令、STITCHON/WEAVEON 互斥忽略开启指令），新增 `find_keyword_col` / `find_skip_col` / `is_m_code` / `push_range_forbidden` 辅助；新增 21 项 `robot-signal-*` 差分样例覆盖 SWAITSIG/SYNCOUT 限制与合法、`WAIT()` 重置、STITCHON/WEAVEON/WAITSYNC/G192 生效范围内 MOVJ/M 码/SWAITSIG/STITCH 禁令、M96 warning、STITCHOFF/WEAVEOFF/ENDSYNC/G192.2 关闭生效、MOVL SKIP 禁令与 STITCHON/WEAVEON 互斥；修正 `is_m_code` 中 `||` 而非 `&&` 导致 M 码误判的边界；dead code `SYNTEC_ROBOT_SWAITSIG_Q_RANGE`/`SYNTEC_ROBOT_SYNCOUT_Q_RANGE`/`SYNTEC_ROBOT_SKIPCOND_Q_RANGE` 在 `diagnosticActions.js` 注册但 JS `robotValidator.js` 实际未 emit，两端共同保持无 emit，parity 等价；差分扩展到 115 类，**Rust 诊断 parity 收口完成 67/67**——P0-A.1 全部稳定诊断 code 完成 JS/Rust 等价，可进入 P0-A.2 调用与引用边界、P0-B 共享 `AnalysisResult` 合同。

- **Wasm ROBOT-STITCH-WEAVE parity**: Rust 试点补齐缝焊/摆焊单行规则组 parity——`SYNTEC_ROBOT_STITCH_ARG_CONFLICT`（STITCHON 中 `L/K` 同时存在的冲突）、`SYNTEC_ROBOT_STITCH_MISSING_ARG`（STITCHON 缺少 `L` 或 `K` 的提示型 warning）、`SYNTEC_ROBOT_STITCH_L_INTEGER`（STITCHON 的 `L` 不可带小数点）、`SYNTEC_ROBOT_WEAVEON_MIXED_ARGS`（WEAVEON 的 `P` 语法不可与 `E/Q/K/L/R/I` 混用）、`SYNTEC_ROBOT_WEAVEON_Q_DECIMAL`（`Q` 频率未以 `Q1.0` 小数形式给出时的提示型 warning）；保留 JS 顺序与 col 计算规则（`\b(?:L|K)` 等前瞻匹配只看词边界首位字符），并在 `validate_robot_confirmed_single_line` 中追加 STITCHON 与 WEAVEON 两个分支；新增 8 项 `robot-stitch-*` / `robot-weaveon-*` 差分样例覆盖 L/K 冲突、缺失、L 小数、WEAVEON P 与细节引数混用、Q 整数与小数形式等边界；差分扩展到 94 类，parity 覆盖由 56/67 提升到 61/67，剩余 6 个 `ROBOT_*` code（`SWAITSIG_LIMIT` / `SYNCOUT_LIMIT` / `RANGE_FORBIDDEN_COMMAND` 与 3 个 dead `*_Q_RANGE`）保留至 ROBOT-SIGNAL 末批。

- **Wasm ROBOT-MODBUS parity**: Rust 试点补齐 `G10 L1900/L1901` Modbus-TCP 静态规则组 parity——`SYNTEC_ROBOT_G10_MODBUS_INTEGER`（8 个 Modbus 引数 `C/I/A/Q/K/X/P/R` 的小数/非 safe-int 检查）、`SYNTEC_ROBOT_G10_MODBUS_FORMAT`（L1900 C3/C6 必填/互斥/不支持 X 或 QK、L1901 必填 P/R/Q 与不支持 C/I/A/X、C 取值只能 3 或 6）、`SYNTEC_ROBOT_G10_MODBUS_RANGE`（任何引数不可为负、X 写入值 0~65535、P/Q 的 R 值编号 0~65535、R 自定义资料数量 0~254）；新增 `get_modbus_line`、`collect_modbus_args`、`is_safe_integer`、`join_letters` 辅助函数，将 G10 校验接入 `validate_robot_confirmed_single_line` 调用链（替换原先的 deferred 占位），保留 JS INTEGER → FORMAT → RANGE 顺序与 col fallback 规则；新增 15 项 `robot-g10-modbus-*` 差分样例覆盖 C3/C6/L1901 边界与合法语义，差分扩展到 86 类，parity 覆盖由 53/67 提升到 56/67；`SYNTEC_ROBOT_G10_MODBUS_*` 由"待迁移"正式归回"已覆盖"（原清单误登记已修复）。

- **Wasm ROBOT-MOV parity**: Rust 试点新增机器人运动单行规则组 parity——`MOVJ-II` 弃用拼写、`MOVC Xp/Yp/Zp` 过点写法、直接引数 `=` 错误、运动指令平滑引数 `PL/PQ/PR` 冲突与不支持、`MOVJ` 第一语法禁用 `P` 引数、`INCMOVL` 必填 `P` 引数、运动指令静态引数范围（按 `validateStaticArgumentRanges` 全量覆盖 MOVL/MOVC/INCMOVJ/INCMOVL/USERCOR/TOOLCOR/SHIFTON/G68.18/G43.16/POSEMAP/SKIPCOND/SWAITSIG/SYNCOUT/G192.1/CIRMODE/WAITSYNC/ENDSYNC 与 WEAVEON 双模式）、信号 `Q` 与来源 `E/P/S` 联动编码、USERCOR/TOOLCOR/G68.18 混入 CNC 进给/G 码/轴向命令/移动关键字的 `UNSUPPORTED_COORDINATE_SYNTAX`、单行成对 `MOVC` pair 跨行状态、`X1/X2` 单行写法豁免、条件分支下不强制成对，并把上述函数从开发态漏接函数正式接入 `analyze_document` 调用链（替换原 `validate_robot_toolcor` 入口；新增 `RobotLineState` 状态、`validate_robot_line_state` MOVC pair 子集与 `finalize_robot_state` 文件尾收尾）；差分扩展到 71 类，新增 14 项 `robot-mov-*` 样例覆盖正反例与边界；同步修正 `docs/Rust诊断parity清单.md`，Rust 覆盖提升至 53/67，并将 `SYNTEC_ROBOT_G10_MODBUS_*` 由"已覆盖"重新归类为待迁移（原清单误登记 Rust 已实现 Modbus，实际尚未实现）。

- **Wasm CASE DEFAULT parity**: 修正 `controlFlowValidator.js` 中 `DEFAULT:` 警告的 `endCol` 计算（由 `match[0].length` 改为 `match.index + match[0].length`）并附加 `SYNTEC_UNSUPPORTED_DEFAULT` code；Rust 试点新增 `validate_case_line_style` 等价实现，补齐 CASE 块内 `DEFAULT` 标签的 warning；新增 `case-default-label` 差分样例和 Rust 单测，覆盖缩进与未缩进两种边界。

- **Wasm TOOLCOR parity**: Rust 试点新增 `validate_robot_toolcor`，补齐 `TOOLCOR/TOOLCORON` 单行规则组——`TOOLCOR T_` 参数错误、`TOOLCORON` 弃用 warning 与 `TOOLCOR CLEAR` 非官方语法 warning；修正 `robotValidator.js` 中 `TOOLCOR_T_ARG` 的 col 计算，由硬编码 `lastIndexOf('T')` 改为捕获组实际字符，消除小写输入产生负 col 的边界（对大写输入行为不变）；新增 5 项 `robot-toolcor-*` 差分样例与 5 项 Rust 单测，三方差分覆盖扩展到 57 类。

- **后端切换边界**: `AnalysisHost` 新增可注入的 `javascript`/`rust-wasm` backend selector；Rust 结果失败或结构非法时必须经 `onFallback` 显式记录后回退 JavaScript，默认生产后端仍为 JavaScript。
- **RustWasmAdapter 生产边界**: 将协议适配器移入 `src/` 并纳入 VSIX 代码清单，开发脚本保留兼容转发；适配器不注册、不默认启用且不携带 Wasm 资产。
- **Wasm 中文诊断 parity**: Rust 试点补齐代码区中文字符/中文标点错误，保留字符串、行注释和块注释豁免，并支持无 code 共享诊断。
- **Wasm 调用边界 parity**: Rust 试点补齐静态 GOTO 目标缺失 warning 与 `G65/G66/G66.1` 非行末 G 码 warning，保持字符串/注释边界和文件级标签收集。
- **分析核心 M0/M1**: 新增版本化 `DocumentSnapshot`/`AnalysisRequest`/`AnalysisResult` 协议；诊断 Worker、格式化 Provider 和导航索引通过纯 JavaScript 分析核心运行，导航结果统一为 `AnalysisResult.navigation`，保留 `2.15.0` 的诊断 code、位置、严重度和发布元数据不变。
- **分析性能基线**: 新增 `npm.cmd run benchmark:analysis`，测量真实 fixture 与 20,000 行 MACRO 档案的 JavaScript 核心 p50/p95 延迟，不将未经基准证明的 Rust 性能假设写入发布门禁。
- **分析核心类型门禁**: 新增 `typescript` 开发依赖和 `npm.cmd run typecheck:analysis`，对协议、核心后端和分析基准启用严格 JSDoc/checkJs 检查；类型配置排除在 VSIX 之外。
- **分析快照缓存**: Worker 与同步回退共用有界 `AnalysisHost`，按协议版本、profile、URI、文档版本和文本精确缓存，支持 URI 失效与最旧条目淘汰。
- **M2 Parser 原型**: 新增开发态容错 Parser 和 `npm.cmd run benchmark:parser`，输出行 IR、Token、结构块、符号、静态调用和错误恢复结果；原型不进入生产 Provider，Tree-sitter 仍待独立方案比较。
- **Tree-sitter 工具链**: 已重新下载并保留 `tree-sitter-cli@0.27.0` 开发依赖，CLI 可用；尚未新增 Syntec grammar 或接入生产链路，后续继续做独立语法比较。
- **Tree-sitter grammar spike**: 新增开发态最小 grammar/corpus，覆盖行结构、字符串、变量、运算子、注释和错误恢复；2/2 corpus cases 通过，未接入生产。
- **Rust 试点环境门禁**: 初始共享环境缺少可用 `rustc`/`cargo`，已改用隔离 GNU toolchain 完成 CLI 试点；仍不把 Rust 二进制或 Wasm 带入 VSIX。
- **M3 Rust CLI 试点**: 在隔离 GNU toolchain 下新增 `crates/syntec-core`，实现协议版本 1 的词法预处理和控制流诊断；通过 CLI、Rust 单测和 JS/Rust 差分检查验证，未接入 VSIX。
- **M3 Wasm 边界探针**: `syntec-core` 可编译到 `wasm32-unknown-unknown`，Node 通过最小 ABI 分配/写入 UTF-8、调用控制流诊断 JSON/导航子集并释放内存；release artifact 约 50.3KB，已完成 JS/Rust 稳定字段差分，暂不接入生产桥接。
- **Wasm bridge 基准**: 10 次测量下 20,000 行档案 JSON bridge p50 约 58ms/p95 约 60ms、结果约 33.8KB；该 Rust 实现仍缺少完整诊断规则和 TextEdit，不作为完整 JavaScript 分析性能结论。
- **Rust Wasm 协议适配器**: 新增开发态 `RustWasmAdapter`，将 Rust JSON 规范化为共享 `AnalysisResult` 形状并拒绝 protocol/字段漂移；不注册到生产 Provider。
- **Wasm 共享结果契约**: Rust JSON bridge 的诊断改为共享协议的嵌套 range/source 结构，补齐 symbols/navigation/edit 形状校验；探针和基准均经同一适配器验证，仍不注册到生产 Provider。
- **Wasm 导航子集 parity**: Rust 试点补齐数字 G/O 目标标准化、静态命名 G 宏、字符串/注释边界和 UTF-16 位置；通过 Rust 单测与 Wasm/JavaScript 差分探针验证，完整文件元数据和引用能力仍待后续 bridge 设计。
- **Wasm 控制流诊断 parity**: Rust 试点补齐 `ELSE/ELSEIF` 边界、`EXIT` 退出传播、10 层嵌套深度 warning 和文件结束提示，并扩展 CLI/Wasm 差分样例；函数、LTP/Modbus 与格式化能力仍未迁移。
- **Wasm 基础语法诊断 parity**: Rust 试点补齐 `ELSIF` 和 `DIV` 的稳定错误 code/位置/提示，并加入字符串、注释和多场景差分覆盖；其余运算子、分号、括号和函数诊断仍保持 JavaScript 专属。
- **Wasm 基础运算子与结构边界 parity**: Rust 试点补齐控制结构尾部分号、`==/!=/&&/||/+=/++/%/!`、FANUC 比较关键字等可静态确定的诊断，差分覆盖字符串/注释和 UTF-16 范围；函数诊断仍未迁移。
- **Wasm 导航文件元数据边界**: `RustWasmAdapter` 支持可选 `navigationFilePath`，在适配层补齐程序入口/宏文件名并过滤非宏文件导航；旧文本 ABI 与生产 Provider 不变。
- **Wasm 可选诊断 code 与括号 parity**: Rust JSON bridge 支持无 `code` 字段的共享诊断，补齐括号/方括号多余与缺失 warning，并覆盖 CLI/Wasm/JavaScript 差分；函数诊断仍未迁移。
- **Wasm 静态 MOD parity**: Rust 试点补齐纯数字 `MOD` 小数操作数诊断，整数和动态表达式保持不误报，并通过 CLI/Wasm/JavaScript 差分验证。
- **Wasm 缺少分号 parity**: Rust 试点补齐普通赋值、结束语句和 G 码等语句的缺少分号错误，同时排除控制结构头、分支、CASE 标签和宏头；函数与更复杂语句分类仍未迁移。
- **Wasm 数学函数域 parity**: Rust 试点补齐 `ATAN2/POW/LN/SQRT/ACOS/ASIN` 的静态常量域诊断，复用 `SYNTEC_FUNCTION_MATH_DOMAIN`，动态引数和嵌套表达式保持不推断。
- **Wasm I/O 函数范围 parity**: Rust 试点补齐 `READDI/READDO/READABIT/SETDO/SETABIT` 点位、写入值，以及 `READRREGBIT/SETRREGBIT` 的 R/bit 范围诊断；动态引数保持不推断。
- **Wasm 基础函数引数 parity**: Rust 试点补齐 `ALARM/MSG` ID、`PARAM` 整数引数和 `CHKINF` 类别范围诊断，动态引数保持不推断。
- **Wasm 变量访问 parity**: Rust 试点补齐命名局部/公用变量、`#0/@0` VACANT 赋值和 AR/MAR 静态非法编号诊断；动态索引保持不推断。
- **Wasm R 保留区写入 parity**: Rust 试点补齐公用变量 `@` 映射到 R 寄存器保留区的写入 warning，区分 PLC/参数/FRAM/系统接口/未列保留段，并保留可写区段不诊断。
- **Wasm 字符串函数 warning parity**: Rust 试点补齐 `OPEN("COM1")` 与 `AXID("Y")` 的说明型 warning，复用字符串/注释边界，普通文件名和裸轴名保持不诊断。
- **Wasm SYSDATA/DRVDATA parity**: Rust 试点补齐 SYSDATA 整数引数、DRVDATA 站号整数和第二引数十进制/`"xxxh"` 格式诊断，动态变量保持不推断。
- **Wasm 赋值风格 parity**: Rust 试点补齐行首 `#/@/AR/MAR` 使用单独 `=` 的说明型 warning，条件比较、`==` 和 `:=` 保持不误报。
- **M3 后端 Go/No-Go**: JavaScript 继续作为唯一生产后端；Rust/Wasm 保持开发态 CLI/ABI 试点，直到完成完整诊断 parity、TextEdit/导航结果、可复现 CI 构建和回滚验证。

## 2.15.0 - 2026-09-17

### Added

- **Modbus-TCP 静态语法诊断**: 为 `G10 L1900` 的 C3/C6 读写语法与 `G10 L1901` 自定义封包增加必填/互斥引数检查、十进制整数检查，以及已确认的 `X`、`P/Q`、`R` 范围检查。

### Changed

- **Modbus 文档与回归覆盖**: 同步 G10 Modbus-TCP hover、语法手册、诊断说明与正反例测试；对 Confluence 未明确上限的站号、装置地址和 `K` 数量不做臆测限制。

## 2.14.0 - 2026-09-17

### Added

- **LTP 静态引数与 Q 联动诊断**: 依据 Atlassian Rovo MCP Server 复核的 LTP 正式页面，为 `USERCOR`、`TOOLCOR`、`G68.18`、`POSEMAP`、`SHIFTON`、`SKIPCOND`、`SWAITSIG`、`SYNCOUT`、`CIRMODE`、`WAITSYNC/ENDSYNC` 和 `G192.1` 增加可静态确认的引数范围与信号 Q 联动检查；动态变量和表达式保持不推断。
- **坐标系语法边界诊断**: 新增 `SYNTEC_ROBOT_UNSUPPORTED_COORDINATE_SYNTAX`，提示 `USERCOR`、`TOOLCOR`、`G68.18` 不可混入 CNC/机器人进给、G 码、轴向命令或移动指令。
- **语言数据一致性门禁**: 新增 `npm.cmd run check:data`，检查内置函数、机器人关键字 Hover 和诊断元数据的一致性，并接入 `npm test`。

### Changed

- **导航缓存失效**: 工作区导航缓存通过文件监听主动失效，保留取消、删除文件清理和结果顺序；500 文件集成基准重复查询降至 281ms。
- **FUN-A 证据边界**: 完善 `SYSVAR`、`GETPR`、`SETPR` 的 Hover 和资料说明；`GETPR/SETPR` 在缺少 A 级来源或控制器记录时继续不提供强诊断。
- **发布冒烟清理**: Windows 临时 profile 清理增加重试，清理竞态只输出明确 warning，不再把已通过的安装冒烟误报为失败。

### Documentation

- 同步 LTP/FUN-A 官方证据、能力矩阵、语法手册、交接说明和发布规划。

## 2.13.0 - 2026-09-16

### Added

- **LTP 静态引数范围诊断**: 依据已登记的 LTP/CF 正式页面，为 `MOVL/MOVC/INCMOVJ/INCMOVL` 的 `P/Q` 与 `WEAVEON` 的 `P/L/R` 增加静态常量范围检查；表达式和动态变量保持不推断。
- **导航索引有界并发**: 工作区导航索引支持有界并发加载，500 文件集成基准首次查询 1207ms、重复查询 387ms，保持缓存失效和结果顺序。

### Changed

- **共享词法状态机**: 将注释、字符串和转义引号处理统一到 `src/lexer.js`，供 validator、formatter、navigation 和函数参数检查复用，降低语法行为漂移风险。
- **验证与文档同步**: 新增静态范围诊断 code、说明型 action、诊断文档、LTP 资料包和正反例回归；发布规划与交接状态同步到 `v2.13.0`。

## 2.12.0 - 2026-09-15

### Added

- **R 寄存器保留区写入诊断扩展**: `SYNTEC_PUBLIC_VAR_R_RESERVED_WRITE` 检测范围从 `R0~R1023` 扩展到 `R11000~R14999`（含手册点名的 `R13001~R14095`），依据 PLC 介面说明与 Macro 变数规格。采用黑名单扩展策略：只报手册明确点名的保留段，`R4096~R5111`/`R5112~R5799`/`R8000~R9999` 等"未列出"段暂不静态检测，避免 DOS/WinCE/Linux 系统差异导致的误报。
- **控制流嵌套深度 warning**: 新增 `SYNTEC_CONTROL_NESTING_DEPTH_EXCEEDED` warning，检测 `IF/CASE/REPEAT/WHILE/FOR` 互相嵌套超过 10 层（对应控制器 `COM-007` 巢状超过 10 层）。阈值 `stack.length >= 10`，确保 10 层合法深度不报、第 11 个 opener 触发。

### Changed

- `docs/macro-knowledge/MACRO能力矩阵.md` 更新：VAR-002 后续验证条目从"评估 R13001~R14095 可行性"升级为"R11000~R14999 已实现"；FLOW-002 状态从"部分核实"升级为"深度 warning 已实现"。
- `docs/macro-knowledge/MACRO知识与验证规划.md` 新增代码批次 2（R 保留区扩展）与代码批次 3（嵌套深度 warning）迭代记录，标注设计选择、证据来源与未推进项的证据阻塞状态。

## 2.11.9 - 2026-08-05

### Fixed

- **方括号匹配诊断**: 检测多余或缺失的 `[]`，避免行尾多余的 `]` 被静默通过；保留 `#[表达式]` 等合法间接变量写法。

## 2.11.8 - 2026-07-29

### Changed

- **扩展主入口按 Provider 拆分**: 将 `extension.js`（967 行）按职责拆分为 `providerShared`、`completionProvider`、`hoverProvider`、`definitionProvider`、`diagnosticsProvider`、`navigationProvider`、`formattingProvider` 七个模块，`extension.js` 仅保留注册与生命周期管理；各 Provider 自行管理状态与 `dispose`，行为保持不变。
- **注释/字符串剥离逻辑统一**: 将 `validator.js` 与 `formatter.js` 中重复的 `stripCommentsAndStrings` 实现抽取到共享模块 `src/lexer.js`，消除两份状态机实现的行为漂移风险（formatter 闭合引号处理已对齐 validator 的规范行为：引号始终替换为空格）。
- **函数参数校验常量化**: `functionArgumentValidator.js` 中内联的控制器范围数字（I/O 点位 0~511、写入值 0/1、R 寄存器 0~65535、bit 0~31、ALARM/MSG ID 0~65535、CHKINF 类别 1~5）提取为模块顶部命名常量并标注手册出处，便于与《新代控制器技术参考手册》对照。
- **类型检查基础**: 新增 `jsconfig.json` 与 `@types/node` devDependency，为 `diagnosticFactory.js`、`lexer.js` 启用 `// @ts-check` 并补充 `DiagnosticProblem` 等 JSDoc 类型定义；`validator.js` 的 `validateDocument` 标注返回类型。无需构建即可在 IDE 获得局部类型检查收益。

### Fixed

- **README 徽章一致性校验前置**: `checkReleaseConsistency.js` 的 README 版本徽章校验原本只在 `--tag` 发布路径执行，常规 `npm run check:release`（无 tag，接入 `npm test`）会跳过；现改为始终与 `package.json` 版本对比，使徽章漂移在开发阶段即可被发现。

## 2.11.7 - 2026-07-28

### Added

- **运行时验证**: 在 81RA 机器人系统（10.120.44C）完成 14 项运行时验证，包含 CALL-RUN-01~07（调用语义）、FUN-E-06/07（单位与堆栈）、FUN-D-02（Cycle DB）、FUN-F-03/04（图形模拟）。验证程序位于 `tests/runtime-verification/`。关键发现：
  - G65 变量隔离、M98/M198 继承、M99 返回行为确认
  - G66/G66.1 在机器人系统上仅触发一次（与 CNC 行为不同）
  - 空栈 POP（堆栈下溢）和 STKTOP 越界索引均触发预解或运行时报警，无静默返回值
  - DBDELETE 未开档回传 -2，DBINSERT 未定义 Cycle name 回传 -3
  - SETDRAW 接受色码输入并原样返回，不做有效性检查

### Fixed

- **Issue Template YAML 修复**: `feature_request.md` 的 YAML front matter 首行 `#---` 改为 `---`，修复格式失效。

## 2.11.6 - 2026-07-28

### Fixed

- **发布脚本与 CHANGELOG 格式一致**: `checkReleaseConsistency.js`、`createGitHubRelease.js` 与 `release.yml` 原本期望 CHANGELOG 段落标题为 `## [X.Y.Z] - date`（带方括号），但 CHANGELOG 自 v1.0.0 起一致使用 `## X.Y.Z - date`（无方括号），导致 `npm run check:release -- --tag`、release notes 生成与 release body 提取都会失败。修正脚本与工作流匹配现有无括号格式。

### Changed

- **知识库版本基线同步**: `MACRO能力矩阵.md` 与 `MACRO知识与验证规划.md` 的发布状态行补充 `v2.11.5`。
- **FUN-B-12 证据阻塞解除**: 通过 Atlassian MCP 查询 Confluence，`SLEEP` 和 `AXID` 的 A 级来源在 Macro Function List 确认，与现有 hover 一致；`GETPR/SETPR` 经 CQL 搜索确认无函数页，维持证据阻塞。

## 2.11.5 - 2026-07-28

### Added

- **Worker 线程验证**: `validateDocument` 改在独立 Worker 线程执行，避免大文件诊断阻塞 Extension Host；包含 5 秒超时保护和竞态取消机制。
- **GitHub Release 脚本**: 新增 `scripts/createGitHubRelease.js`，适配域控环境（`git credential fill` + `curl.exe` + 临时 JSON 文件），替代被阻止的 `gh` CLI。

### Fixed

- **REPEAT 未闭合诊断**: `REPEAT` 块缺少闭合时正确提示"缺少对应的 UNTIL"，而非"缺少对应的 END_"。
- **函数参数解析**: 内置函数静态参数诊断支持嵌套括号和字符串内的逗号，不再将 `ATAN2(1, SQRT(2))` 等嵌套调用误判为多参数。
- **STITCHON/WEAVEON 互斥状态**: 在对方生效范围内静默忽略开启指令，避免状态不一致导致后续误报。
- **同行体检测**: `THEN/DO/OF` 后仅分号或空白不再识别为同行体，避免 `WHILE #1 DO;` 等控制结构头误加分号被当作合法同行体。
- **中文字符诊断字符串转义**: 字符串内的转义引号不再错误切换字符串状态，避免 `MSG("含\"中文")` 误报中文字符。
- **路径扩充引数正则**: 修正 `,C_`、`,R_`、`,A_` 匹配模式，避免误匹配。

### Changed

- **验证器性能**: 预编译关键字正则并缓存 `stripCommentsAndStrings` 结果，减少逐行重复创建 RegExp 对象。
- **资源清理**: `deactivate()` 完整清理诊断定时器、请求 ID 缓存、导航索引缓存和 Worker 线程，避免热重载后触发已 dispose 的 collection。
- **CodeActions 同步调用移除**: `getActionableDiagnostics` 不再在缺诊断时同步调用 `validateDocument`，避免阻塞 Extension Host。

### Removed

- **过时发布记录**: 移除 `docs/v2.10.0-发布记录.md` 和 `docs/v2.11.0-发布记录.md`（内容已在 CHANGELOG 中）。
- **死代码**: 移除 `extension.js` 中未使用的 `createDiagnosticFromProblem` 和 `rangeIntersects` 函数。

## 2.11.4 - 2026-07-25

### Fixed

- **格式化器安全性**: 修复跨行块注释被误改、多个规范化操作发生位置偏移，以及同行体导致后续代码错误缩排的问题。
- **格式化器规范化**: 自动补全需要的结尾分号，删除控制结构头多余分号，并将兼容写法 `ENDIF`、`ENDFOR`、`ENDWHILE`、`ENDCASE`、`ENDREPEAT` 和赋值 `=` 转为推荐写法。
- **格式化器边界**: 同行控制体、CASE 标签后赋值、行尾注释和字符串内容均得到保护。

## 2.11.3 - 2026-07-17

### Fixed

- **控制结构同行体误报**: `IF ... THEN <stmt>; ELSE <stmt>; END_IF;` 等同行体写法虽不推荐但控制器实际支援，不再误报"控制结构行不应以 ; 结尾"。覆盖 IF/ELSEIF/WHILE/FOR/REPEAT/CASE 所有控制结构。
- **DEFAULT 降级为 warning**: `DEFAULT:` 在 CASE 中实际可用，从 error 降级为 style warning "支援但不推荐，建议使用 ELSE"。

## 2.11.2 - 2026-07-13

### Fixed

- **路径扩充引数诊断**: 不再将 `ATAN2(..., SQRT(...))` 等嵌套函数调用误判为 `,SQRT_` 路径扩充引数；仅在 `G00/G01/G02/G03` 路径单节检查 `,C_`、`,R_`、`,A_`。
- **表达式引数识别**: 路径扩充引数的方括号表达式会参与诊断，`Z[#1 + 10]` 等未确认引数可正确提示 `COR-034` 风险。

## 2.11.1 - 2026-07-13

### Changed

- **发布资料同步**: 将 v2.11.0 发布后的 README、路线图、交接说明和 MACRO 知识库导航纳入正式发布包，确保 GitHub Release 与当前 main 文档一致。

## 2.11.0 - 2026-07-13

### Added

- **AXID 轴名提示**: `AXID` 补全与 Hover 采用 `AXID(axis)` 裸轴名语法；`AXID("Y")` 显示说明型 warning，避免带引号写法与控制器语法不一致。
- **Cycle 资料库说明**: 补齐 `DBLOAD/DBINSERT` 的共享 Cycle name 覆盖关系，以及 `DBDELETE` 的明确回传码。

### Changed

- **函数 Hover 语义**: 补充图形模拟、数学定义域、单位/堆栈和 Cycle 档案函数的已核实说明与回归保护。
- **诊断文档生成**: 诊断规则表会转义 MACRO 间接变量的方括号，避免 `AR[#1]`、`#[表达式]` 被 Markdown 解析为不存在的链接。

## 2.10.0 - 2026-07-11

### Added

- **工作区符号导航**: 支持通过 `Ctrl+T` 跨文件检索静态 G/O 程序入口、`%@MACRO` 与 N 标签，并保持动态目标不参与静态解析。
- **宏调用引用查找**: 支持从静态调用目标或宏文件入口查找 `G65/G66/G66.1`、`M98/M198` 的工作区引用；变量与表达式目标不参与解析。
- **诊断文档同步检查**: 新增 `npm run docs:diagnostics:check`，文档与诊断元数据不一致时退出失败，并接入 `npm test`。
- **持续集成**: 新增 main 分支与 Pull Request 的 GitHub Actions 测试、诊断文档同步检查、ESLint 和 VS Code 集成测试；release 打包前同样执行集成测试，失败日志自动上传。
- **发布一致性检查**: 新增 package/lockfile 常规检查及 tag/package/README/CHANGELOG 发布检查，阻止版本元数据不一致时打包。
- **VSIX 内容检查**: 新增严格文件白名单、打包前自动检查及产物大小/SHA-256 报告，开发脚本不再进入发布包。
- **安装包冒烟**: 新增隔离 VS Code Profile 冒烟命令，验证已安装 VSIX 的版本、安装路径、激活与 Workspace Symbol。

### Changed

- **导航扫描性能**: Workspace Symbol 与 References 改用文本快照、单次解析索引和自动失效缓存，不再批量打开候选文档；新增 500 文件/20,000 行解析及真实工作区 I/O 基准。
- **VSIX 内容收口**: 从扩展包中排除 `scripts/`，只保留运行时模块、Marketplace 元数据、语法、snippets、icon 与许可证文件。

## 2.9.0 - 2026-07-11

### Changed

- **诊断体验整合**: README 新增诊断与 Quick Fix 用户说明，解释 error/warning、自动修复与说明型 CodeAction 的边界。
- **诊断规则文档增强**: `docs/诊断规则与修复动作.md` 从纯 code 表扩展为按场景阅读的诊断指南，同时保留自动生成的完整规则表。

### Added

- **诊断场景指南**: 补充分号规则、不支持语法、控制流、变量与函数参数、机器人/LTP 等常见诊断场景说明。

## 2.8.21 - 2026-07-11

### Added

- **v2.9.0 规划文档**: 新增 `docs/v2.9.0-规划.md`，明确 v2.9.0 发布目标、非目标、里程碑与验收标准。

### Changed

- **路线图入口**: `ROADMAP.md` 与 README 目录链接到 v2.9.0 详细规划，便于后续按 milestone 推进。

## 2.8.20 - 2026-07-11

### Changed

- **路线图收束**: 更新 `ROADMAP.md`，记录 v2.8.x 诊断体系完成状态、当前发布节奏建议与 v2.9.0 候选主题。
- **README 导航**: 在功能表和目录中补充诊断规则与修复动作相关入口。

## 2.8.19 - 2026-07-11

### Added

- **诊断规则文档**: 新增 `docs/诊断规则与修复动作.md`，列出诊断 code、分类、严重度、Quick Fix / CodeAction 与维护说明。
- **诊断文档生成脚本**: 新增 `npm run docs:diagnostics`，依据 `diagnosticCodes` 与 `diagnosticActions` 生成诊断规则文档。

## 2.8.18 - 2026-07-11

### Changed

- **集成测试稳定性**: 抽取诊断等待与 Quick Fix 应用 helper，以等待诊断状态变化取代固定延迟，降低 VS Code 集成测试脆弱性并缩短运行时间。

## 2.8.17 - 2026-07-11

### Changed

- **诊断结果排序**: 诊断返回前统一按位置、严重度与稳定 code/message 排序，使 UI 展示与测试结果更可预期。

## 2.8.16 - 2026-07-11

### Changed

- **诊断优先级过滤**: 同一区间已有错误诊断时会抑制重叠的警告诊断，减少语法错误场景下的风格提示噪音。

## 2.8.15 - 2026-07-11

### Changed

- **诊断去重稳定性**: 诊断去重 key 优先使用稳定 `code` 而非中文提示文字，避免未来调整文案影响诊断去重行为。

## 2.8.14 - 2026-07-11

### Changed

- **诊断对象工厂推广**: 将 `controlFlowValidator`、`functionArgumentValidator` 与 `robotValidator` 的诊断对象创建统一迁移到 `diagnosticFactory`，进一步收敛诊断结构。

## 2.8.13 - 2026-07-11

### Changed

- **诊断对象工厂**: 新增统一诊断对象工厂，并将 `validator` 中的手写诊断对象改为通过工厂创建，减少字段遗漏和重复结构。

## 2.8.12 - 2026-07-11

### Changed

- **诊断规则注册表**: 将行级诊断器改为带稳定 `id` 的规则注册表，并通过统一 helper 执行，便于后续新增、重排和测试诊断规则。

## 2.8.11 - 2026-07-11

### Changed

- **诊断动作元数据**: 将 Quick Fix 替换规则、说明文案与控制流闭合词抽取到独立 `diagnosticActions` 模块，降低后续新增诊断和 CodeAction 的维护成本。

## 2.8.10 - 2026-07-11

### Added

- **机器人/LTP 诊断 code**: 为机器人直接引数误用 `=`、旧式/非正式写法、平滑引数冲突、MOVC 成对规则、同步输出限制与特殊区间禁用等诊断提供稳定 code。
- **机器人/LTP Quick Fix**: 为安全可判定的写法提供自动修复，包括移除直接引数 `=`、`MOVJ-II` 改为 `MOVJ`、`TOOLCORON` 改为 `TOOLCOR`、`T_` 改为 `P_`、`TOOLCOR CLEAR` 改为 `TOOLCOR P0`。
- **机器人/LTP 集成测试**: 覆盖机器人语法 Quick Fix 在 VS Code 宿主中的实际应用结果。

## 2.8.9 - 2026-07-11

### Added

- **函数静态诊断 code**: 为数学函数定义域、I/O 点位范围、I/O 写入值、R 寄存器/bit 范围、ALARM/MSG ID、整数参数、CHKINF 类别与 OPEN COM 口径提供稳定诊断 code。
- **函数诊断说明 action**: 对无法安全自动修复的函数静态参数问题提供规则说明 Quick Fix。
- **函数诊断集成测试**: 覆盖函数静态诊断说明 action 在 VS Code 宿主中的行为。

## 2.8.8 - 2026-07-11

### Added

- **变量诊断 code**: 为命名局部/公用变量、`#0/@0` VACANT 赋值、AR/MAR 非法编号与赋值 `=` 风格建议提供稳定诊断 code。
- **变量诊断说明 action**: 对无法安全自动修复的变量编号问题提供规则说明 Quick Fix。
- **赋值风格 Quick Fix**: 对赋值语句中的 `=` 提供一键替换为推荐 `:=`。
- **变量诊断集成测试**: 覆盖变量诊断说明 action 与赋值风格 Quick Fix 在 VS Code 宿主中的行为。

## 2.8.7 - 2026-07-10

### Added

- **控制流诊断 code**: 为未匹配结束符、嵌套顺序错误、未匹配 `ELSE/ELSEIF/UNTIL`、`ELSEIF` 位于 `ELSE` 之后，以及文件结束时未闭合块提供稳定诊断 code。
- **未闭合块 Quick Fix**: 对文件结束时未闭合的 `IF/FOR/WHILE/CASE` 提供插入对应 `END_*;` 的 Quick Fix。
- **控制流集成测试**: 覆盖未闭合控制块 Quick Fix 在真实 VS Code 宿主中的应用结果。

## 2.8.6 - 2026-07-10

### Added

- **不支持语法 Quick Fix**: 为 `ELSIF`、`DEFAULT`、`DIV`、`==`、`!=`、`&&`、`||`、`%` 与 FANUC 比较关键字提供稳定诊断 code 和安全替换 Quick Fix。
- **Quick Fix 集成测试**: 覆盖多个不支持语法的真实 VS Code Quick Fix 应用流程。

### Changed

- **CodeAction 稳定性**: Quick Fix provider 可在 VS Code 未传入完整诊断上下文时回退到当前文档诊断，提升 CodeAction 查询稳定性。

## 2.8.5 - 2026-07-10

### Added

- **诊断 Quick Fix**: 为缺少行尾 `;` 与控制结构行误加 `;` 提供一键修复。
- **诊断稳定 code**: 为分号相关诊断提供稳定 code，便于测试、Quick Fix 与后续维护。
- **VS Code 集成测试**: 覆盖真实扩展宿主中的分号诊断 code 与 Quick Fix。

### Changed

- **语句分类模块**: 将语句分类与行尾分号信息抽出为独立模块，供 validator 与后续扩展能力复用。
- **测试样例策略**: 保持 `test-demo.nc` 为无诊断合法语法覆盖样例，错误场景改由测试内联样例覆盖。
- **代码片段**: 调整控制流与函数片段的行尾分号和占位符写法，确保插入结果符合当前诊断规则，并消除 VS Code snippet 语法警告。

## 2.8.4 - 2026-07-10

### Changed

- **语法诊断架构**: 新增行上下文与语句分类层，收敛分号诊断、控制流行处理与机器人旧语法规则表，降低后续规则维护成本。

### Fixed

- **分号诊断**: 按新代 MACRO 控制流语法区分控制结构行与完整语句；`END_*` 与 `UNTIL ... END_REPEAT` 等完整语句缺少 `;` 会报错。
- **控制结构诊断**: `IF/ELSEIF/FOR/WHILE/CASE/REPEAT/ELSE` 与空 `CASE` 标签等结构行误加行尾 `;` 会报错。

## 2.8.3 - 2026-07-10

### Added

- **扩展图标**: 新增 VS Code 扩展图标资源，并随 VSIX 一起打包发布。

## 2.8.2 - 2026-07-09

### Added

- **新代宏程序知识图谱**: 新增 `docs/新代宏程序知识图谱.md`，并从 README 链接，便于快速理解语法与能力边界。

### Changed

- **语法高亮**: 补充不等号 `<>` 的运算子高亮。
- **VSIX 打包内容**: 更新 `.vscodeignore`，排除 `.vscode` 本地配置。

### Fixed

- **语法诊断**: 对不支持的 `DIV`、`==` 与 `!=` 运算子提供明确报错与替代写法提示。
- **语法诊断**: 支援合法不等号 `<>`，避免被误判为不支持语法。

## 2.8.1 - 2026-06-28

### Added

- **G10 L1803/L1805 Hover**: 补充 MACRO IO TYPE-1/TYPE-2 的悬停文档，覆盖指令格式、引数范围、Q 引数范例、版本与限制说明。
- **G10 L1803/L1805 Snippet**: 新增 `g10l1803` 与 `g10l1805` 代码片段。
- **G10 通讯指令 Hover/Snippet**: 补充 `G10 L1021`、`G10 L1022`、`G10 L1900/L1901`、`G10 L1910/L1911` 的通讯指令悬停文档与代码片段。
- **G10 R 寄存器与讯号等待 Hover/Snippet**: 补充 `G10 L1000`、`G10 L1810`、`G10 L1820` 的悬停文档与代码片段。

### Changed

- **语法手册**: 同步 `G10 L1803` 与 `G10 L1805` 定义，修正 `G10 L1805` 最低版本口径。
- **语法手册**: 补充 ENIP、EtherCAT 物件字典、Modbus-TCP/RS485 相关 `G10` 通讯指令说明。
- **语法手册**: 补充 `G10 L1000` R 寄存器写入与 `G10 L1810/L1820` 讯号等待说明。

## 2.8.0 - 2026-06-28

### Added

- **后续路线图**: 新增 `ROADMAP.md`，记录 validator 拆分、VS Code 集成测试、formatter 评估和跳转能力扩展等后续待办。
- **补全回归测试**: 增加函数补全 snippet 测试，覆盖无参函数、普通函数和 `STKTOP[index]` 方括号签名。
- **VS Code 集成测试**: 新增 `npm run test:integration`，覆盖扩展激活、补全、悬停、GOTO 跳转、大纲符号和诊断配置开关。
- **保守 formatter**: 新增格式化 Provider，仅调整缩进并移除尾随空白，不重排或改写宏语句。
- **扩展跳转覆盖**: 支持 `G66/G66.1 P_` 跳转 G 宏程序、`M98/M198 P_` 跳转 O 副程序，以及 `G65/G66/G66.1 P"Name"` 静态字符串宏名跳转。
- **G/M 代码 Hover 数据表**: 新增 `src/codeDocs.js`，为常用 G/M 代码提供签名和说明，并用于 Hover 与 M 码补全说明。

### Changed

- **VSIX 打包工具链**: 固定 `@vscode/vsce` 为本地 devDependency，`npm run package` 使用本地 `vsce`。
- **README 功能口径**: 移除尚未实现的格式化文档操作说明。
- **validator 模块拆分**: 将函数静态参数诊断拆到 `src/functionArgumentValidator.js`，将机器人/LTP 单行与跨行状态诊断拆到 `src/robotValidator.js`，将控制流栈诊断拆到 `src/controlFlowValidator.js`。

### Fixed

- **函数补全 snippet**: 无参函数如 `SLEEP()` / `WAIT()` 不再被补成带占位参数的调用；`STKTOP[index]` 使用方括号 snippet。
- **配置贡献结构**: `package.json` 直接贡献 `syntecMacro.*` 设置键，与 README 和代码读取口径保持一致。
- **DocumentSymbol Provider**: 修复 VS Code 大纲 Provider 方法名，避免集成测试宿主报 `provideDocumentSymbols is not a function`。

## 2.7.0 - 2026-06-28

### Added

- **单一语法真源手册**: 新增并扩充 `docs/新代MACRO语法规范手册.md`，覆盖文件格式、变量、运算子、控制流、宏呼叫、登录 G/M/T 码、函数、机器人 LTP 指令、预解流程和撰写规范。
- **宏文件识别策略**: 支援常见加工档后缀 `.nc/.cnc/.tap/.prt/.mpf/.ptp/.pim/.anc/.bj/.edit/.demo`，并以 `%@MACRO` 首行作为内容识别依据。
- **纯文件解析工具**: 新增 `src/fileResolver.js`，统一宏程序文件名标准化和候选文件搜索逻辑。
- **机器人 LTP 补全与高亮**: 新增 `WAITSYNC`、`ENDSYNC`、`CIRMODE`，以及 `G01.101/102`、`G04.101/102/103`、`G10.101`、`G11.101/102/103`、`G12.101`、`G52.101`、`G53.101/102`、`G141.2`、`G142.*`、`G143.1`、`G144.*`、`G145.*`、`G192.*` 等机器人替代 G 码。
- **路径扩充引数诊断**: 识别 `,C_`、`,R_`、`,A_`，并对未确认路径扩充引数如 `,Z_` 提示 `COR-034` 风险。
- **变量基础诊断**: 对 `#0` / `@0` 作为赋值目标提示 VACANT 只读；对 AR/MAR 负数或小数静态编号报错。
- **函数静态诊断**: 对 `ATAN2(0,0)`、`POW` 负基底、`LN` 非正数、I/O 范围、`ALARM/MSG` ID、`PARAM/CHKINF` 参数与 `OPEN("COM1")` 提供静态提示。
- **MOVC 单行写法**: 支援新版 `MOVC X1=... X2=...` 单行写法，不再误判为缺少第二行 MOVC。
- **机器人区间互斥诊断**: 补齐 `WAITSYNC/ENDSYNC`、`G192.1/G192.2` 与 `STITCHON/WEAVEON` 区间禁用规则。
- **回归测试**: 增加机器人关键字、替代 G 码、路径扩充引数、VACANT 赋值和 AR/MAR 编号诊断测试。

### Changed

- **扩充 G/O 程序策略**: 扩充 G 码与 O 码副程序优先按无后缀文件处理，跳转搜索优先查无后缀候选。
- **文件关联收紧**: 移除 `.macro`、`.scp`、`.G` 的默认全局关联，仅通过 `%@MACRO` 首行或手动切换语言识别。
- **MOVJ 第二语法口径**: `MOVJ-II` / `INCMOVJ-II` 仅作为文档中的第二语法称呼，不作为正式指令补全或高亮；诊断提示改为使用 `MOVJ` / `INCMOVJ` 第二语法。
- **README 更新**: 更新机器人指令能力、文件识别策略和 VSIX 版本说明。

### Fixed

- **测试隔离**: 将纯文件解析逻辑从 `extension.js` 拆出，避免 Node 单元测试直接加载 VS Code API。
- **递归跳转候选一致性**: 递归搜索与 includePath 搜索统一使用 `fileResolver` 后缀策略。

## 2.6.5 - 2026-06-27

### Added

- **AI 语法覆盖 Demo**: 重构 `test-demo.nc` 为紧凑语法速查文件，覆盖变量规格、控制流、运算符、函数、宏调用、机器人指令与 G/M 码形态
- **风格建议诊断**: 对兼容但不推荐的短结束符 (`ENDIF`/`ENDFOR`/`ENDWHILE`/`ENDCASE`/`ENDREPEAT`) 提示使用标准 `END_*` 写法
- **赋值风格提示**: 对赋值 `=` 提示建议使用 `:=`，条件比较 `=` 不误报
- **命名变量诊断**: 对 `#TEMP` / `@TEMP` 等控制器不支援的命名变量报错
- **DIV 诊断**: 对不支援的 `DIV` 运算子报错，提示使用 `/` 并说明整数除法规则
- **比较运算诊断**: 对不支援的 `==` 报错，提示等于比较使用单独的 `=`
- **语法覆盖补强**: 支援动态 M 码高亮 (`M#4`)、`=` 比较高亮、局部间接变量 `#[expr]`、动态/字符串宏调用示例

### Changed

- **补全与 Hover**: 移除不推荐短结束符的补全和 Hover 文档提示，仅保留语法兼容与诊断提醒
- **代码片段**: FOR snippet 改用推荐赋值写法 `:=`
- **文档整理**: README 与使用手册改为展示推荐写法，避免引导不推荐语法

### Fixed

- **VSIX 打包内容**: 排除本地参考 `Macro/` 目录，避免参考宏程序进入发布包

## 2.6.4 - 2026-06-26

### Fixed

- **多文档诊断防抖**: 按文档 URI 独立维护诊断 timer，避免多个打开文件互相取消诊断
- **GOTO/G65 跳转定位**: 修复 Ctrl+Click `GOTO 100` 的数字目标无法进入 Definition Provider 的问题，并限制只在目标范围内触发跳转
- **跨行块注释误报**: 修复跨行 `(* ... *)` 注释内 `IF`/`GOTO` 被语法诊断误识别的问题
- **代码片段输出**: 修复 `OPEN` 片段插入 `[, "a"]` 伪语法、`MSG` 片段带前导空格的问题

### Changed

- **控制流诊断**: 关闭关键字必须匹配当前栈顶，交叉嵌套会报明确的嵌套顺序错误
- **语法高亮同步**: 补齐 `MOD`/`&`、`AR[#n]`/`MAR[#n]`、`$1`~`$4` 的高亮规则

## 2.6.3 - 2026-06-26

### Fixed

- **代码片段 API 一致性**: 修复 14 个过时代码片段，使其与 functions.js 和技术手册一致
  - SLEEP/WAIT: 移除错误的毫秒参数，改为无参数 `SLEEP();`/`WAIT();`
  - OPEN/PRINT/CLOSE: 移除旧的"文件号"API，改为路径式 API
  - READABIT/SETABIT: 修正参数数量（3→1、3→2）
  - SYSVAR/CHKMN/PARAM/SETDRAW: 修正参数类型
  - DBSAVE/DBINSERT/DBNEW: 修正参数（文件名→索引等）
- **README 文档错误**:
  - 移除对不存在的 `STR()` 函数的引用（手册仅有 `STR2INT`）
  - 函数数量 `88+` → `60+`（实际 62）
  - 代码示例语法修正：FOR/WHILE 缺 `DO`、`X[#3*10]` 方括号运算、裸中文注释
  - 函数片段表移除不存在的 `abs/str/sqrt/random` 前缀，替换为真实片段

### Changed

- **测试用例**: "SLEEP doc mentions milliseconds" 重命名为 "SLEEP takes no parameters"，验证无参数签名
- **片段回归测试**: 新增 snippets 一致性测试，锁定 SLEEP/WAIT/OPEN/CLOSE/READABIT/SETABIT 正确签名

## 2.6.2 - 2026-06-25

### Changed

- **版本统一管理**: 移除源文件中的硬编码版本号，统一从 package.json 读取
- **文档同步**: 更新 README.md 和 CHANGELOG.md 中的版本号至 2.6.2

### Added

- **GETPR/SETPR 函数**: 添加系统参数读写函数定义
- **SLEEP 函数文档**: 完善 SLEEP() 函数说明，明确其无参数特性

### Fixed

- **SLEEP 函数签名**: 修正为 `SLEEP()`（无参数），移除了错误的毫秒参数描述
- **测试文件版本号**: 移除测试文件中的硬编码版本号注释

## 2.6.1 - 2026-06-23

### Changed

- **validator.js 重构**: 将 validateDocument 函数（约290行）按职责拆分为6个独立验证器函数
  - collectMetadata: N标签收集与%@MACRO文件头检查
  - validateChineseCharacters: 中文字符与标点检测
  - validateParentheses: 括号匹配验证
  - validateControlFlowKeyword: 控制流关键字栈操作
  - validateUnclosedBlocks: 文件结束未关闭块检查
  - validateGotoReferences: GOTO标签引用验证
- **策略模式**: 引入 LINE_VALIDATORS 数组，行级验证器可插拔扩展
- **版本号统一**: 更新至 v2.6.1

## 2.6.0 - 2026-06-23

### Added

- **机器人指令代码片段**: 新增 18 个代码片段（MOVJ/MOVL/MOVC/INCMOVJ/INCMOVL/USERCOR/OBJCORON/TOOLCOR/SKIPCOND/SWAITSIG/SYNCOUT/WEAVEON/PAUSE/GETPR/SETPR/SLEEP/M198/G66.1）
- **G 码补全**: 新增 G04.102、G68.18、G192.1、G192.2 机器人专用 G 码
- **单元测试**: 新增 6 个测试用例（机器人指令、GETPR/SETPR、新 G 码、M198、PAUSE、SLEEP 文档）
- **README 机器人指令章节**: 新增机器人指令分类表和范例

### Changed

- **README 版本同步**: 更新至 v2.6.0（版本徽章、功能表、函数数 88+、VSIX 文件名）
- **测试脚本**: 更新为运行两个测试文件（validator.test.js + extension.test.js）

### Fixed

- **跨行块注释中文字符误报**: 修复 `(* ... *)` 跨行注释内的中文字符被误报为错误的问题

## 2.5.0 - 2026-06-22

### Changed

- **版本号统一**: 统一所有源码文件版本注释为 v2.5.0
- **test 脚本**: package.json 新增 `npm test` 脚本

### Fixed

- 修复跨行块注释 `(* ... *)` 导致的括号匹配误报（`*)` 被误认为多余右括号）

### Removed

- 删除临时调试文件 `check-demo.js`
- 删除重复文档 `docs/CHANGELOG.md`（根目录 CHANGELOG.md 为唯一权威）
- 移除失效的 `build` 脚本（引用不存在的 `build/build_grammar.py`）
- 清理 `src/validator.js` 头部过时的 v1.3.6 历史注释

## 2.4.0 - 2026-06-22

### Changed

- **函数说明全部中文化**: 所有内置函数的悬停文档说明改为中文（参考《新代控制器技术参考手册》）
- **版本号统一**: 统一所有源码文件版本注释为 v2.4.0

### Fixed

- 修复 `#` 变量前显示黑色方块的问题（`editor.colorDecorators: false`）
- 修复 REPEAT/UNTIL/EXIT 嵌套语法诊断误报

## 2.3.0 - 2026-06-22

### Added

- **机器人指令完整支持** (参考《新代控制器技术参考手册》)
  - 移动指令: MOVJ, MOVL, MOVC, INCMOVJ, INCMOVL
  - 坐标系指令: USERCOR, OBJCORON/OFF/CLEAR, TOOLCOR/ON/OFF
  - 应用指令: SKIPCOND, SKIP, SWAITSIG, SYNCOUT, WEAVEON/OFF, STITCHON/OFF, POSEMAP, SHIFTON/OFF, PAUSE
  - 速度与轨迹参数: ACC, DEC, FJ, FEJ, FL, FR, PL, PQ, PR
- **新 G 码支持**
  - G04.102: 等待计时
  - G192.1/G192.2: 末端追踪
  - G68.18: 设定用户坐标系
  - G10 L 值: 可程序资料输入 (L1000, L1021, L1900, L1901, L1910, L1911, L1805)
- **G67**: 取消模式宏程序呼叫
- **M198**: 呼叫子程序 (另一路径)
- **MOD 操作符**: 模数运算支持
- **轴群辨识符号**: $1~$4 语法高亮

### Changed

- **IF 条件括号支持**: 支持无括号形式 `IF #1 = 1 THEN`
- **CASE 冒号语法**: 支持 `<值>: <语句>` 冒号分隔
- **& 操作符**: 识别为布尔 AND (与 AND 等效)
- **比较运算符警告**: 检测 GT/EQ/LT/GE/LE/NE 等新代不支持的比较符,提示使用 `<` `>` `<=` `>=` `=` `<>`

### Fixed

- 函数签名修正 (参考手册):
  - ALARM: `ALARM(code)` 或 `ALARM(code, "message")`
  - MSG: `MSG(id)` 或 `MSG("content")` 或 `MSG(id, "content")`
  - SLEEP: `SLEEP()` 无参数，暂时放弃宏程序循环执行权
  - GETPR/SETPR: `GETPR(prNumber)` 和 `SETPR(prNumber, value)`

## 2.2.0 - 2026-06-22

### Added

- 嵌套深度检测 (最高 10 层)
- 宏程序块数量检测 (最高 256 个)
- IF/WHILE/CASE 缺少 THEN/DO/OF 检测
- 行尾分号检测
- M99 结尾检测

### Fixed

- 块注释多行处理
- CASE 块验证逻辑优化

## 2.1.0 - 2026-06-22

### Added

- 代码片段模板
- 诊断防抖 (300ms)
- includePath 配置支持

## 2.0.0 - 2026-06-22

### Added

- 智能补全增强
- 悬停文档
- 代码跳转
- 实时诊断
- Outline 大纲

## 1.0.0 - 2026-06-22

### Added

- 初始版本
- 基础语法高亮
- 基本代码补全
