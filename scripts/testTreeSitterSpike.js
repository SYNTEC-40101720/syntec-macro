// M2 Tree-sitter grammar spike runner; development-only and excluded from VSIX.

const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, 'treeSitterSpike');
const CLI = path.join(__dirname, '..', 'node_modules', '.bin', 'tree-sitter.cmd');

function run(args) {
  const result = spawnSync(CLI, args, {
    cwd: ROOT,
    env: process.env,
    encoding: 'utf8',
    stdio: 'inherit',
    shell: process.platform === 'win32',
    windowsHide: true
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`Tree-sitter command failed with status ${result.status}`);
  }
}

function main() {
  run(['generate']);
  run(['test', '--rebuild', '--overview-only']);
}

if (require.main === module) main();

module.exports = { main, run };
