const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const VSCE = path.join(ROOT, 'node_modules', '@vscode', 'vsce', 'vsce');
const REQUIRED_STATIC_FILES = [
  'README.md',
  'package.json',
  'LICENSE.txt',
  'CHANGELOG.md',
  'images/icon.png',
  'snippets/syntec-macro.json',
  'syntaxes/language-configuration.json',
  'syntaxes/syntec-macro.tmLanguage.json',
  // 3.0.0: production wasm asset bundle into VSIX so `rustWasmAsset.js`
  // can ship a fixed-version, SHA-256-audited wasm artifact with the
  // extension. Asset bundle is gated by `check:rust:wasm:asset`.
  'assets/rust-wasm/manifest.json',
  'assets/rust-wasm/syntec_core.wasm',
  // Phase R2 (v4.x): 数据真源迁到 src/data/*.json；host provider 通过
  // thin loader 加载，JSON 必须随 VSIX 分发。
  'src/data/systemVariables.json',
  'src/data/functions.json',
  'src/data/hoverDocs.json',
  'src/data/keywords.json',
  // 诊断帮助按钮（syntecMacro.showDiagnosticHelp）离线直达的生成文档
  'docs/诊断规则与修复动作.md'
];

function normalizeFiles(files) {
  return files.map(file => file.trim().replace(/\\/g, '/')).filter(Boolean);
}

function checkVsixContents(files, requiredFiles) {
  const normalized = normalizeFiles(files);
  const actual = new Set(normalized);
  const required = new Set(normalizeFiles(requiredFiles));
  const errors = [];

  for (const file of required) {
    if (!actual.has(file)) errors.push(`Required VSIX file is missing: ${file}`);
  }
  for (const file of actual) {
    if (!required.has(file)) errors.push(`Unexpected VSIX file: ${file}`);
  }
  if (actual.size !== normalized.length) errors.push('VSIX file list contains duplicate entries.');
  return errors;
}

function getRequiredFiles() {
  const sourceFiles = fs.readdirSync(path.join(ROOT, 'src'))
    .filter(file => file.endsWith('.js'))
    .sort()
    .map(file => `src/${file}`);
  return [...REQUIRED_STATIC_FILES, ...sourceFiles];
}

function getVsixFileList() {
  const result = spawnSync(process.execPath, [VSCE, 'ls'], {
    cwd: ROOT,
    encoding: 'utf8'
  });
  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || 'vsce ls failed').trim());
  }
  return normalizeFiles(result.stdout.split(/\r?\n/));
}

function main() {
  const files = getVsixFileList();
  const errors = checkVsixContents(files, getRequiredFiles());
  if (errors.length) {
    for (const error of errors) console.error(error);
    process.exitCode = 1;
    return;
  }
  console.info(`VSIX contents are valid: ${files.length} files.`);
}

if (require.main === module) main();

module.exports = { checkVsixContents, normalizeFiles };