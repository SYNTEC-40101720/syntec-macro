// diagnosticsProvider.js
// 实时诊断：Worker 线程验证、防抖调度、Quick Fix

const vscode = require('vscode');
const { Worker } = require('worker_threads');
const { validateDocument } = require('./validator');
const { getDiagnosticDedupeKey } = require('./diagnosticFactory');
const { DiagnosticCode } = require('./diagnosticCodes');
const {
  BLOCK_CLOSERS,
  DIAGNOSTIC_HELP,
  DIAGNOSTIC_REPLACEMENTS,
  FANUC_COMPARISON_REPLACEMENTS
} = require('./diagnosticActions');
const { LANG_ID, isFeatureEnabled } = require('./providerShared');

const DIAGNOSTIC_DEBOUNCE_MS = 300;
const VALIDATOR_TIMEOUT_MS = 5000;

let diagnosticCollection;
const diagnosticTimers = new Map();

// Worker 线程管理：将 validateDocument 放到独立线程，避免阻塞 Extension Host
let validatorWorker = null;
let workerMsgId = 0;
const pendingRequests = new Map();
// 每个文档的最新验证请求 ID，用于竞态取消
let docRequestId = 0;
const docRequestIds = new Map();

function setDiagnosticCollection(collection) {
  diagnosticCollection = collection;
}

function getValidatorWorker() {
  if (validatorWorker) return validatorWorker;
  try {
    validatorWorker = new Worker(require.resolve('./validatorWorker.js'));
    validatorWorker.on('message', ({ id, diagnostics, error }) => {
      const resolve = pendingRequests.get(id);
      if (!resolve) return;
      pendingRequests.delete(id);
      resolve(error ? null : diagnostics);
    });
    validatorWorker.on('error', (err) => {
      console.error('[syntec-macro] Validator worker error:', err.message);
      for (const [id, resolve] of pendingRequests) {
        resolve(null);
        pendingRequests.delete(id);
      }
      validatorWorker = null;
    });
    validatorWorker.on('exit', (code) => {
      if (code !== 0) {
        console.warn('[syntec-macro] Validator worker exited with code', code);
      }
      // 清理所有 pending requests，避免 Promise 永挂
      for (const resolve of pendingRequests.values()) resolve(null);
      pendingRequests.clear();
      validatorWorker = null;
    });
  } catch (err) {
    console.warn('[syntec-macro] Failed to start validator worker, falling back to sync:', err.message);
    validatorWorker = null;
  }
  return validatorWorker;
}

function validateDocumentAsync(text) {
  const worker = getValidatorWorker();
  if (!worker) {
    // Worker 不可用时回退到同步调用
    return Promise.resolve(validateDocument(text));
  }
  const id = ++workerMsgId;
  return new Promise((resolve) => {
    // 超时保护：worker 卡死时避免 Promise 永挂
    const timer = setTimeout(() => {
      if (pendingRequests.has(id)) {
        pendingRequests.delete(id);
        resolve(null);
      }
    }, VALIDATOR_TIMEOUT_MS);
    pendingRequests.set(id, (value) => {
      clearTimeout(timer);
      resolve(value);
    });
    worker.postMessage({ id, content: text });
  });
}

function scheduleDiagnostics(document) {
  // 提前过滤非本语言文档，避免无谓的调度开销
  if (document.languageId !== LANG_ID) return;
  const key = document.uri.toString();
  clearTimeout(diagnosticTimers.get(key));
  diagnosticTimers.set(key, setTimeout(() => {
    diagnosticTimers.delete(key);
    refreshDiagnostics(document);
  }, DIAGNOSTIC_DEBOUNCE_MS));
}

async function refreshDiagnostics(document) {
  if (!diagnosticCollection) return;
  if (document.languageId !== LANG_ID) return;
  if (!isFeatureEnabled(document.uri, 'enableDiagnostics')) {
    diagnosticCollection.delete(document.uri);
    return;
  }

  const docKey = document.uri.toString();
  const myRequestId = ++docRequestId;
  docRequestIds.set(docKey, myRequestId);

  const text = document.getText();
  const problems = await validateDocumentAsync(text);

  // 竞态取消：如果等待期间又有新请求，放弃这次结果
  if (docRequestIds.get(docKey) !== myRequestId) return;
  docRequestIds.delete(docKey);

  if (!problems) return;

  const seenProblems = new Set();
  const filtered = problems.filter(p => {
    const key = getDiagnosticDedupeKey(p);
    if (seenProblems.has(key)) return false;
    seenProblems.add(key);
    return true;
  });

  const diagnostics = filtered.map(p => {
    const d = new vscode.Diagnostic(
      new vscode.Range(p.line - 1, p.col, p.line - 1, p.endCol || p.col + 1),
      p.msg,
      p.severity === 'error' ? vscode.DiagnosticSeverity.Error : vscode.DiagnosticSeverity.Warning
    );
    d.source = 'syntec-macro';
    if (p.code) d.code = p.code;
    return d;
  });

  diagnosticCollection.set(document.uri, diagnostics);
}

function createInsertSemicolonAction(document, diagnostic) {
  const action = new vscode.CodeAction('补上行尾 ;', vscode.CodeActionKind.QuickFix);
  const edit = new vscode.WorkspaceEdit();
  const line = document.lineAt(diagnostic.range.start.line);
  const character = Math.min(diagnostic.range.start.character, line.text.length);
  edit.insert(document.uri, new vscode.Position(diagnostic.range.start.line, character), ';');
  action.edit = edit;
  action.diagnostics = [diagnostic];
  action.isPreferred = true;
  return action;
}

function createRemoveSemicolonAction(document, diagnostic) {
  const action = new vscode.CodeAction('移除控制结构行尾 ;', vscode.CodeActionKind.QuickFix);
  const edit = new vscode.WorkspaceEdit();
  edit.delete(document.uri, diagnostic.range);
  action.edit = edit;
  action.diagnostics = [diagnostic];
  action.isPreferred = true;
  return action;
}

function getDiagnosticText(document, diagnostic) {
  return document.getText(diagnostic.range).trim().toUpperCase();
}

function createReplacementAction(document, diagnostic, title, replacement) {
  const action = new vscode.CodeAction(title, vscode.CodeActionKind.QuickFix);
  const edit = new vscode.WorkspaceEdit();
  edit.replace(document.uri, diagnostic.range, replacement);
  action.edit = edit;
  action.diagnostics = [diagnostic];
  action.isPreferred = true;
  return action;
}

function createDeleteDiagnosticRangeAction(document, diagnostic, title) {
  const action = new vscode.CodeAction(title, vscode.CodeActionKind.QuickFix);
  const edit = new vscode.WorkspaceEdit();
  edit.delete(document.uri, diagnostic.range);
  action.edit = edit;
  action.diagnostics = [diagnostic];
  action.isPreferred = true;
  return action;
}

function createDiagnosticHelpAction(diagnostic, title, message) {
  const action = new vscode.CodeAction(title, vscode.CodeActionKind.QuickFix);
  action.command = {
    command: 'syntecMacro.showDiagnosticHelp',
    title,
    arguments: [message]
  };
  action.diagnostics = [diagnostic];
  return action;
}

function getDiagnosticHelpAction(diagnostic, entry) {
  if (typeof entry === 'string') return createDiagnosticHelpAction(diagnostic, '查看变量规则说明', entry);
  return createDiagnosticHelpAction(diagnostic, entry.title, entry.message);
}

function getDiagnosticCode(diagnostic) {
  if (typeof diagnostic.code === 'string') return diagnostic.code;
  if (diagnostic.code && typeof diagnostic.code.value === 'string') return diagnostic.code.value;
  return undefined;
}

function getUnclosedBlockKeyword(diagnostic) {
  if (diagnostic.syntecKeyword) return diagnostic.syntecKeyword;
  const match = diagnostic.message.match(/^([A-Z_]+) 块缺少对应的 END_/);
  return match ? match[1] : null;
}

function createInsertBlockCloserAction(document, diagnostic) {
  const keyword = getUnclosedBlockKeyword(diagnostic);
  const closer = BLOCK_CLOSERS[keyword];
  if (!closer) return null;

  const action = new vscode.CodeAction(`插入 ${closer}`, vscode.CodeActionKind.QuickFix);
  const edit = new vscode.WorkspaceEdit();
  const lastLine = document.lineAt(document.lineCount - 1);
  const prefix = lastLine.text.length > 0 ? '\n' : '';
  edit.insert(document.uri, lastLine.range.end, prefix + closer);
  action.edit = edit;
  action.diagnostics = [diagnostic];
  action.isPreferred = true;
  return action;
}

function getActionableDiagnostics(document, range, context) {
  // 仅使用 VSCode 已上报的诊断，避免同步调用 validateDocument 阻塞 Extension Host
  return context.diagnostics.filter(diagnostic =>
    diagnostic.source === 'syntec-macro' && getDiagnosticCode(diagnostic)
  );
}

function provideCodeActions(document, _range, context) {
  const actions = [];
  for (const diagnostic of getActionableDiagnostics(document, _range, context)) {
    const code = getDiagnosticCode(diagnostic);
    if (code === DiagnosticCode.MISSING_SEMICOLON) {
      actions.push(createInsertSemicolonAction(document, diagnostic));
    } else if (code === DiagnosticCode.CONTROL_STRUCTURE_TRAILING_SEMICOLON) {
      actions.push(createRemoveSemicolonAction(document, diagnostic));
    } else if (code === DiagnosticCode.CONTROL_UNCLOSED_BLOCK) {
      const action = createInsertBlockCloserAction(document, diagnostic);
      if (action) actions.push(action);
    } else if (code === DiagnosticCode.ROBOT_DIRECT_ARG_EQUALS) {
      actions.push(createDeleteDiagnosticRangeAction(document, diagnostic, '移除直接引数 ='));
    } else if (code === DiagnosticCode.ROBOT_DEPRECATED_MOVJ_II) {
      actions.push(createReplacementAction(document, diagnostic, '改为 MOVJ', 'MOVJ'));
    } else if (code === DiagnosticCode.ROBOT_TOOLCOR_T_ARG) {
      actions.push(createReplacementAction(document, diagnostic, '改为 P 引数', 'P'));
    } else if (code === DiagnosticCode.ROBOT_TOOLCORON_DEPRECATED) {
      actions.push(createReplacementAction(document, diagnostic, '改为 TOOLCOR', 'TOOLCOR'));
    } else if (code === DiagnosticCode.ROBOT_TOOLCOR_CLEAR) {
      actions.push(createReplacementAction(document, diagnostic, '改为 TOOLCOR P0', 'TOOLCOR P0'));
    } else if (code === DiagnosticCode.UNSUPPORTED_FANUC_COMPARISON) {
      const keyword = getDiagnosticText(document, diagnostic);
      const replacement = FANUC_COMPARISON_REPLACEMENTS[keyword];
      if (replacement) actions.push(createReplacementAction(document, diagnostic, `改为 ${replacement}`, replacement));
    } else if (code === DiagnosticCode.ASSIGNMENT_STYLE_EQUALS) {
      actions.push(createReplacementAction(document, diagnostic, '改为 :=', ':='));
    } else if (Object.prototype.hasOwnProperty.call(DIAGNOSTIC_REPLACEMENTS, code)) {
      const replacement = DIAGNOSTIC_REPLACEMENTS[code];
      if (replacement) actions.push(createReplacementAction(document, diagnostic, replacement.title, replacement.text));
    } else if (Object.prototype.hasOwnProperty.call(DIAGNOSTIC_HELP, code)) {
      actions.push(getDiagnosticHelpAction(diagnostic, DIAGNOSTIC_HELP[code]));
    }
  }
  return actions;
}

function dispose() {
  // 清理所有定时器，避免热重载后触发已 dispose 的 collection
  for (const timer of diagnosticTimers.values()) clearTimeout(timer);
  diagnosticTimers.clear();
  docRequestIds.clear();
  if (validatorWorker) {
    // 先 resolve 所有 pending，避免 promise 永挂
    for (const resolve of pendingRequests.values()) resolve(null);
    pendingRequests.clear();
    validatorWorker.terminate();
    validatorWorker = null;
  }
}

module.exports = {
  setDiagnosticCollection,
  scheduleDiagnostics,
  provideCodeActions,
  dispose
};
