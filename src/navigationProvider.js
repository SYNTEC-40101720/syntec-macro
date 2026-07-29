// navigationProvider.js
// 文档/工作区符号导航与宏调用引用查找

const vscode = require('vscode');
const { collectNavigationIndexEntries } = require('./navigationIndex');
const {
  buildNavigationIndexEntry,
  extractNavigationSymbols,
  extractStaticMacroCalls,
  getMacroProgramName
} = require('./navigationSymbols');

const navigationIndexCache = new Map();

function provideDocumentSymbol(document) {
  return extractNavigationSymbols(document.getText()).map(symbol => {
    const line = document.lineAt(symbol.line);
    return new vscode.DocumentSymbol(
      symbol.name,
      symbol.kind === 'label' ? '标签 ' + symbol.name : '宏程序入口',
      symbol.kind === 'label' ? vscode.SymbolKind.Number : vscode.SymbolKind.Namespace,
      line.range,
      line.range,
      []
    );
  });
}

function getDocumentProgramName(document) {
  return getMacroProgramName(document.uri.fsPath, document.getText());
}

function getReferenceTargetName(document, position) {
  const call = extractStaticMacroCalls(document.getText()).find(item =>
    item.line === position.line && position.character >= item.start && position.character <= item.end
  );
  if (call) return call.targetName.toUpperCase();

  const onMacroHeader = extractNavigationSymbols(document.getText()).some(symbol =>
    symbol.kind === 'macroHeader' && symbol.line === position.line
  );
  return onMacroHeader ? getDocumentProgramName(document) : null;
}

async function getWorkspaceMacroFiles(token) {
  const files = await vscode.workspace.findFiles('**/*', '**/{node_modules,.git,dist}/**');
  const openDocuments = new Map(vscode.workspace.textDocuments.map(document => [document.uri.toString(), document]));
  const currentUris = new Set(files.map(uri => uri.toString()));
  for (const uriKey of navigationIndexCache.keys()) {
    if (!currentUris.has(uriKey)) navigationIndexCache.delete(uriKey);
  }
  const entries = await collectNavigationIndexEntries(files, {
    getFilePath: uri => uri.fsPath,
    isCancelled: () => token.isCancellationRequested,
    loadIndex: async (uri, filePath) => {
      const uriKey = uri.toString();
      const openDocument = openDocuments.get(uriKey);
      let signature;
      let text;
      if (openDocument) {
        signature = `document:${openDocument.version}`;
        text = openDocument.getText();
      } else {
        const stat = await vscode.workspace.fs.stat(uri);
        signature = `file:${stat.mtime}:${stat.size}`;
      }

      const cached = navigationIndexCache.get(uriKey);
      if (cached && cached.signature === signature) return cached.index;
      if (text === undefined) {
        text = Buffer.from(await vscode.workspace.fs.readFile(uri)).toString('utf8');
      }
      const index = buildNavigationIndexEntry(filePath, text);
      navigationIndexCache.set(uriKey, { signature, index });
      return index;
    }
  });
  return entries.map(entry => ({ uri: entry.file, index: entry.index }));
}

async function provideWorkspaceSymbols(query, token) {
  const queryUpper = query.toUpperCase();
  const symbols = [];
  const macroFiles = await getWorkspaceMacroFiles(token);

  for (const macroFile of macroFiles) {
    if (token.isCancellationRequested) return symbols;
    const { uri, index } = macroFile;
    const programName = index.programEntryName;
    const containerName = vscode.workspace.asRelativePath(uri);
    if (programName && programName.includes(queryUpper)) {
      symbols.push(new vscode.SymbolInformation(
        programName,
        vscode.SymbolKind.File,
        containerName,
        new vscode.Location(uri, new vscode.Position(0, 0))
      ));
    }

    for (const symbol of index.symbols) {
      if (!symbol.name.toUpperCase().includes(queryUpper)) continue;
      symbols.push(new vscode.SymbolInformation(
        symbol.name,
        symbol.kind === 'label' ? vscode.SymbolKind.Number : vscode.SymbolKind.Namespace,
        containerName,
        new vscode.Location(uri, new vscode.Position(symbol.line, 0))
      ));
    }
  }

  return symbols;
}

async function provideReferences(document, position, context, token) {
  const targetName = getReferenceTargetName(document, position);
  if (!targetName) return [];

  const locations = [];
  const macroFiles = await getWorkspaceMacroFiles(token);
  for (const macroFile of macroFiles) {
    if (token.isCancellationRequested) return locations;
    const { uri, index } = macroFile;

    if (context.includeDeclaration && index.macroProgramName === targetName) {
      const header = index.symbols.find(symbol => symbol.kind === 'macroHeader');
      if (header) {
        locations.push(new vscode.Location(
          uri,
          new vscode.Range(header.line, 0, header.line, '%@MACRO'.length)
        ));
      }
    }

    for (const call of index.calls) {
      if (call.targetName.toUpperCase() !== targetName) continue;
      locations.push(new vscode.Location(
        uri,
        new vscode.Range(call.line, call.start, call.line, call.end)
      ));
    }
  }
  return locations;
}

function dispose() {
  navigationIndexCache.clear();
}

module.exports = {
  provideDocumentSymbol,
  provideWorkspaceSymbols,
  provideReferences,
  dispose
};
