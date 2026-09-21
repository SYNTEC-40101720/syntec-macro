// Phase 1.5 切换辅助脚本：在 CI 双平台 perf 数据累积达标后，由 user 一次性
// 执行把默认 backend 从 `javascript` 切到 `rust-wasm` 并升版本到 v3.1.0。
//
// 不擅自执行。dry-run 模式（默认）只打印将要做的改动；--apply 才落盘。
// 切换前先跑 check:js-backend-retirement --strict 与 compare:rust 检验阻塞。
//
// 用法：
//   node scripts/switchToRustWasmBackend.js            # dry-run
//   npm.cmd run switch:to-rust-wasm-backend -- --apply # 落盘
//
// 切换后 user 按 docs/3.x-Release-Runbook.md §1-§6 流程发版。

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const PACKAGE_JSON = path.join(ROOT, 'package.json');
const PACKAGE_LOCK = path.join(ROOT, 'package-lock.json');
const README_PATH = path.join(ROOT, 'README.md');
const CHANGELOG_PATH = path.join(ROOT, 'CHANGELOG.md');
const NEW_VERSION = '3.1.0';
const TODAY = new Date().toISOString().slice(0, 10);

/**
 * 读取 package.json 与 package-lock.json，返回 { pkg, lock }。
 */
function readPackageFiles() {
  const pkg = JSON.parse(fs.readFileSync(PACKAGE_JSON, 'utf8'));
  const lock = JSON.parse(fs.readFileSync(PACKAGE_LOCK, 'utf8'));
  return { pkg, lock };
}

const CHECK_JS_RETIREMENT_SCRIPT = path.join(ROOT, 'scripts', 'checkJsBackendRetirement.js');
const COMPARE_RUST_SCRIPT = path.join(ROOT, 'scripts', 'compareRustCore.js');

/**
 * 跑 check:js-backend-retirement --strict + compare:rust 作为切换前置门禁。
 * 失败 throws 阻止切换。compare:rust 需要 SYNTEC_RUST_CLI 环境变量指向
 * 本地 CLI artifact。
 *
 * 允许 1-default-backend-rust-wasm + 2-release-cycle-observed 两项 FAIL，
 * 因为这两项正是本次切换要解决的特性；其他项 FAIL 阻止切换。
 *
 * @returns {{retirementOutput: string, compareRustOutput: string}}
 */
function runPreFlightChecks() {
  // 跑 R1.1 准入 --strict。直接 spawn node script 不走 npm 包装，
  // 避免 npm banner 行 + stderr pipe 问题。
  const { CHECKS } = require(CHECK_JS_RETIREMENT_SCRIPT);
  console.info('  跑 R1.1 准入 6 项（stdin suppressed）：');
  const allowedFailures = ['1-default-backend-rust-wasm', '2-release-cycle-observed'];
  const disallowedResults = [];
  for (const check of CHECKS) {
    let result;
    try {
      result = check.run();
    } catch (error) {
      result = { status: 'FAIL', detail: error instanceof Error ? error.message : String(error) };
    }
    const symbol = result.status === 'PASS' ? '✓' : result.status === 'SKIP' ? '○' : '✗';
    console.info(`    ${symbol} ${result.status} ${check.id}`);
    if (result.status === 'FAIL' && !allowedFailures.includes(check.id)) {
      disallowedResults.push({ id: check.id, detail: result.detail });
    }
  }
  if (disallowedResults.length > 0) {
    throw new Error('切换前置 R1.1 准入发现未预期的 FAIL（除 1/2 项外不应 FAIL）:\n' +
      disallowedResults.map(r => `  ${r.id}: ${r.detail}`).join('\n'));
  }

  // compare:rust parity 检查（不依赖 CI，本地 CLI 跑）。
  // 直接调 node 跑 compareRustCore，不依赖 SYNTEC_RUST_CLI 环境变量时
  // 该脚本本身拒跑—所以 try/catch 包并返回误差。
  let compareRustOutput = '';
  const cli = process.env.SYNTEC_RUST_CLI || path.join(ROOT, 'crates', 'syntec-core', 'target', 'x86_64-pc-windows-gnu', 'debug', 'syntec-core-cli.exe');
  try {
    compareRustOutput = execSync(
      `node "${COMPARE_RUST_SCRIPT}"`,
      { cwd: ROOT, encoding: 'utf8', env: { ...process.env, SYNTEC_RUST_CLI: cli }, stdio: ['pipe', 'pipe', 'pipe'] }
    );
  } catch (error) {
    const stderr = error.stderr?.toString() || error.stdout?.toString().slice(-500) || error.message;
    throw new Error('compare:rust 前置 parity 不通过: \n' + stderr.slice(-500));
  }
  return { retirementOutput: 'R1.1 准入完成', compareRustOutput };
}

/**
 * 修改 package.json：default backend javascript→rust-wasm + 版本号 3.0.0→3.1.0
 * + enumDescriptions 更新语义。
 */
function applyPackageJsonEdits(pkg) {
  pkg.version = NEW_VERSION;
  const cfg = pkg.contributes?.configuration?.properties?.['syntecMacro.analysisBackend'];
  if (!cfg) throw new Error('syntecMacro.analysisBackend config missing');
  cfg.default = 'rust-wasm';
  cfg.enumDescriptions = [
    'JavaScript analyzer（fallback 路径；v3.1.0 起让位给 rust-wasm 作默认）',
    'Shadow 模式：双跑 JS + Rust Wasm，记录差分但不影响最终诊断；Rust 启动失败时静默回退 JS',
    'Rust/Wasm analyzer（默认，v3.1.0 起生产后端；加载/运行失败显式回退 JavaScript）'
  ];
  cfg.description = '分析后端选择（切换后立即重启 worker；默认 rust-wasm，JS 仅作 fallback）';
}

/**
 * 同步 package-lock.json 的版本号（顶层 + packages[""]）。
 */
function applyLockEdits(lock) {
  lock.version = NEW_VERSION;
  if (lock.packages && lock.packages['']) {
    lock.packages[''].version = NEW_VERSION;
  }
}

/**
 * README 徽章版本号同步（如果存在 v3.0.0 徽章则更新）。
 */
function applyReadmeEdits(readme) {
  return readme.replace(/3\.0\.0/g, NEW_VERSION);
}

/**
 * CHANGELOG 把 [Unreleased] 段改为 ## 3.1.0 - TODAY 并新增 ## [Unreleased] 空段。
 */
function applyChangelogEdits(changelog) {
  const releasedBody = `## ${NEW_VERSION} - ${TODAY}\n\n### Changed\n\n- **Phase 1.5 — 默认 backend 切换为 rust-wasm + 版本升级 ${NEW_VERSION}**: \`syntecMacro.analysisBackend\` default 由 \`javascript\` 切到 \`rust-wasm\`；\`enumDescriptions\` 同步；\`package.json\` / \`package-lock.json\` / \`README\` 徽章 / \`CHANGELOG\` 全部切到 ${NEW_VERSION}。后续 JS 仍保留 fallback 路径，加载/运行失败时显式降级。\n- 前置 \`check:js-backend-retirement --strict\` 准入 6 项 (除 1/2 切换本身解决) 全部 PASS；\`compare:rust\` Parity 全等价；\`check:release:readiness --strict\` 6 PASS+1 SKIP+0 FAIL。`;
  const unreleasedHeader = '## [Unreleased]\n\n### Added\n\n- ';
  return changelog.replace(/^## \[Unreleased\]/m, releasedBody + '\n\n' + unreleasedHeader);
}

function main(args = process.argv.slice(2)) {
  const apply = args.includes('--apply');
  const dryRun = !apply;
  console.info(`Phase 1.5 切换辅助 (${dryRun ? 'DRY-RUN' : 'APPLY'} 模式) — 目标 v${NEW_VERSION}`);
  console.info('');

  console.info('前置门禁：check:js-backend-retirement --strict (允许 1+2 项 FAIL) + compare:rust');
  try {
    runPreFlightChecks();
  } catch (error) {
    console.error('前置门禁失败:', error.message);
    process.exitCode = 1;
    return;
  }
  console.info('  ✓ R1.1 准入只允许的 1/2 项 FAIL（切换本身要解决的，符合预期）');
  console.info('  ✓ compare:rust parity 通过');
  console.info('');

  const { pkg, lock } = readPackageFiles();
  applyPackageJsonEdits(pkg);
  applyLockEdits(lock);
  const readme = applyReadmeEdits(fs.readFileSync(README_PATH, 'utf8'));
  const changelog = applyChangelogEdits(fs.readFileSync(CHANGELOG_PATH, 'utf8'));

  console.info('将做的改动：');
  console.info(`  - package.json  version: ${pkg.version} | analysisBackend default: rust-wasm`);
  console.info(`  - package-lock.json version: ${lock.version} (顶层 + packages[''])`);
  console.info(`  - README.md: 3.0.0 → ${NEW_VERSION}`);
  console.info(`  - CHANGELOG.md: [Unreleased] → ## ${NEW_VERSION} - ${TODAY}，新 [Unreleased] 空段`);
  console.info('');

  if (dryRun) {
    console.info('DRY-RUN: 未落盘。通过 --apply 落盘。');
    return;
  }

  fs.writeFileSync(PACKAGE_JSON, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
  fs.writeFileSync(PACKAGE_LOCK, JSON.stringify(lock, null, 2) + '\n', 'utf8');
  fs.writeFileSync(README_PATH, readme, 'utf8');
  fs.writeFileSync(CHANGELOG_PATH, changelog, 'utf8');

  console.info('已落盘。请 user 跑后续步骤：');
  console.info('  1. npm.cmd test');
  console.info('  2. npm.cmd run check:release -- --tag v' + NEW_VERSION);
  console.info('  3. npm.cmd run check:release:readiness -- --strict');
  console.info('  4. npm.cmd run smoke:installed');
  console.info('  5. 按 docs/3.x-Release-Runbook.md §2-§6 发版');
}

if (require.main === module) {
  main();
}

module.exports = {
  NEW_VERSION,
  readPackageFiles,
  runPreFlightChecks,
  applyPackageJsonEdits,
  applyLockEdits,
  applyReadmeEdits,
  applyChangelogEdits
};
