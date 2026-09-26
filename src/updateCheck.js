// updateCheck.js
// 方案 A 升级提示：激活后从配置的 latest 清单地址拉取 { version, url, sha256 }，
// 与 package.json version 对比，发现新版则提示用户前往下载。
//
// 设计约束：
//   - 纯展示，不自动下载/安装 VSIX（方案 B 的增强点，当前不做）；
//   - 网络失败静默（仅控制台日志），绝不影响激活与任何 provider；
//   - 24h 内只查一次（进程内时间戳缓存，无持久化依赖）；
//   - 版本比较用语义化 semver 规则（x.y.z 数值逐段比较，不比较字符串）。

const https = require('https');
const http = require('http');
const packageJson = require('../package.json');

const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;
let lastCheckAt = 0;

const DEFAULT_MANIFEST_URL =
  'https://github.com/SYNTEC-40101720/syntec-macro/releases/latest/download/latest.json';

// 语义化版本比较：返回 -1/0/1；非法格式返回 null（视为不提示，保守处理）
function compareVersions(a, b) {
  const pa = /^(\d+)\.(\d+)\.(\d+)$/.exec(String(a));
  const pb = /^(\d+)\.(\d+)\.(\d+)$/.exec(String(b));
  if (!pa || !pb) return null;
  for (let i = 1; i <= 3; i++) {
    const na = Number(pa[i]);
    const nb = Number(pb[i]);
    if (na !== nb) return na < nb ? -1 : 1;
  }
  return 0;
}

// 拉取 JSON 文本，8s 超时；跟随 GitHub release 跳转（重定向到对象存储）
function fetchJsonText(url, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('http:') ? http : https;
    const req = lib.get(url, { timeout: timeoutMs }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        const next = new URL(res.headers.location, url).toString();
        return fetchJsonText(next, timeoutMs).then(resolve, reject);
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      let body = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => resolve(body));
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', reject);
  });
}

// 解析 latest 清单：{ version, url, sha256? }；version 必填且合法
function parseLatestManifest(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return null;
  }
  if (!data || typeof data !== 'object' || typeof data.version !== 'string') return null;
  if (!/^(\d+)\.(\d+)\.(\d+)$/.test(data.version)) return null;
  return {
    version: data.version,
    url: typeof data.url === 'string' ? data.url : null,
    sha256: typeof data.sha256 === 'string' ? data.sha256 : null
  };
}

// 主入口（导出供测试注入依赖）：
//   getManifestUrl / doFetch / now 均可注入；getManifestUrl 未注入时读
//   VS Code 配置 syntecMacro.updateManifestUrl（由 extension.js 传入 getConfig）
async function checkForUpdate({
  getManifestUrl,
  getConfig,
  doFetch = fetchJsonText,
  now = Date.now,
  currentVersion = packageJson.version
} = {}) {
  let manifestUrl;
  if (getManifestUrl) {
    manifestUrl = getManifestUrl();
  } else if (getConfig) {
    manifestUrl = (getConfig().get('updateManifestUrl', DEFAULT_MANIFEST_URL) || '').trim();
  } else {
    manifestUrl = DEFAULT_MANIFEST_URL;
  }

  if (!manifestUrl) return null; // 显式清空配置 = 关闭升级检查
  // lastCheckAt === 0 表示从未检查过；此后 24h 内只查一次
  if (lastCheckAt !== 0 && now() - lastCheckAt < CHECK_INTERVAL_MS) return null;

  let manifest;
  try {
    manifest = parseLatestManifest(await doFetch(manifestUrl));
  } catch (err) {
    console.info('[syntec-macro] 升级检查跳过（网络不可达或清单无效）:', err.message);
    return null;
  }
  if (!manifest) return null;

  lastCheckAt = now();
  const cmp = compareVersions(manifest.version, currentVersion);
  if (cmp !== 1) return null;
  return manifest;
}

// 拉到新版清单后由 extension.js 调用弹出提示
async function notifyUpdate(vscode, manifest) {
  const message = `Syntec 宏程序有新版本 v${manifest.version}（当前 v${packageJson.version}）`;
  const choice = await vscode.window.showInformationMessage(message, '前往下载');
  if (choice === '前往下载' && manifest.url) {
    vscode.env.openExternal(vscode.Uri.parse(manifest.url));
  }
}

module.exports = {
  compareVersions,
  parseLatestManifest,
  fetchJsonText,
  checkForUpdate,
  notifyUpdate,
  DEFAULT_MANIFEST_URL,
  // 测试专用：清空进程内 24h 节流时间戳（避免测试间状态残留）
  __resetThrottleForTest() { lastCheckAt = 0; }
};
