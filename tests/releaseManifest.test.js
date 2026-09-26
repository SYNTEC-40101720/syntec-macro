// releaseManifest.test.js
// 方案 A：latest.json 升级清单生成与发布链路。

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const { buildLatestManifest } = require('../scripts/reportVsixArtifact');

test('buildLatestManifest emits version/url/sha256 with stable latest download url', () => {
  const manifest = buildLatestManifest('4.2.0', {
    fileName: 'syntec-macro-4.2.0.vsix',
    sizeBytes: 123,
    sha256: 'ab'.repeat(32)
  }, 'SYNTEC-40101720/syntec-macro');
  assert.strictEqual(manifest.version, '4.2.0');
  assert.strictEqual(manifest.url, 'https://github.com/SYNTEC-40101720/syntec-macro/releases/latest/download/syntec-macro-4.2.0.vsix');
  assert.strictEqual(manifest.sha256, 'ab'.repeat(32));
});

test('manifest JSON is parseable by updateCheck parseLatestManifest', () => {
  const { parseLatestManifest } = require('../src/updateCheck');
  const manifest = buildLatestManifest('4.3.0', {
    fileName: 'syntec-macro-4.3.0.vsix',
    sizeBytes: 1,
    sha256: 'ff'.repeat(32)
  }, 'SYNTEC-40101720/syntec-macro');
  const parsed = parseLatestManifest(JSON.stringify(manifest));
  assert.ok(parsed, 'generated manifest must be consumable by the client parser');
  assert.strictEqual(parsed.version, '4.3.0');
});

test('generated latest.json (if present in repo root) matches package.json version', () => {
  const root = path.resolve(__dirname, '..');
  const manifestPath = path.join(root, 'latest.json');
  if (!fs.existsSync(manifestPath)) return; // 未打包时不存在，合法
  const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  assert.strictEqual(manifest.version, packageJson.version);
  assert.ok(manifest.url.endsWith(`syntec-macro-${packageJson.version}.vsix`));
});
