# 架构说明（ARCHITECTURE）

> 面向新接手者的一页式架构图景：Rust core → Wasm → host/worker 双路径 → VS Code provider 的调用链路与数据流。规则沉淀看 [新代 MACRO 语法规范手册](新代MACRO语法规范手册.md)；接续工作与发布流程看 [开发交接说明](开发交接说明.md)。本文档状态基线：v4.2.x（2026-09-26，R1.2 单后端化清理后）。

## 总览

```text
┌────────────────────────── VS Code Extension Host ──────────────────────────┐
│  extension.js (activate: init + 注册 provider)                              │
│                                                                            │
│  ① 纯 JS 数据表路径（无分析器）      ② Host 同步 Rust 路径                   │
│  ┌──────────────────────────┐      ┌────────────────────────────────────┐  │
│  │ completionProvider       │      │ navigationProvider  ┐               │  │
│  │ hoverProvider            │      │ formattingProvider  ┴→ hostRustAnalyzer.js │
│  │ definitionProvider       │      │   ↓ getHostRustAnalyzer() (sync, 未就绪→null) │
│  │   （数据表 + fileResolver│      │   ↓ createNavOnlyAdapter(file) (nav-only ABI) │
│  │    FS 搜索，Rust 无关） │      │ rustWasmAdapter.js ←─ rustWasmAsset.js │  │
│  └──────────────────────────┘      └────────────────────────────────────┘  │
│                                                                            │
│  ③ Worker 异步 Rust 路径（诊断）                                            │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │ diagnosticsProvider (防抖 300ms, 竞态取消, Quick Fix)                 │  │
│  │   → worker_threads → validatorWorker.js (LRU 8 槽缓存)                │  │
│  │   → rustWasmWorkerAdapter.js → rustWasmAdapter.js ←─ rustWasmAsset.js │ │
│  │   ← control 消息(log) → workerLogSink → "Syntec Macro Worker" 输出通道 │  │
│  └────────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────────┘
        │ 所有 Rust 调用都指向同一生产资产
        ▼
assets/rust-wasm/{manifest.json, syntec_core.wasm}
  └─ manifest: SHA-256 + byteLength + 必需 exports（含 request/nav ABI）
        ▲ 由 scripts/buildRustWasmAsset.js 从 crates/syntec-core 构建产物生成
```

## 三条数据通路

### ① 纯 JS 数据表（无分析器参与）
补全/悬停/跳转定义不走 Rust：`src/data/*.json`（函数、G/M 代码、系统变量、关键词）经 thin loader（`functions.js` 等，mtime-aware 只读缓存）读出，`definitionProvider` 用 `fileResolver` 做 FS 候选路径搜索。这些是**数据不是分析逻辑**；分析逻辑全部在 Rust。

### ② Host 同步路径（格式化 / 符号导航 / 引用）
`extension.js::activate` 调一次 `initHostRustAnalyzer()`（异步、不阻塞 activate，失败仅 console.warn）加载 wasm 并缓存同步 adapter。provider 同步调 `getHostRustAnalyzer()`，**未就绪时返回 null → provider 返空 edits/symbols**（不回退 JS——JS 分析器已随 R1.2 退役，这是验收门禁 §3.1 的不变约束）。

- `formattingProvider`：主分析 ABI
- `navigationProvider` 同步路径（文档符号）：主分析 ABI
- `navigationProvider` 异步 nav batch（工作区符号/引用）：`createNavOnlyAdapter(filePath)` 走 **nav-only ABI**（`syntec_core_analyze_navigation_json`，跳过 diagnostics+formatter，快 4-6 倍），并发 32 收集工作区导航索引，`navigationIndexCache` 按文档 version / 文件 mtime+size 签名缓存

### ③ Worker 异步路径（诊断）
`diagnosticsProvider` 防抖 300ms 后把 `AnalysisRequest` 发给 `validatorWorker.js`（`worker_threads` 独立线程，避免大文件分析阻塞 Extension Host）。worker 内 LRU 8 槽缓存按 `protocolVersion+profile+uri+version+text` 精确命中。wasm 加载失败 → worker reject + control 日志 → host 侧跳过本轮诊断（不崩、不回退）。worker 的控制日志（如 wasm 加载失败原因）经 `workerLogSink` 转发到 `Syntec Macro Worker` OutputChannel——**排障第一步看这里**。

## Wasm ABI 层（rustWasmAdapter.js）

生产 adapter 只走两条 ABI，输入输出都是完整 `AnalysisRequest`/`AnalysisResult` JSON（P0-B 协议，`analysisProtocol.js` 定义形状并校验）：

| ABI | 用途 | 消费方 |
| --- | --- | --- |
| `syntec_core_analyze_request_json` | 全量分析（diagnostics+symbols+edits+navigation） | host 主路径、worker 诊断 |
| `syntec_core_analyze_navigation_json` | 仅导航索引（轻量） | nav batch |

内存约定：JS 侧 `syntec_core_alloc` 写入 → Rust 返回 packed (pointer<<32|len) u64 → JS 读出后 `syntec_core_free_output`/`dealloc`。返回 0 = 请求被拒，adapter 显式抛错（不静默补形状）。

`syntec_core_analyze_json`（旧 text-only ABI）生产 adapter **不再消费**，仅 probe/benchmark 脚本直接调用，crate 侧保留导出。

## 资产链路与完整性

```
crates/syntec-core (rlib + cdylib, bin: syntec-core-cli)
  → cargo build --release --target wasm32-unknown-unknown
  → scripts/buildRustWasmAsset.js 拷贝到 assets/rust-wasm/ + 生成 manifest
     (REQUIRED_EXPORTS 含 memory/alloc/dealloc/free_output + 三个分析 ABI)
  → rustWasmAsset.js 运行时校验: manifest 形状 → byteLength → SHA-256 →
     instantiate → 必需 exports 逐一比对；失败抛 RustWasmAssetError(reason)
  → 打包: .vscodeignore 保证 assets/ 进 VSIX、scripts/ 不进
```

host 与 worker 用同一 `DEFAULT_MANIFEST_PATH`，字节级同源（同一 SHA）。nav ABI 现已列入 REQUIRED_EXPORTS——缺失会在资产校验时就失败，而不是静默空导航。

## Rust 核心（crates/syntec-core）

`lib.rs` 单文件实现词法、诊断、格式化、导航索引；`bin/syntec-core-cli.rs` 是同核心的 CLI 包装（parity golden file 比对、基准采样用）。Wasm 与 CLI 只是同一 rlib 的两个入口，语义由 `tests/fixtures/rust-parity-baseline.json` golden file 守卫（`npm run compare:rust`）——R1.2 后无 JS 真源，golden file 是唯一语义回归防线。

## 测试与门禁层次

| 层 | 内容 | 命令 |
| --- | --- | --- |
| 单元/契约 | 29 个测试文件：协议形状、adapter/asset/worker、各 provider、pathResolver、数据表、治理脚本自身 | `npm test` |
| 集成 | 真 VS Code（test-electron）：诊断/符号/格式化端到端 | `npm run test:integration` |
| Rust 矩阵 CI | ubuntu+windows 构建 wasm + 资产校验 + parity 比对 + probe + benchmark | `.github/workflows/rust-wasm.yml` |
| 性能门禁 | 每平台与 `perf-baseline/ci/<os>.json` 比对，p50/nav 回归 >10% 或 fallback>0 即 fail（`--strict`） | 同上（gate 步骤） |
| 发布门禁 | release 一致性 / VSIX 内容 / readiness（--strict 硬门禁在 release.yml） | `npm run check:*` |

本地一条命令：`npm run check:all`（= test + lint）。

## 历史包袱（勿再引入）

- JS 分析器（analysisCore/lexer/validator 等 12 模块）已删，**禁止重新引入任何 JS fallback 分析路径**（门禁 §3.1）
- 双后端选择链（`syntecMacro.analysisBackend` 配置、worker backend 传参、`defer-js` policy）已删——rust-wasm 是唯一后端，无选择
- shadow 双跑差分模式（R1.2 Stage B 前）已删
- 老 perf-baseline（v3.0.0/v4.0.0）含 JS 对照字段，仅作历史归档，不可改写

变更架构时同步更新本文档与 [开发交接说明](开发交接说明.md) 的「当前架构入口」。
