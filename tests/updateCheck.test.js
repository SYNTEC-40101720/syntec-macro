// updateCheck.test.js
// 方案 A 升级提示：版本比较、latest 清单解析、checkForUpdate 注入式行为断言。
// 全部走注入依赖（doFetch/getManifestUrl/now），不发真实网络请求。

const assert = require('node:assert');
const { test } = require('node:test');

const {
  compareVersions,
  parseLatestManifest,
  checkForUpdate,
  DEFAULT_MANIFEST_URL,
  __resetThrottleForTest
} = require('../src/updateCheck');

// 每个用例前清空节流时间戳，避免模块级状态在用例间泄漏
test('setup: reset throttle state', () => __resetThrottleForTest());

test('compareVersions follows semver numeric ordering', () => {
  assert.strictEqual(compareVersions('4.2.0', '4.2.0'), 0);
  assert.strictEqual(compareVersions('4.2.1', '4.2.0'), 1);
  assert.strictEqual(compareVersions('4.2.0', '4.10.0'), -1, '4.10 > 4.2 numerically');
  assert.strictEqual(compareVersions('5.0.0', '4.99.99'), 1);
  assert.strictEqual(compareVersions('4.2', '4.2.0'), null, 'invalid format returns null');
  assert.strictEqual(compareVersions('abc', '4.2.0'), null);
});

test('parseLatestManifest accepts valid manifest with optional url/sha256', () => {
  const m = parseLatestManifest(JSON.stringify({ version: '4.3.0', url: 'https://x/v.vsix', sha256: 'a'.repeat(64) }));
  assert.strictEqual(m.version, '4.3.0');
  assert.strictEqual(m.url, 'https://x/v.vsix');
  assert.strictEqual(m.sha256, 'a'.repeat(64));
  // url/sha256 可缺省
  const m2 = parseLatestManifest(JSON.stringify({ version: '4.3.0' }));
  assert.strictEqual(m2.url, null);
  assert.strictEqual(m2.sha256, null);
});

test('parseLatestManifest rejects invalid payloads', () => {
  assert.strictEqual(parseLatestManifest('not json'), null);
  assert.strictEqual(parseLatestManifest(JSON.stringify({})), null, 'missing version');
  assert.strictEqual(parseLatestManifest(JSON.stringify({ version: 'latest' })), null, 'non-semver version');
  assert.strictEqual(parseLatestManifest(JSON.stringify({ version: 4.3 })), null, 'non-string version');
});

test('checkForUpdate returns manifest when remote version is newer', async () => {
  __resetThrottleForTest();
  const result = await checkForUpdate({
    getManifestUrl: () => 'https://example.com/latest.json',
    doFetch: async () => JSON.stringify({ version: '99.0.0', url: 'https://example.com/x.vsix' }),
    now: () => 1000,
    currentVersion: '4.2.0'
  });
  assert.ok(result);
  assert.strictEqual(result.version, '99.0.0');
});

test('checkForUpdate returns null on same/older remote version', async () => {
  __resetThrottleForTest();
  for (const remote of ['4.2.0', '4.1.9']) {
    const result = await checkForUpdate({
      getManifestUrl: () => 'https://example.com/latest.json',
      doFetch: async () => JSON.stringify({ version: remote }),
      now: () => 1000,
      currentVersion: '4.2.0'
    });
    assert.strictEqual(result, null, `remote ${remote} should not trigger update`);
  }
});

test('checkForUpdate swallows fetch errors', async () => {
  __resetThrottleForTest();
  const result = await checkForUpdate({
    getManifestUrl: () => 'https://example.com/latest.json',
    doFetch: async () => { throw new Error('network down'); },
    now: () => 1000,
    currentVersion: '4.2.0'
  });
  assert.strictEqual(result, null);
});

test('checkForUpdate returns null when manifest url is empty (feature off)', async () => {
  __resetThrottleForTest();
  let fetched = false;
  const result = await checkForUpdate({
    getManifestUrl: () => '',
    doFetch: async () => { fetched = true; return '{}'; },
    now: () => 1000,
    currentVersion: '4.2.0'
  });
  assert.strictEqual(result, null);
  assert.strictEqual(fetched, false, 'empty url must not fetch');
});

test('checkForUpdate throttles repeat calls within interval', async () => {
  __resetThrottleForTest();
  let calls = 0;
  const doFetch = async () => {
    calls++;
    return JSON.stringify({ version: '99.0.0' });
  };
  const opts = { getManifestUrl: () => 'u', doFetch, now: () => 5000, currentVersion: '4.2.0' };
  const first = await checkForUpdate(opts);
  assert.ok(first, 'first call fetches');
  const second = await checkForUpdate({ ...opts, now: () => 5000 + 1000 * 60 * 60 });
  assert.strictEqual(second, null, 'within 24h window no re-check');
  assert.strictEqual(calls, 1);
  const third = await checkForUpdate({ ...opts, now: () => 5000 + 25 * 60 * 60 * 1000 });
  assert.ok(third, 'after 24h window re-checks');
  assert.strictEqual(calls, 2);
});

test('DEFAULT_MANIFEST_URL points at latest release asset', () => {
  assert.ok(DEFAULT_MANIFEST_URL.includes('/releases/latest/download/latest.json'));
});
