// navigationProvider.js
// 文档/工作区符号导航与宏调用引用查找
//
// R1.2 Stage B 前置 PR (2026-09-21): 同步路径 (`provideDocumentSymbol`/
// `getReferenceTargetName`/`getDocumentProgramName`) 与异步 nav batch 路径
// (`getWorkspaceMacroFiles`) 通过 hostRustAnalyzer 优先走 Rust backend;
// 启动期 Rust 未就绪走 JS fallback (v3.1.x 行为不变). R1.2 Stage B 完成
// (policy='empty') 后 JS fallback 路径将被移除.

const vscode = require('vscode');
const { analyzeNavigationDocument } = require('./analysisCore');
const { LANG_ID } = require('./providerShared');
const {
  createAnalysisRequest,
  createDocumentSnapshot
} = require('./analysisProtocol');
const {
  collectNavigationIndexEntries,
  isPotentialNavigationFile
} = require('./navigationIndex');
const {
  extractNavigationSymbols,
  extractStaticMacroCalls,
  getMacroProgramName
} = require('./navigationSymbols');
const {
  getHostRustAnalyzer,
  shouldDeferToJsFallback,
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
 * 同步路径 helpers: 优先走 host Rust analyzer 拿 symbols+calls, 启动期未就绪
 * 走 JS fallback (v3.1.x 兼容). R1.2 Stage B 后 (policy='empty') JS 路径将被
 * 移除并由 host analyzer 提供.
 */
function getSymbolsFromHostOrJs(document) {
  const hostAnalyzer = getHostRustAnalyzer();
  if (hostAnalyzer) {
    const result = hostAnalyzer(makeHostRequest(document.getText(), document.uri.toString(), document.version));
    return result.symbols || [];
  }
  if (shouldDeferToJsFallback()) {
    return extractNavigationSymbols(document.getText());
  }
  return [];
}

function getCallsFromHostOrJs(document) {
  const hostAnalyzer = getHostRustAnalyzer();
  if (hostAnalyzer) {
    const result = hostAnalyzer(makeHostRequest(document.getText(), document.uri.toString(), document.version));
    if (result.navigation && result.navigation.calls) return result.navigation.calls;
    return [];
  }
  if (shouldDeferToJsFallback()) {
    return extractStaticMacroCalls(document.getText());
  }
  return [];
}

function getProgramMetadataFromHostOrJs(document) {
  const hostAnalyzer = getHostRustAnalyzer();
  if (hostAnalyzer) {
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
  if (shouldDeferToJsFallback()) {
    return {
      programEntryName: null,
      macroProgramName: getMacroProgramName(document.uri.fsPath, document.getText()),
      symbols: extractNavigationSymbols(document.getText())
    };
  }
  return null;
}

function provideDocumentSymbol(document) {
  return getSymbolsFromHostOrJs(document).map(symbol => {
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
  const meta = getProgramMetadataFromHostOrJs(document);
  if (meta) return meta.macroProgramName;
  return null;
}

function getReferenceTargetName(document, position) {
  const call = getCallsFromHostOrJs(document).find(item =>
    item.line === position.line && position.character >= item.start && position.character <= item.end
  );
  if (call) return call.targetName.toUpperCase();

  const onMacroHeader = getSymbolsFromHostOrJs(document).some(symbol =>
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
      // R1.2 Stage B 前置 PR 补完 (2026-09-22): 走 host 端 nav-only adapter
      // (Phase 1.3 落地的 syntec_core_analyze_navigation_json ABI, 4-6x 快于
      // analyze_request); 启动期未就绪走 JS analyzeNavigationDocument 兼容
      // (v3.1.x 行为不变). R1.2 Stage B (policy='empty') 后 JS 路径将被
      // 移除, 改为返空 navigation 或抛错.
      const navAdapter = createNavOnlyAdapter(filePath);
      let index;
      if (navAdapter) {
        const result = navAdapter(request);
        index = result.navigation;
      } else if (shouldDeferToJsFallback()) {
        const result = analyzeNavigationDocument(request, filePath);
        index = result.navigation;
      } else {
        // policy='empty' 且 host 未就绪: 返 null (上层 collectionNatural 读
        // programEntryName/macroProgramName 时按 null 跳过该 file).
        index = null;
      }
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
