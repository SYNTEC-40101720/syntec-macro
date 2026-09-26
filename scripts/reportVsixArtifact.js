const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

function getVsixArtifactSummary(filePath) {
  const content = fs.readFileSync(filePath);
  return {
    fileName: path.basename(filePath),
    sizeBytes: content.length,
    sha256: crypto.createHash('sha256').update(content).digest('hex')
  };
}

// 生成 latest.json 升级清单（方案 A）：{ version, url, sha256 }
// url 指向 GitHub Release 的稳定下载地址（releases/latest/download/，不随 tag 变化）
function buildLatestManifest(version, summary, repo) {
  return {
    version,
    url: `https://github.com/${repo}/releases/latest/download/${summary.fileName}`,
    sha256: summary.sha256
  };
}

function main() {
  const packageJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  const artifactPath = path.join(ROOT, `syntec-macro-${packageJson.version}.vsix`);
  const summary = getVsixArtifactSummary(artifactPath);
  console.info(`VSIX artifact: ${summary.fileName}`);
  console.info(`Size: ${summary.sizeBytes} bytes`);
  console.info(`SHA-256: ${summary.sha256}`);

  // 生成 latest.json 到仓库根目录（由 createGitHubRelease.js 上传到 Release 资产）
  const manifest = buildLatestManifest(packageJson.version, summary, 'SYNTEC-40101720/syntec-macro');
  const manifestPath = path.join(ROOT, 'latest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  console.info(`latest.json written: ${manifestPath} (version ${manifest.version})`);
}

if (require.main === module) main();

module.exports = { getVsixArtifactSummary, buildLatestManifest };
