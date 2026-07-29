// completionProvider.js
// 智能补全：函数、关键字、G/M 代码、变量

const vscode = require('vscode');
const { functions } = require('./functions');
const { keywords, getAllKeywords, getMCodeDesc, getKeywordDoc } = require('./keywords');
const { buildFunctionSnippet } = require('./completionSnippets');
const { isFeatureEnabled } = require('./providerShared');

const VARIABLE_COMPLETION_COUNT = 20;
const BIG_VARIABLES = [100, 500, 1000, 2000, 9901, 9902, 9903, 9904, 9905, 9906];

function provideFunctionCompletions(prefix, items) {
  for (const fn of functions) {
    if (fn.name.startsWith(prefix)) {
      const item = new vscode.CompletionItem(fn.name, vscode.CompletionItemKind.Function);
      item.detail = fn.sig;
      item.documentation = new vscode.MarkdownString('`syntec-macro\n' + fn.sig + '\n`\n\n' + fn.doc);
      item.insertText = new vscode.SnippetString(buildFunctionSnippet(fn));
      items.push(item);
    }
  }
}

function provideKeywordCompletions(prefix, items) {
  const allKeywords = getAllKeywords();
  for (const kw of allKeywords) {
    if (kw.startsWith(prefix) && kw !== 'GOTO') {
      const item = new vscode.CompletionItem(kw, vscode.CompletionItemKind.Keyword);
      const kwDoc = getKeywordDoc(kw);
      if (kwDoc) {
        item.detail = kwDoc.sig;
        item.documentation = new vscode.MarkdownString(kwDoc.doc);
      }
      items.push(item);
    }
  }
}

function provideGCodeCompletions(prefix, items) {
  if (!prefix.startsWith('G')) return;
  for (const g of keywords.gcodes) {
    if (!g.startsWith(prefix)) continue;
    const item = new vscode.CompletionItem(g, vscode.CompletionItemKind.EnumMember);
    item.detail = 'G代码';
    items.push(item);
  }
}

function provideMCodeCompletions(prefix, items) {
  if (!prefix.startsWith('M')) return;
  for (const m of keywords.mcodes) {
    if (!m.startsWith(prefix)) continue;
    const item = new vscode.CompletionItem(m, vscode.CompletionItemKind.EnumMember);
    item.detail = getMCodeDesc(m);
    items.push(item);
  }
}

function provideVariableCompletions() {
  const items = [];
  for (let i = 1; i <= VARIABLE_COMPLETION_COUNT; i++) {
    const item = new vscode.CompletionItem('#' + i, vscode.CompletionItemKind.Variable);
    item.detail = '局部变量 #' + i;
    item.insertText = String(i);
    items.push(item);
  }
  for (const v of BIG_VARIABLES) {
    const item = new vscode.CompletionItem('#' + v, vscode.CompletionItemKind.Variable);
    item.detail = '局部变量 #' + v;
    item.insertText = String(v);
    items.push(item);
  }
  return items;
}

function provideCompletionItems(document, position) {
  if (!isFeatureEnabled(document.uri, 'enableCompletions')) return [];

  const line = document.lineAt(position).text;
  const textBefore = line.substring(0, position.character);

  if (textBefore.endsWith('#')) {
    return provideVariableCompletions();
  }

  const items = [];
  const wordMatch = textBefore.match(/[A-Za-z_][A-Za-z0-9_]*$/);
  if (!wordMatch) return items;

  const prefix = wordMatch[0].toUpperCase();

  provideFunctionCompletions(prefix, items);
  provideKeywordCompletions(prefix, items);
  provideGCodeCompletions(prefix, items);
  provideMCodeCompletions(prefix, items);

  return items;
}

module.exports = { provideCompletionItems };
