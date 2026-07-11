const assert = require('assert');
const vscode = require('vscode');

const EXTENSION_ID = 'syntec-team.syntec-macro';

async function run() {
  const extension = vscode.extensions.getExtension(EXTENSION_ID);
  assert.ok(extension, `${EXTENSION_ID} should be installed in the test host`);
  await extension.activate();

  const generatedUris = await vscode.workspace.findFiles('**/navigation-benchmark-generated/*');
  process.stdout.write(
    `Navigation benchmark roots: ${vscode.workspace.workspaceFolders.map(folder => folder.uri.fsPath).join(', ')}; files: ${generatedUris.length}\n`
  );
  assert.strictEqual(generatedUris.length, 500, 'VS Code file search should discover all benchmark files');

  const firstStart = Date.now();
  const firstSymbols = await vscode.commands.executeCommand('vscode.executeWorkspaceSymbolProvider', 'G3');
  const firstDurationMs = Date.now() - firstStart;

  const repeatStart = Date.now();
  const repeatSymbols = await vscode.commands.executeCommand('vscode.executeWorkspaceSymbolProvider', 'G3');
  const repeatDurationMs = Date.now() - repeatStart;

  const isGenerated = symbol => symbol.location.uri.fsPath.includes('navigation-benchmark-generated');
  assert.strictEqual(firstSymbols.filter(isGenerated).length, 500, 'first query should index all generated programs');
  assert.strictEqual(repeatSymbols.filter(isGenerated).length, 500, 'repeat query should index all generated programs');
  assert.ok(firstDurationMs <= 2000, `first workspace query took ${firstDurationMs} ms`);
  assert.ok(repeatDurationMs <= 500, `repeat workspace query took ${repeatDurationMs} ms`);
  process.stdout.write(`Navigation workspace benchmark: first ${firstDurationMs} ms, repeat ${repeatDurationMs} ms\n`);

  const benchmarkRoot = vscode.Uri.joinPath(vscode.workspace.workspaceFolders[0].uri, 'navigation-benchmark-generated');
  const changedProgram = vscode.Uri.joinPath(benchmarkRoot, 'G3000.nc');
  await vscode.workspace.fs.writeFile(changedProgram, Buffer.from('%@MACRO\nN99999;\nM99;', 'utf8'));
  const changedSymbols = await vscode.commands.executeCommand('vscode.executeWorkspaceSymbolProvider', 'N99999');
  assert.ok(
    changedSymbols.some(symbol => symbol.location.uri.toString() === changedProgram.toString()),
    'changed files should invalidate their cached navigation index'
  );

  const deletedProgram = vscode.Uri.joinPath(benchmarkRoot, 'G3001.nc');
  await vscode.workspace.fs.delete(deletedProgram, { useTrash: false });
  const deletedSymbols = await vscode.commands.executeCommand('vscode.executeWorkspaceSymbolProvider', 'G3001');
  assert.ok(
    !deletedSymbols.some(symbol => symbol.location.uri.toString() === deletedProgram.toString()),
    'deleted files should be removed from the navigation index cache'
  );
}

module.exports = { run };