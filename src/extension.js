// extension.js
// VSCode 扩展主入口：注册各 Provider 与生命周期管理

const vscode = require('vscode');
const packageJson = require('../package.json');
const { LANG_ID } = require('./providerShared');
const { provideCompletionItems } = require('./completionProvider');
const { provideHover } = require('./hoverProvider');
const { provideDefinition } = require('./definitionProvider');
const diagnostics = require('./diagnosticsProvider');
const navigation = require('./navigationProvider');
const { provideDocumentFormattingEdits } = require('./formattingProvider');
// R1.2 Stage B (2026-09-22): host analyzer policy 切为 'empty' — Rust 未就绪时
// host provider (formatting/navigation) 返空 edits/symbols 而非回退 JS; JS
// fallback 路径即将随 §2.12 删除 analysisCore.js 一并失效.
const { initHostRustAnalyzer, setHostAnalyzerPolicy } = require('./hostRustAnalyzer');

function activate(context) {
  const selector = { language: LANG_ID };

  // 初始化 host 端 Rust analyzer (R1.2 Stage B 前置 PR 2026-09-21; 2026-09-22
  // Stage B 切 policy='empty'): await wasm 加载并缓存同步入口供
  // formattingProvider/navigationProvider 同步路径调用; 加载期间不再回退 JS,
  // 返空 edits/symbols. 不阻塞 activate (异步加载), 失败仅日志.
  setHostAnalyzerPolicy('empty');
  initHostRustAnalyzer().catch(error => {
    console.warn('[hostRustAnalyzer] 初始化失败, host provider 将返空:', error instanceof Error ? error.message : error);
  });

  // Completion
  context.subscriptions.push(
    vscode.languages.registerCompletionItemProvider(selector, {
      provideCompletionItems
    }, '.', '#')
  );

  // Hover
  context.subscriptions.push(
    vscode.languages.registerHoverProvider(selector, { provideHover })
  );

  // Go-to Definition
  context.subscriptions.push(
    vscode.languages.registerDefinitionProvider(selector, { provideDefinition })
  );

  // Document Symbols
  context.subscriptions.push(
    vscode.languages.registerDocumentSymbolProvider(selector, { provideDocumentSymbols: navigation.provideDocumentSymbol })
  );

  // Workspace Symbols
  context.subscriptions.push(
    vscode.languages.registerWorkspaceSymbolProvider({ provideWorkspaceSymbols: navigation.provideWorkspaceSymbols })
  );

  // References
  context.subscriptions.push(
    vscode.languages.registerReferenceProvider(selector, { provideReferences: navigation.provideReferences })
  );

  // Formatting
  context.subscriptions.push(
    vscode.languages.registerDocumentFormattingEditProvider(selector, { provideDocumentFormattingEdits })
  );

  // Diagnostics
  const diagnosticCollection = vscode.languages.createDiagnosticCollection(LANG_ID);
  context.subscriptions.push(diagnosticCollection);
  diagnostics.setDiagnosticCollection(diagnosticCollection);

  context.subscriptions.push(
    vscode.commands.registerCommand('syntecMacro.showDiagnosticHelp', message => {
      vscode.window.showInformationMessage(message);
    })
  );

  context.subscriptions.push(
    vscode.languages.registerCodeActionsProvider(selector, { provideCodeActions: diagnostics.provideCodeActions }, {
      providedCodeActionKinds: [vscode.CodeActionKind.QuickFix]
    })
  );

  // 初始扫描 + 实时更新
  for (const doc of vscode.workspace.textDocuments) {
    diagnostics.scheduleDiagnostics(doc);
  }

  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument(e => {
      diagnostics.scheduleDiagnostics(e.document);
    })
  );

  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument(doc => {
      diagnostics.scheduleDiagnostics(doc);
    })
  );

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(e => {
      if (!e.affectsConfiguration('syntecMacro')) return;
      for (const doc of vscode.workspace.textDocuments) {
        diagnostics.scheduleDiagnostics(doc);
      }
    })
  );

  // 状态栏提示
  const statusBar = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.right, 100
  );
  statusBar.text = ' Syntec Macro v' + packageJson.version;
  statusBar.tooltip = '新代宏程序扩展已激活';
  statusBar.show();
  context.subscriptions.push(statusBar);

  console.info('[syntec-macro] 扩展已激活 v' + packageJson.version);
}

function deactivate() {
  // 各 Provider 自行清理定时器、缓存与 Worker 线程，避免热重载后触发已 dispose 的 collection
  diagnostics.dispose();
  navigation.dispose();
}

module.exports = { activate, deactivate };
