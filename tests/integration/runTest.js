// Runs VS Code integration tests for this extension.

const fs = require('fs');
const path = require('path');
const { runTests } = require('@vscode/test-electron');
const { buildFixture } = require('../../scripts/benchmarkNavigation');

async function main() {
  const runNavigationBenchmark = process.argv.includes('--navigation-benchmark');
  const extensionDevelopmentPath = path.resolve(__dirname, '..', '..');
  const extensionTestsPath = path.resolve(
    __dirname,
    runNavigationBenchmark ? 'benchmarkSuite' : 'suite'
  );
  const testWorkspace = path.resolve(__dirname, 'test.code-workspace');
  const benchmarkRoot = path.resolve(__dirname, 'workspace', 'navigation-benchmark-generated');

  if (runNavigationBenchmark) {
    fs.mkdirSync(benchmarkRoot, { recursive: true });
    for (const [index, file] of buildFixture().entries()) {
      fs.writeFileSync(path.join(benchmarkRoot, `G${String(3000 + index).padStart(4, '0')}.nc`), file.text, 'utf8');
    }
  }

  try {
    await runTests({
      extensionDevelopmentPath,
      extensionTestsPath,
      launchArgs: [testWorkspace, '--disable-extensions']
    });
  } finally {
    if (runNavigationBenchmark) fs.rmSync(benchmarkRoot, { recursive: true, force: true });
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
