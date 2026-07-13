const assert = require('assert');
const vscode = require('vscode');

const EXTENSION_ID = 'syntec-team.syntec-macro';

async function run() {
  const extension = vscode.extensions.getExtension(EXTENSION_ID);
  assert.ok(extension, `${EXTENSION_ID} should be installed in the isolated profile`);
  assert.strictEqual(extension.packageJSON.version, process.env.SYNTEC_SMOKE_EXPECTED_VERSION);
  assert.ok(
    extension.extensionPath.toLowerCase().startsWith(process.env.SYNTEC_SMOKE_EXTENSIONS_DIR.toLowerCase()),
    `extension should load from the isolated extensions directory: ${extension.extensionPath}`
  );

  await extension.activate();
  assert.strictEqual(extension.isActive, true);

  const symbols = await vscode.commands.executeCommand('vscode.executeWorkspaceSymbolProvider', 'G1000');
  assert.ok(symbols.some(symbol => symbol.name === 'G1000'), 'installed extension should provide workspace symbols');
  process.stdout.write(`Installed VSIX smoke passed: ${EXTENSION_ID}@${extension.packageJSON.version}\n`);
}

module.exports = { run };