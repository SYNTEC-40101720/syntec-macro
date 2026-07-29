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

function activate(context) {
  const selector = { language: LANG_ID };

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
