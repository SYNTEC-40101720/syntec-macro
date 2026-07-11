const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const { downloadAndUnzipVSCode } = require('@vscode/test-electron');

const ROOT = path.resolve(__dirname, '..');

function runCli(executable, args) {
  const useShell = process.platform === 'win32' && executable.endsWith('.cmd');
  const result = spawnSync(executable, args, { encoding: 'utf8', shell: useShell });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) {
    const detail = result.error ? result.error.message : (result.signal || result.status);
    throw new Error(`VS Code CLI failed: ${detail}.`);
  }
  return result.stdout;
}

function runExtensionHost(executable, args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, { env: { ...process.env, ...env } });
    child.stdout.on('data', data => process.stdout.write(data));
    child.stderr.on('data', data => process.stderr.write(data));
    child.on('error', reject);
    child.on('exit', code => {
      if (code === 0) resolve();
      else reject(new Error(`Installed VSIX smoke host exited with code ${code}.`));
    });
  });
}

async function main() {
  const packageJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  const artifactPath = path.join(ROOT, `syntec-macro-${packageJson.version}.vsix`);
  if (!fs.existsSync(artifactPath)) throw new Error(`VSIX artifact not found: ${artifactPath}`);

  const executable = await downloadAndUnzipVSCode();
  const cli = process.platform === 'win32'
    ? path.join(path.dirname(executable), 'bin', 'code.cmd')
    : path.join(path.dirname(executable), 'bin', 'code');
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'syntec-macro-smoke-'));
  const userDataDirectory = path.join(tempRoot, 'user-data');
  const extensionsDirectory = path.join(tempRoot, 'extensions');
  const commonArgs = [
    `--user-data-dir=${userDataDirectory}`,
    `--extensions-dir=${extensionsDirectory}`
  ];

  try {
    console.info(`Installing VSIX into isolated profile: ${tempRoot}`);
    runCli(cli, [...commonArgs, '--install-extension', artifactPath, '--force']);
    const installed = runCli(cli, [...commonArgs, '--list-extensions', '--show-versions']);
    const expected = `syntec-team.syntec-macro@${packageJson.version}`;
    if (!installed.toLowerCase().split(/\r?\n/).includes(expected)) {
      throw new Error(`Installed extension was not listed as ${expected}.`);
    }

    console.info(`Launching installed extension smoke host: ${expected}`);
    await runExtensionHost(executable, [
      path.join(ROOT, 'tests', 'integration', 'test.code-workspace'),
      ...commonArgs,
      '--no-sandbox',
      '--disable-gpu-sandbox',
      '--disable-updates',
      '--skip-welcome',
      '--skip-release-notes',
      '--disable-workspace-trust',
      `--extensionDevelopmentPath=${path.join(ROOT, 'tests', 'integration', 'installedSmokeDriver')}`,
      `--extensionTestsPath=${path.join(ROOT, 'tests', 'integration', 'installedSmokeSuite')}`
    ], {
      SYNTEC_SMOKE_EXTENSIONS_DIR: extensionsDirectory
    });
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});