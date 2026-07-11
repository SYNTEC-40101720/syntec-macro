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

function main() {
  const packageJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  const artifactPath = path.join(ROOT, `syntec-macro-${packageJson.version}.vsix`);
  const summary = getVsixArtifactSummary(artifactPath);
  console.info(`VSIX artifact: ${summary.fileName}`);
  console.info(`Size: ${summary.sizeBytes} bytes`);
  console.info(`SHA-256: ${summary.sha256}`);
}

if (require.main === module) main();

module.exports = { getVsixArtifactSummary };