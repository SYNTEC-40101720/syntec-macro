// createGitHubRelease.js
// 在域控环境中创建 GitHub Release 并上传 VSIX 资产。
// 域控阻止 gh CLI，因此走 GitHub REST API + git credential fill + 临时 JSON 文件 + curl.exe。
//
// 用法: node scripts/createGitHubRelease.js <tag>
//   <tag>  形如 v2.11.4，对应 package.json 的 version 与 CHANGELOG.md 的 [2.11.4] 段落
//
// 流程:
//   1. 校验 tag 与 package.json version 一致
//   2. 从 CHANGELOG.md 解析对应版本段落作为 release body
//   3. 通过 `git credential fill` 读取 github.com 的 token
//   4. 将 JSON payload 写入临时文件，用 curl.exe -d "@file" 创建 release
//   5. 从返回的 upload_url 提取 release ID，用 curl.exe --data-binary 上传 VSIX

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const REPO = 'SYNTEC-40101720/syntec-macro';
const API_BASE = 'https://api.github.com/repos';
const UPLOAD_BASE = 'https://uploads.github.com/repos';

function fail(msg, code = 1) {
  console.error('❌ ' + msg);
  process.exit(code);
}

// 从 Windows Credential Manager 读取 github.com 的 token
function readGithubToken() {
  try {
    const credInput = 'protocol=https\nhost=github.com\n';
    const out = execSync('git credential fill', {
      input: credInput,
      encoding: 'utf8',
      timeout: 10000
    });
    const line = out.split(/\r?\n/).find(l => l.startsWith('password='));
    if (!line) return null;
    return line.split('=').slice(1).join('=');
  } catch (err) {
    console.warn('[syntec-macro] git credential fill failed:', err.message);
    return null;
  }
}

// 从 CHANGELOG.md 解析指定版本段落，作为 release body
function extractChangelogBody(version) {
  const changelogPath = path.join(ROOT, 'CHANGELOG.md');
  const text = fs.readFileSync(changelogPath, 'utf8');
  // 匹配 ## [X.Y.Z] - YYYY-MM-DD 起，到下一个 ## [ 或文件尾
  const startRe = new RegExp(`^## \\[${version.replace(/\./g, '\\.')}\\] - (\\d{4}-\\d{2}-\\d{2})`, 'm');
  const startMatch = text.match(startRe);
  if (!startMatch) fail(`CHANGELOG.md 未找到版本 ${version} 的段落`);

  const startIdx = startMatch.index;
  const rest = text.slice(startIdx);
  // 找下一个 ## [ 段落
  const nextMatch = rest.slice(startMatch[0].length).match(/\n## \[/);
  const section = nextMatch
    ? rest.slice(0, startMatch[0].length + nextMatch.index)
    : rest;
  return section.trim();
}

// 用 curl.exe 发请求，返回 stdout
function curl(args) {
  const result = execSync('curl.exe ' + args, {
    encoding: 'utf8',
    timeout: 60000,
    stdio: ['ignore', 'pipe', 'pipe']
  });
  return result;
}

function main() {
  const tag = process.argv[2];
  if (!tag) fail('用法: node scripts/createGitHubRelease.js <tag>');

  const packageJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  const version = tag.replace(/^v/, '');
  if (version !== packageJson.version) {
    fail(`tag ${tag} 与 package.json version ${packageJson.version} 不一致`);
  }

  const body = extractChangelogBody(version);
  const token = readGithubToken();
  if (!token) fail('无法从 git credential 读取 GitHub token，请先 git push 一次以缓存凭据');

  // 1. 构造 payload 写入临时文件（避免 PowerShell 内联 JSON 转义问题）
  const payload = JSON.stringify({
    tag_name: tag,
    name: tag,
    body,
    draft: false,
    prerelease: false
  });
  const payloadFile = path.join(os.tmpdir(), `syntec-release-${version}.json`);
  fs.writeFileSync(payloadFile, payload, 'utf8');

  // 2. 创建 Release
  console.info(`Creating release ${tag} ...`);
  const createOut = curl(`-sS -X POST "${API_BASE}/${REPO}/releases" ` +
    `-H "Authorization: token ${token}" ` +
    '-H "Accept: application/vnd.github.v3+json" ' +
    '-H "User-Agent: syntec-macro-release-script" ' +
    `-d "@${payloadFile}"`);

  let releaseData;
  try {
    releaseData = JSON.parse(createOut);
  } catch {
    fail(`创建 release 返回非 JSON: ${createOut.slice(0, 500)}`);
  }
  if (!releaseData.id) {
    fail(`创建 release 失败: ${JSON.stringify(releaseData).slice(0, 500)}`);
  }
  fs.unlinkSync(payloadFile);
  console.info(`✓ Release created: ${releaseData.html_url}`);

  // 3. 上传 VSIX
  const vsixPath = path.join(ROOT, `syntec-macro-${version}.vsix`);
  if (!fs.existsSync(vsixPath)) {
    console.warn(`⚠ VSIX 不存在，跳过上传: ${vsixPath}`);
    return;
  }
  const vsixName = path.basename(vsixPath);
  console.info(`Uploading ${vsixName} ...`);
  const uploadOut = curl(`-sS -X POST "${UPLOAD_BASE}/${REPO}/releases/${releaseData.id}/assets?name=${vsixName}" ` +
    `-H "Authorization: token ${token}" ` +
    '-H "Content-Type: application/octet-stream" ' +
    '-H "User-Agent: syntec-macro-release-script" ' +
    `--data-binary "@${vsixPath}"`);

  let assetData;
  try {
    assetData = JSON.parse(uploadOut);
  } catch {
    console.warn(`⚠ 上传返回非 JSON: ${uploadOut.slice(0, 500)}`);
    return;
  }
  if (assetData.browser_download_url) {
    console.info(`✓ Asset uploaded: ${assetData.browser_download_url}`);
  } else {
    console.warn(`⚠ 上传失败: ${JSON.stringify(assetData).slice(0, 500)}`);
  }
}

main();
