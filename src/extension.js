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
// Host analyzer 初始化: await wasm 加载并缓存同步入口供
// formattingProvider/navigationProvider 同步路径调用; 加载未完成或失败时
// 返空 edits/symbols, 不回退 JS. 不阻塞 activate (异步加载), 失败仅日志.
const { initHostRustAnalyzer } = require('./hostRustAnalyzer');
const { checkForUpdate, notifyUpdate } = require('./updateCheck');

function activate(context) {
  const selector = { language: LANG_ID };

  initHostRustAnalyzer().catch(error => {
    console.warn('[hostRustAnalyzer] 初始化失败, host provider 将返空:', error instanceof Error ? error.message : error);
  });

  // 升级检查（方案 A）：拉 latest.json 对比版本，仅提示不自动安装；
  // 网络失败静默，绝不影响激活。
  const { getConfig } = require('./providerShared');
  checkForUpdate({ getConfig }).then(manifest => {
    if (manifest) return notifyUpdate(vscode, manifest);
  }).catch(() => { /* 升级检查失败不影响主流程 */ });

  // Worker 控制日志输出通道：诊断 worker 的控制消息（wasm 资产加载失败
  // 原因等）转发到这里，便于排障。
  const workerOutputChannel = vscode.window.createOutputChannel('Syntec Macro Worker');
  context.subscriptions.push(workerOutputChannel);
  diagnostics.setWorkerLogSink(message => workerOutputChannel.appendLine(message));

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

  // 语言状态项（1.65+）：仅在打开宏文件时出现在编辑器右下语言模式区，
  // 不再占用全局状态栏；详细文本显示当前版本，command 打开 worker 输出通道。
  const languageStatus = vscode.languages.createLanguageStatusItem('syntecMacro.status', selector);
  languageStatus.name = 'Syntec Macro';
  languageStatus.text = `v${packageJson.version}`;
  languageStatus.detail = `新代宏程序扩展 v${packageJson.version}`;
  languageStatus.command = { title: '查看 Worker 日志', command: 'syntecMacro.showWorkerLog' };
  context.subscriptions.push(languageStatus);

  // 诊断帮助：弹出说明并附「查看诊断文档」按钮，直达 docs/诊断规则与修复动作.md
  // 对应 code 详情（Quick Fix 灯泡里说明型 action 的终点）。
  context.subscriptions.push(
    vscode.commands.registerCommand('syntecMacro.showDiagnosticHelp', message => {
      vscode.window.showInformationMessage(message, '查看诊断文档').then(choice => {
        if (choice !== '查看诊断文档') return;
        vscode.commands.executeCommand('markdown.showPreview',
          vscode.Uri.joinPath(context.extensionUri, 'docs', '诊断规则与修复动作.md'));
      });
    })
  );

  // 打开 Worker 控制日志输出通道（语言状态项 command 入口）
  context.subscriptions.push(
    vscode.commands.registerCommand('syntecMacro.showWorkerLog', () => {
      workerOutputChannel.show();
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

  // 激活日志（原全局状态栏已改为 LanguageStatusItem，只在宏文件上下文显示）
  console.info('[syntec-macro] 扩展已激活 v' + packageJson.version);
}

function deactivate() {
  // 各 Provider 自行清理定时器、缓存与 Worker 线程，避免热重载后触发已 dispose 的 collection
  diagnostics.dispose();
  navigation.dispose();
}

module.exports = { activate, deactivate };
