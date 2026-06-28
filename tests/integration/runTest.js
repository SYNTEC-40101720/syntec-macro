// Runs VS Code integration tests for this extension.

const path = require('path');
const { runTests } = require('@vscode/test-electron');

async function main() {
  const extensionDevelopmentPath = path.resolve(__dirname, '..', '..');
  const extensionTestsPath = path.resolve(__dirname, 'suite');
  const testWorkspace = path.resolve(__dirname, 'workspace');

  await runTests({
    extensionDevelopmentPath,
    extensionTestsPath,
    launchArgs: [testWorkspace, '--disable-extensions']
  });
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
