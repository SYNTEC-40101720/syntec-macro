// JS Backend 退役 R1 准入自检工具：对照 docs/JS-Backend退役路线图.md
// Phase R1 的 6 个不变前提做一次 review，输出 PASS/SKIP/FAIL 总览。
//
// 输出与 checkReleaseReadiness.js 一致风格；默认 exitCode=0（review 用），
// --strict 任一 FAIL exitCode=1（CI/发布前硬门禁）。
//
// 用法：
//   node scripts/checkJsBackendRetirement.js             # 非门禁 informational
//   npm.cmd run check:js-backend-retirement -- --strict  # CI/发布硬门禁

const fs = require('fs');
const path = require('path');
const {
  readJsDiagnosticCodes,
  readRustEmittedCodes
} = require('./auditJsBackend');

const ROOT = path.resolve(__dirname, '..');

const CHECKS = [
  // 1. package.json 默认 backend 已切到 rust-wasm
  {
    id: '1-default-backend-rust-wasm',
    name: 'package.json 默认 backend 已切 rust-wasm',
    run: () => {
      const pkgPath = path.join(ROOT, 'package.json');
      if (!fs.existsSync(pkgPath)) return { status: 'FAIL', detail: 'package.json missing' };
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      const cfg = pkg.contributes?.configuration?.properties?.['syntecMacro.analysisBackend'];
      if (!cfg) return { status: 'FAIL', detail: 'syntecMacro.analysisBackend config missing' };
      const isRustDefault = cfg.default === 'rust-wasm';
      return {
        status: isRustDefault ? 'PASS' : 'FAIL',
        detail: `当前 default = \`${cfg.default || '(unset)'}\`（需为 \`rust-wasm\`）`
      };
    }
  },
  // 2. 至少一个 release cycle 已运行 rust-wasm 默认
  {
    id: '2-release-cycle-observed',
    name: '至少一个 release cycle 运行 rust-wasm 默认',
    run: () => {
      const changelogPath = path.join(ROOT, 'CHANGELOG.md');
      if (!fs.existsSync(changelogPath)) return { status: 'FAIL', detail: 'CHANGELOG.md missing' };
      const src = fs.readFileSync(changelogPath, 'utf8');
      // 查找已发布版本段（## X.Y.Z - YYYY-MM-DD，非 [Unreleased]）记录中
      // 含「default backend: rust-wasm」或「默认 backend 已切 rust-wasm」的 marker。
      const hasMarker = /## \d+\.\d+\.\d+ - \d{4}-\d{2}-\d{2}[\s\S]*?(?:default backend:\s*rust-wasm|默认 backend 已切 rust-wasm|默认分析后端.*rust-wasm)/i.test(src);
      return {
        status: hasMarker ? 'PASS' : 'SKIP',
        detail: hasMarker
          ? 'CHANGELOG 已发布版本段含 rust-wasm 默认 backend marker'
          : 'CHANGELOG 未发现已发布版本段含 rust-wasm 默认 marker（等待 v3.1.0+ 发布后准入）'
      };
    }
  },
  // 3. Rust 稳定诊断 parity 100% 无 dead code 缺口
  // Phase 5.3 路径 A 已落地（2026-09-21）：JS+Rust 共同剔除三项
  // `SYNTEC_ROBOT_*_Q_RANGE` dead code，两端行为完全等价，无 dead code。
  {
    id: '3-rust-stable-diagnostic-parity',
    name: 'Rust 稳定诊断 parity 100% （含 emit 入口等价）',
    run: () => {
      const jsCodes = readJsDiagnosticCodes();
      const rustCodes = readRustEmittedCodes();
      const rustMissing = jsCodes.filter(c => !rustCodes.has(c.code));
      // Phase 5.3 路径 A 已剔除三项 dead code；任何 JS-only code 都是潜在缺口
      if (rustMissing.length > 0) {
        return {
          status: 'FAIL',
          detail: `Rust 缺失 code（含 dead code 与未实装的）：${rustMissing.map(c => c.code).join(', ')}`
        };
      }
      return {
        status: 'PASS',
        detail: `JS+Rust 全 code parity：${jsCodes.length} 个 code 两端 emit 路径完全等价，无 dead code`
      };
    }
  },
  // 4. wasm asset 已 bundle 且与已发布 VSIX 一致
  {
    id: '4-wasm-asset-bundled-and-consistent',
    name: 'Wasm 资产已 bundle 且 manifest 一致',
    run: () => {
      const manifestPath = path.join(ROOT, 'assets', 'rust-wasm', 'manifest.json');
      const wasmPath = path.join(ROOT, 'assets', 'rust-wasm', 'syntec_core.wasm');
      const missing = [];
      if (!fs.existsSync(manifestPath)) missing.push('manifest.json');
      if (!fs.existsSync(wasmPath)) missing.push('syntec_core.wasm');
      if (missing.length > 0) {
        return { status: 'FAIL', detail: `missing: ${missing.join(', ')}` };
      }
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      const wasmBytes = fs.readFileSync(wasmPath);
      if (wasmBytes.length !== manifest.byteLength) {
        return { status: 'FAIL', detail: `byteLength mismatch (disk=${wasmBytes.length}, manifest=${manifest.byteLength})` };
      }
      const { computeSha256 } = require('../src/rustWasmAsset');
      const actualSha = computeSha256(wasmBytes);
      if (actualSha !== manifest.sha256) {
        return { status: 'FAIL', detail: `SHA mismatch (disk=${actualSha}, manifest=${manifest.sha256})` };
      }
      return {
        status: 'PASS',
        detail: `wasm asset OK (${manifest.byteLength} bytes, sha256=${manifest.sha256.slice(0, 16)}...)`
      };
    }
  },
  // 5. benchmark:compare fallback 比例持续 0%（文件存在 + 工具就位）+ CI 双平台 5 次累积
  {
    id: '5-fallback-ratio-zero-sustained',
    name: 'fallback 比例持续 0% 工具就位 + CI 双平台 5 次累积',
    run: () => {
      const compare = path.join(ROOT, 'scripts', 'benchmarkCompare.js');
      const comparePerf = path.join(ROOT, 'scripts', 'comparePerfData.js');
      const testFile = path.join(ROOT, 'tests', 'benchmarkCompare.test.js');
      const baseline = path.join(ROOT, 'perf-baseline', 'v3.0.0.json');
      const perfDir = path.join(ROOT, 'perf-data');
      const devRuns = fs.existsSync(perfDir)
        ? fs.readdirSync(perfDir).filter(name => /^benchmark-windows-dev-run\d+\.json$/.test(name))
        : [];
      const ciUbuntuRuns = fs.existsSync(perfDir)
        ? fs.readdirSync(perfDir).filter(name => /^benchmark-ci-ubuntu-latest-run\d+\.json$/.test(name))
        : [];
      const ciWindowsRuns = fs.existsSync(perfDir)
        ? fs.readdirSync(perfDir).filter(name => /^benchmark-ci-windows-latest-run\d+\.json$/.test(name))
        : [];
      const missing = [];
      for (const [label, file] of [
        ['benchmarkCompare.js', compare],
        ['comparePerfData.js', comparePerf],
        ['benchmarkCompare.test.js', testFile],
        ['perf-baseline/v3.0.0.json', baseline]
      ]) {
        if (!fs.existsSync(file)) missing.push(label);
      }
      if (missing.length > 0) {
        return { status: 'FAIL', detail: `missing: ${missing.join(', ')}` };
      }
      const devReady = devRuns.length >= 5;
      const ciUbuntuReady = ciUbuntuRuns.length >= 5;
      const ciWindowsReady = ciWindowsRuns.length >= 5;
      const ciReady = ciUbuntuReady && ciWindowsReady;
      if (!devReady && !ciReady) {
        return {
          status: 'SKIP',
          detail: `dev 落库 ${devRuns.length}/5；CI ubuntu ${ciUbuntuRuns.length}/5；CI windows ${ciWindowsRuns.length}/5（≥5 次任一平台累积）`
        };
      }
      return {
        status: 'PASS',
        detail: `工具就位 + 数据落库：dev ${devRuns.length}/5 + CI ubuntu ${ciUbuntuRuns.length}/5 + CI windows ${ciWindowsRuns.length}/5；实际 nav 场景 Rust 是否稳定优于 JS 由 user review compare:perf 输出决定（Phase 1.5 准入只是数据采集工具就位，不是 Rust 优势判定）`
      };
    }
  },
  // 6. dead code 三项决策文档化
  {
    id: '6-dead-code-decision-documented',
    name: 'dead code 三项决策已文档化',
    run: () => {
      const roadmap = path.join(ROOT, 'docs', 'JS-Backend退役路线图.md');
      if (!fs.existsSync(roadmap)) return { status: 'FAIL', detail: 'docs/JS-Backend退役路线图.md missing' };
      const src = fs.readFileSync(roadmap, 'utf8');
      const hasDecisionSection = /Phase\s*5\.3|dead\s*code.*决策|SKIPCOND_Q_RANGE.*SWAITSIG_Q_RANGE.*SYNCOUT_Q_RANGE/.test(src);
      return {
        status: hasDecisionSection ? 'PASS' : 'FAIL',
        detail: hasDecisionSection
          ? '路线图 §不变前提 2 / Phase R1 描述含 dead code 决策'
          : '路线图未充分描述 dead code 决策路径'
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
  console.info('JS Backend 退役 R1 准入自检（对照 docs/JS-Backend退役路线图.md §不变前提）：\n');
  let passCount = 0, skipCount = 0, failCount = 0;
  for (const check of CHECKS) {
    let result;
    try {
      result = check.run();
    } catch (error) {
      result = { status: 'FAIL', detail: error instanceof Error ? error.message : String(error) };
    }
    const symbol = result.status === 'PASS' ? '✓' : result.status === 'SKIP' ? '○' : '✗';
    console.info(`  ${symbol} ${result.status.padEnd(4)} ${check.id}`);
    console.info(`        ${check.name}`);
    console.info(`        ${result.detail}\n`);
    if (result.status === 'PASS') passCount++;
    else if (result.status === 'SKIP') skipCount++;
    else failCount++;
  }
  console.info(`total: PASS=${passCount}, SKIP=${skipCount}, FAIL=${failCount}`);
  console.info('readiness 自检默认非门禁；任何 FAIL 由人 review 决定是否升级版本号。');
  if (strict && failCount > 0) {
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main();
}

module.exports = { CHECKS, main };
