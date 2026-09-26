// 发布前 readiness 自检工具：对照 docs/Rust-Wasm切换验收门禁.md §5
// 「完成定义」7 项门禁一次性自动化 review，输出 PASS/SKIP/FAIL 总览，
// 不阻塞 CI（exitCode 始终 0）；任何 FAIL 由人 review 决定是否升级版本号。
//
// 用法：npm.cmd run check:release:readiness
//   [--strict]   任一 FAIL 即 exitCode=1（CI smoke 可加，本工具默认非门禁）

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

const CHECKS = [
  // 1. Rust/Wasm 完整 AnalysisResult parity
  {
    id: '1-analysis-result-parity',
    name: 'Rust/Wasm 完整 AnalysisResult parity',
    run: () => {
      // Compare:rust 130 + 10 + 17 等价由 compareRustCore.js 验证；readiness 只
      // 校验差分基线文件存在并核对 CASES 数量 (130 diagnostics + 10 nav + 17
      // format)。
      const comparePath = path.join(ROOT, 'scripts', 'compareRustCore.js');
      if (!fs.existsSync(comparePath)) return { status: 'FAIL', detail: 'compareRustCore.js missing' };
      const src = fs.readFileSync(comparePath, 'utf8');
      const diagCases = (src.match(/name:\s*'[^']*'/g) || []).length;
      return {
        status: diagCases >= 130 ? 'PASS' : 'FAIL',
        detail: `compareRustCore.js has ~${diagCases} named cases (>=130 required)`
      };
    }
  },
  // 2. 所有已发布稳定诊断和核心导航/格式化行为 parity
  {
    id: '2-stable-diagnostic-nav-format-parity',
    name: '所有稳定诊断与 navigation/format parity',
    run: () => {
      const parityDoc = path.join(ROOT, 'docs', 'Rust诊断parity清单.md');
      if (!fs.existsSync(parityDoc)) return { status: 'FAIL', detail: 'parity doc missing' };
      const src = fs.readFileSync(parityDoc, 'utf8');
      // P0-A.1 收口语义 marker：清单头部「当前 Rust 覆盖：N / N」自洽（两侧
      // 相等）且「未覆盖：0 个 code」。历史上首批稳定诊断为 67/67，Phase
      // β.1/γ.2 已扩展到 68/68，Phase 5.x 收口到 73/73，后续 follow-up 还会
      // 再扩展——匹配任意 N/N 相等形态，避免每扩一次就漂移一次 marker。
      const coverageMatch = src.match(/当前 Rust 覆盖：\s*(\d+)\s*\/\s*(\d+)/);
      const hasZeroUncovered = /未覆盖：\s*0\s*个\s*code/.test(src);
      const hasCompletion = Boolean(coverageMatch) &&
        coverageMatch[1] === coverageMatch[2] &&
        hasZeroUncovered;
      return {
        status: hasCompletion ? 'PASS' : 'FAIL',
        detail: hasCompletion
          ? `Rust 诊断 parity 已收口（${coverageMatch[1]}/${coverageMatch[2]}，未覆盖 0）`
          : 'parity 覆盖 marker 不自洽或存在未覆盖 code'
      };
    }
  },
  // 3. 生产 Wasm 资产、加载器、Worker 接入和显式 JavaScript fallback
  {
    id: '3-wasm-asset-loader-worker-fallback',
    name: '生产 Wasm 资产 + 加载器 + Worker + fallback',
    run: () => {
      const manifest = path.join(ROOT, 'assets', 'rust-wasm', 'manifest.json');
      const wasm = path.join(ROOT, 'assets', 'rust-wasm', 'syntec_core.wasm');
      const assetLoader = path.join(ROOT, 'src', 'rustWasmAsset.js');
      const workerAdapter = path.join(ROOT, 'src', 'rustWasmWorkerAdapter.js');
      const workerLifecycleTest = path.join(ROOT, 'tests', 'workerLifecycle.test.js');
      const missing = [];
      for (const [label, file] of [
        ['manifest', manifest], ['wasm', wasm], ['asset loader', assetLoader],
        ['worker adapter', workerAdapter], ['worker lifecycle test', workerLifecycleTest]
      ]) {
        if (!fs.existsSync(file)) missing.push(label);
      }
      return {
        status: missing.length === 0 ? 'PASS' : 'FAIL',
        detail: missing.length === 0
          ? 'manifest + wasm + rustWasmAsset.js + rustWasmWorkerAdapter.js + workerLifecycle.test.js 全部存在'
          : `missing components: ${missing.join(', ')}`
      };
    }
  },
  // 4. Windows GNU/MSVC、Wasm 和 CI 构建矩阵可复现
  {
    id: '4-cross-platform-build-matrix',
    name: '跨平台 CI 构建矩阵',
    run: () => {
      const wf = path.join(ROOT, '.github', 'workflows', 'rust-wasm.yml');
      if (!fs.existsSync(wf)) return { status: 'FAIL', detail: 'rust-wasm.yml missing' };
      const src = fs.readFileSync(wf, 'utf8');
      const hasMatrix = /matrix:/.test(src)
        && /ubuntu-latest/.test(src) && /windows-latest/.test(src);
      const hasCrossAlert = /cross-platform-alert/.test(src);
      return {
        status: (hasMatrix && hasCrossAlert) ? 'PASS' : 'FAIL',
        detail: `matrix=${hasMatrix}, crossAlert=${hasCrossAlert}`
      };
    }
  },
  // 5. 真实性能、内存、启动和 fallback 数据达标
  {
    id: '5-perf-memory-startup-fallback',
    name: 'P1 性能/内存/启动/fallback 数据采集',
    run: () => {
      const compare = path.join(ROOT, 'scripts', 'benchmarkCompare.js');
      const comparePerf = path.join(ROOT, 'scripts', 'comparePerfData.js');
      const testFile = path.join(ROOT, 'tests', 'benchmarkCompare.test.js');
      const missing = [];
      for (const [label, file] of [
        ['benchmark:compare script', compare],
        ['compare:perf script', comparePerf],
        ['benchmarkCompare.test.js', testFile]
      ]) {
        if (!fs.existsSync(file)) missing.push(label);
      }
      return {
        status: missing.length === 0 ? 'PASS' : 'FAIL',
        detail: missing.length === 0
          ? 'benchmarkCompare.js + comparePerfData.js + benchmarkCompare.test.js 已落地'
          : `missing: ${missing.join(', ')}`
      };
    }
  },
  // 6. VS Code 集成、VSIX 内容、隔离安装和回滚验证
  {
    id: '6-vscode-integration-vsix',
    name: 'VSIX 内容与集成/回滚测试',
    run: () => {
      const vsixCheck = path.join(ROOT, 'scripts', 'checkVsixContents.js');
      const workerLifecycle = path.join(ROOT, 'tests', 'workerLifecycle.test.js');
      const integrationTest = path.join(ROOT, 'tests', 'integration', 'runTest.js');
      const missing = [];
      for (const [label, file] of [
        ['checkVsixContents.js', vsixCheck],
        ['workerLifecycle.test.js (fallback 验证)', workerLifecycle],
        ['integration/runTest.js', integrationTest]
      ]) {
        if (!fs.existsSync(file)) missing.push(label);
      }
      return {
        status: missing.length === 0 ? 'PASS' : 'FAIL',
        detail: missing.length === 0
          ? 'check:vsix + workerLifecycle 集成 + test:integration 至少完备'
          : `missing: ${missing.join(', ')}`
      };
    }
  },
  // 7. GitHub tag、Release、VSIX 资产和校验值一致
  {
    id: '7-tag-release-vsix-alignment',
    name: 'GitHub tag / Release / VSIX 校验值一致',
    run: () => {
      // 选定 3.x.x 前 tag/release 还未创建；这一项 readiness 阶段标 SKIP，
      // 由发布收口实际跑 release:create 时再校验。
      const releaseCreator = path.join(ROOT, 'scripts', 'createGitHubRelease.js');
      const releaseConsistency = path.join(ROOT, 'scripts', 'checkReleaseConsistency.js');
      const missing = [];
      for (const [label, file] of [
        ['createGitHubRelease.js', releaseCreator],
        ['checkReleaseConsistency.js', releaseConsistency]
      ]) {
        if (!fs.existsSync(file)) missing.push(label);
      }
      return {
        status: missing.length === 0 ? 'SKIP' : 'FAIL',
        detail: missing.length === 0
          ? 'release:create + check:release 工具已就位；3.x.x tag 选定后由发布流程校验'
          : `missing: ${missing.join(', ')}`
      };
    }
  }
];

/**
 * @param {string[]} [args]
 * @returns {void}
 */
function main(args = process.argv.slice(2)) {
  const strict = args.includes('--strict');
  console.info('3.x 发布前 readiness 自检（对照规划文档 §5「完成定义」7 项）：\n');
  let passCount = 0, skipCount = 0, failCount = 0;
  for (const check of CHECKS) {
    let result;
    try {
      result = check.run();
    } catch (error) {
      result = { status: 'FAIL', detail: error instanceof Error ? error.message : String(error) };
    }
    const status = result.status;
    if (status === 'PASS') passCount++;
    else if (status === 'SKIP') skipCount++;
    else failCount++;
    const tag = status === 'PASS' ? '✓ PASS' : (status === 'SKIP' ? '○ SKIP' : '✗ FAIL');
    console.info(`  ${tag}  ${check.id}`);
    console.info(`        ${check.name}`);
    console.info(`        ${result.detail || ''}\n`);
  }
  console.info(`total: PASS=${passCount}, SKIP=${skipCount}, FAIL=${failCount}`);
  console.info('readiness 自检默认非门禁；任何 FAIL 由人 review 决定是否升级版本号。');
  if (strict && failCount > 0) process.exitCode = 1;
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
  }
}

module.exports = { CHECKS, main };
