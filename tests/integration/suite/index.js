// Entry point loaded by @vscode/test-electron.

const { tests } = require('./syntecMacro.test');

async function run() {
  for (const { name, run: runTest } of tests) {
    process.stdout.write(`Running: ${name}\n`);
    await runTest();
  }
}

module.exports = { run };
