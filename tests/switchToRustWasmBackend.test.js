// Phase 1.5 切换辅助脚本 switchToRustWasmBackend.js 的纯函数单测。
// 不覆盖 runPreFlightChecks (spawn 子进程，需本地 CLI 环境)，只测
// applyPackageJsonEdits / applyLockEdits / applyReadmeEdits / applyChangelogEdits
// 这些有界变换的字符串/对象契约。

const assert = require('node:assert');
const { test } = require('node:test');
const {
  NEW_VERSION,
  applyPackageJsonEdits,
  applyLockEdits,
  applyReadmeEdits,
  applyChangelogEdits
} = require('../scripts/switchToRustWasmBackend');

test('NEW_VERSION is 3.1.0 (Phase 1.5 目标版本)', () => {
  assert.strictEqual(NEW_VERSION, '3.1.0');
});

test('applyPackageJsonEdits sets version + default + enumDescriptions + description', () => {
  const pkg = {
    version: '3.0.0',
    contributes: {
      configuration: {
        properties: {
          'syntecMacro.analysisBackend': {
            type: 'string',
            enum: ['javascript', 'rust-wasm-shadow', 'rust-wasm'],
            default: 'javascript',
            enumDescriptions: ['old1', 'old2', 'old3'],
            description: 'old desc'
          }
        }
      }
    }
  };
  applyPackageJsonEdits(pkg);
  assert.strictEqual(pkg.version, '3.1.0');
  const cfg = pkg.contributes.configuration.properties['syntecMacro.analysisBackend'];
  assert.strictEqual(cfg.default, 'rust-wasm');
  assert.ok(/fallback/i.test(cfg.enumDescriptions[0]), 'JS enumDescription 应说明 fallback');
  assert.ok(/Rust\/Wasm analyzer.*默认.*v3\.1\.0/s.test(cfg.enumDescriptions[2]),
    'rust-wasm enumDescription 应说明默认后端 + 版本号');
  assert.ok(/默认 rust-wasm/.test(cfg.description), 'description 应说明默认 rust-wasm');
});

test('applyPackageJsonEdits throws 如果 analysisBackend 配置缺失', () => {
  const pkg = { version: '3.0.0', contributes: { configuration: { properties: {} } } };
  assert.throws(() => applyPackageJsonEdits(pkg), /syntecMacro\.analysisBackend config missing/);
});

test('applyLockEdits sets top-level version + packages[""].version', () => {
  const lock = {
    version: '3.0.0',
    packages: {
      '': { version: '3.0.0' },
      'other-pkg': { version: '1.0.0' }
    }
  };
  applyLockEdits(lock);
  assert.strictEqual(lock.version, '3.1.0');
  assert.strictEqual(lock.packages[''].version, '3.1.0');
  // 其他包版本号不动
  assert.strictEqual(lock.packages['other-pkg'].version, '1.0.0');
});

test('applyLockEdits tolerates lock 缺 packages', () => {
  const lock = { version: '3.0.0' };
  applyLockEdits(lock);
  assert.strictEqual(lock.version, '3.1.0');
});

test('applyReadmeEdits replaces all 3.0.0 occurrences with 3.1.0', () => {
  const readme = 'Badge v3.0.0\nInstall: npm i syntec-macro@3.0.0\nDocs at 3.0.0\nOther 3.0.1 should stay';
  const out = applyReadmeEdits(readme);
  assert.strictEqual(out, 'Badge v3.1.0\nInstall: npm i syntec-macro@3.1.0\nDocs at 3.1.0\nOther 3.0.1 should stay');
});

test('applyChangelogEdits releases [Unreleased] to dated version header + new [Unreleased]', () => {
  const today = new Date().toISOString().slice(0, 10);
  const changelog = '## [Unreleased]\n\n### Added\n\n- placeholder item\n\n## 3.0.0 - 2026-09-20\n\n### Changed\n\n- old';
  const out = applyChangelogEdits(changelog);
  // 新 ## 3.1.0 - today 段已写
  assert.ok(out.includes(`## 3.1.0 - ${today}`), 'should contain dated 3.1.0 header');
  // 包含 Phase 1.5 切换条目
  assert.ok(/Phase 1\.5.*默认 backend 切换为 rust-wasm/.test(out), 'should contain Phase 1.5 changelog entry');
  // 新空 [Unreleased] 段已写
  assert.ok(out.includes('## [Unreleased]\n\n### Added\n\n- '), 'should contain new empty [Unreleased] segment');
  // 旧的 ## 3.0.0 段保留
  assert.ok(out.includes('## 3.0.0 - 2026-09-20'), 'should preserve historical 3.0.0 section');
});
