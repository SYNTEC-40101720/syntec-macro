// navigationProvider.js
// 文档/工作区符号导航与宏调用引用查找
//
// R1.2 Stage B (2026-09-22): JS fallback 路径已移除 — 同步路径经 hostRustAnalyzer
// 走 Rust; 启动期未就绪 (policy='empty') 返空. 异步 nav batch 走 createNavOnlyAdapter
// nav-only ABI, 未就绪时返 null 由上层跳过该 file. path helper 经 pathResolver 拿
// (原 navigationIndex.js / navigationSymbols.js 即将随 §2.12 删除).

const vscode = require('vscode');
const { LANG_ID } = require('./providerShared');
const {
  createAnalysisRequest,
  createDocumentSnapshot
} = require('./analysisProtocol');
const {
  collectNavigationIndexEntries,
  isPotentialNavigationFile
} = require('./pathResolver');
const {
  getHostRustAnalyzer,
  createNavOnlyAdapter,
  makeRequest: makeHostRequest
} = require('./hostRustAnalyzer');

const navigationIndexCache = new Map();
const NAVIGATION_INDEX_CONCURRENCY = 32;
let navigationFileWatcher;

function ensureNavigationFileWatcher() {
  if (navigationFileWatcher) return;
  navigationFileWatcher = vscode.workspace.createFileSystemWatcher('**/*');
  const invalidate = uri => {
    if (isPotentialNavigationFile(uri.fsPath)) {
      navigationIndexCache.delete(uri.toString());
    }
  };
  navigationFileWatcher.onDidChange(invalidate);
  navigationFileWatcher.onDidDelete(invalidate);
}

/**
 * 同步路径 helpers: 走 host Rust analyzer 拿 symbols+calls; Rust 未就绪
 * (policy='empty') 返空. R1.2 Stage B 后 JS fallback 已移除.
 */
function getSymbolsFromHost(document) {
  const hostAnalyzer = getHostRustAnalyzer();
  if (!hostAnalyzer) return [];
  const result = hostAnalyzer(makeHostRequest(document.getText(), document.uri.toString(), document.version));
  return result.symbols || [];
}

function getCallsFromHost(document) {
  const hostAnalyzer = getHostRustAnalyzer();
  if (!hostAnalyzer) return [];
  const result = hostAnalyzer(makeHostRequest(document.getText(), document.uri.toString(), document.version));
  if (result.navigation && result.navigation.calls) return result.navigation.calls;
  return [];
}

function getProgramMetadataFromHost(document) {
  const hostAnalyzer = getHostRustAnalyzer();
  if (!hostAnalyzer) return null;
  const result = hostAnalyzer(makeHostRequest(document.getText(), document.uri.toString(), document.version));
  if (result.navigation) {
    return {
      programEntryName: result.navigation.programEntryName,
      macroProgramName: result.navigation.macroProgramName,
      symbols: result.navigation.symbols
    };
  }
  return null;
}

function provideDocumentSymbol(document) {
  return getSymbolsFromHost(document).map(symbol => {
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
  const meta = getProgramMetadataFromHost(document);
  if (meta) return meta.macroProgramName;
  return null;
}

function getReferenceTargetName(document, position) {
  const call = getCallsFromHost(document).find(item =>
    item.line === position.line && position.character >= item.start && position.character <= item.end
  );
  if (call) return call.targetName.toUpperCase();

  const onMacroHeader = getSymbolsFromHost(document).some(symbol =>
    symbol.kind === 'macroHeader' && symbol.line === position.line
  );
  return onMacroHeader ? getDocumentProgramName(document) : null;
}

async function getWorkspaceMacroFiles(token) {
  ensureNavigationFileWatcher();
  const files = await vscode.workspace.findFiles('**/*', '**/{node_modules,.git,dist}/**');
  const openDocuments = new Map(vscode.workspace.textDocuments.map(document => [document.uri.toString(), document]));
  const currentUris = new Set(files.map(uri => uri.toString()));
  for (const uriKey of navigationIndexCache.keys()) {
    if (!currentUris.has(uriKey)) navigationIndexCache.delete(uriKey);
  }
  const entries = await collectNavigationIndexEntries(files, {
    getFilePath: uri => uri.fsPath,
    concurrency: NAVIGATION_INDEX_CONCURRENCY,
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
        const cached = navigationIndexCache.get(uriKey);
        if (cached && cached.source === 'file') return cached.index;
        const stat = await vscode.workspace.fs.stat(uri);
        signature = `file:${stat.mtime}:${stat.size}`;
      }

      const cached = navigationIndexCache.get(uriKey);
      if (cached && cached.signature === signature) return cached.index;
      if (text === undefined) {
        text = Buffer.from(await vscode.workspace.fs.readFile(uri)).toString('utf8');
      }
      const request = createAnalysisRequest(createDocumentSnapshot({
        uri: uriKey,
        version: openDocument ? openDocument.version : 0,
        languageId: LANG_ID,
        text
      }));
      // R1.2 Stage B (2026-09-22): 走 host 端 nav-only adapter (Phase 1.3 落地的
      // syntec_core_analyze_navigation_json ABI, 4-6x 快于 analyze_request);
      // host 未就绪 (policy='empty') 返 null, 上层按 null 跳过该 file.
      // JS analyzeNavigationDocument 路径已移除 (analysisCore.js 即将 git rm).
      const navAdapter = createNavOnlyAdapter(filePath);
      const index = navAdapter ? navAdapter(request).navigation : null;
      navigationIndexCache.set(uriKey, {
        signature,
        source: openDocument ? 'document' : 'file',
        index
      });
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
  if (navigationFileWatcher) {
    navigationFileWatcher.dispose();
    navigationFileWatcher = null;
  }
}

module.exports = {
  provideDocumentSymbol,
  provideWorkspaceSymbols,
  provideReferences,
  dispose
};
