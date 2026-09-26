// tests/helpers/vscodeMock.js
// 轻量 VS Code API mock，让 completionProvider/hoverProvider/definitionProvider/
// formattingProvider 等可在 node --test 下跑 unit，不依赖 @vscode/test-electron。
//
// 范围：覆盖 4 个 Provider 实际用到的 vscode API 表面：
//   Position / Range / Location / Uri / CompletionItem / MarkdownString /
//   SnippetString / Hover / TextEdit / CompletionItemKind / workspace.getConfiguration
//
// 不在范围内（暂未 mock）：DiagnosticCollection / workspace.textDocuments /
// workspace.findFiles / workspace.createFileSystemWatcher / CodeAction /
// WorkspaceEdit / window / commands / languages / EventEmitter / StatusBarAlignment
// 这些属于 host 端 (diagnosticsProvider/navigationProvider/extension.js) 职责，
// 在 Phase 3 后续 step 再按需扩展。

'use strict';

/**
 * Position mock：line/character number pair，镜像 vscode.Position 的字段读写。
 */
class Position {
  constructor(line, character) {
    this.line = line;
    this.character = character;
  }

  isBefore(other) {
    return this.line < other.line || (this.line === other.line && this.character < other.character);
  }

  isAfter(other) {
    return other.isBefore(this);
  }

  isEqual(other) {
    return this.line === other.line && this.character === other.character;
  }
}

/**
 * Range mock：start/end Position pair。
 */
class Range {
  constructor(startLine, startChar, endLine, endChar) {
    if (startLine instanceof Position) {
      this.start = startLine;
      this.end = startChar;
    } else {
      this.start = new Position(startLine, startChar);
      this.end = new Position(endLine, endChar);
    }
  }

  get isEmpty() {
    return this.start.isEqual(this.end);
  }

  contains(positionOrRange) {
    const pos = positionOrRange instanceof Position ? positionOrRange : positionOrRange.start;
    return !this.start.isAfter(pos) && !this.end.isBefore(pos);
  }
}

/**
 * Uri mock：scheme + fsPath + toString；支持 Uri.file 与 Uri.parse。
 */
class Uri {
  constructor(scheme, path) {
    this.scheme = scheme;
    this.fsPath = path;
    this._path = path;
  }

  toString() {
    return `${this.scheme}://${this._path.replace(/^\//, '')}`;
  }

  static file(fsPath) {
    return new Uri('file', fsPath.replace(/\\/g, '/'));
  }

  static parse(value) {
    const match = /^([a-z]+):\/\/(.*)$/.exec(value);
    if (!match) return new Uri('file', value);
    return new Uri(match[1], match[2]);
  }

  // joinPath (1.31+)：extension.js 定位 VSIX 内诊断文档用
  static joinPath(base, ...segments) {
    let p = base._path.replace(/\/+$/, '');
    for (const seg of segments) {
      p = p.replace(/\/+$/, '') + '/' + seg.replace(/^\/+/, '');
    }
    return new Uri(base.scheme, p);
  }
}

/**
 * Location mock：uri + range。
 */
class Location {
  constructor(uri, rangeOrPosition) {
    this.uri = uri;
    this.range = rangeOrPosition instanceof Position ? new Range(rangeOrPosition, rangeOrPosition) : rangeOrPosition;
  }
}

/**
 * CompletionItem mock：label + kind + 可写字段 detail/documentation/insertText。
 */
class CompletionItem {
  constructor(label, kind) {
    this.label = label;
    this.kind = kind;
    this.detail = undefined;
    this.documentation = undefined;
    this.insertText = label;
  }
}

/**
 * MarkdownString mock：appendCodeblock + appendMarkdown 累积 value。
 */
class MarkdownString {
  constructor(value = '') {
    this.value = value;
  }

  appendCodeblock(code, language) {
    const fence = '```' + (language || '');
    this.value += `\n${fence}\n${code}\n\`\`\`\n`;
    return this;
  }

  appendMarkdown(text) {
    this.value += text;
    return this;
  }
}

/**
 * SnippetString mock：记录 snippet 字面量字符串。
 */
class SnippetString {
  constructor(value = '') {
    this.value = value;
  }
}

/**
 * Hover mock：contents + range。
 */
class Hover {
  constructor(contents, range) {
    this.contents = Array.isArray(contents) ? contents : [contents];
    this.range = range;
  }
}

/**
 * TextEdit mock：range + newText，支持 TextEdit.replace 静态构造。
 */
class TextEdit {
  constructor(range, newText) {
    this.range = range;
    this.newText = newText;
  }

  static replace(range, newText) {
    return new TextEdit(range, newText);
  }
}

/**
 * CompletionItemKind 子集：与 completionProvider.js 实际使用项对齐。
 */
const CompletionItemKind = {
  Function: 3,
  Keyword: 1,
  EnumMember: 17,
  Variable: 21
};

/**
 * Disposable mock：仅需调 dispose 时回调。
 */
class Disposable {
  constructor(callOnDispose) {
    this._callOnDispose = callOnDispose;
    this._disposed = false;
  }

  dispose() {
    if (this._disposed) return;
    this._disposed = true;
    if (typeof this._callOnDispose === 'function') {
      this._callOnDispose();
    }
  }
}

/**
 * languages mock：register*Provider / createDiagnosticCollection 等均记在 calls
 */
const languages = {
  _calls: [],
  _resetCalls() {
    languages._calls = [];
  },
  registerCompletionItemProvider(selector, provider) {
    languages._calls.push({ kind: 'registerCompletionItemProvider', selector, provider });
    return new Disposable(() => {});
  },
  registerHoverProvider(selector, provider) {
    languages._calls.push({ kind: 'registerHoverProvider', selector, provider });
    return new Disposable(() => {});
  },
  registerDefinitionProvider(selector, provider) {
    languages._calls.push({ kind: 'registerDefinitionProvider', selector, provider });
    return new Disposable(() => {});
  },
  registerDocumentSymbolProvider(selector, provider) {
    languages._calls.push({ kind: 'registerDocumentSymbolProvider', selector, provider });
    return new Disposable(() => {});
  },
  registerWorkspaceSymbolProvider(provider) {
    languages._calls.push({ kind: 'registerWorkspaceSymbolProvider', provider });
    return new Disposable(() => {});
  },
  registerReferenceProvider(selector, provider) {
    languages._calls.push({ kind: 'registerReferenceProvider', selector, provider });
    return new Disposable(() => {});
  },
  registerDocumentFormattingEditProvider(selector, provider) {
    languages._calls.push({ kind: 'registerDocumentFormattingEditProvider', selector, provider });
    return new Disposable(() => {});
  },
  // LanguageStatusItem (1.65+)：extension.js 语言状态项入口
  createLanguageStatusItem(id, selector) {
    languages._calls.push({ kind: 'createLanguageStatusItem', id, selector });
    return {
      id,
      selector,
      name: '',
      text: '',
      detail: '',
      command: undefined,
      dispose() {}
    };
  },
  createDiagnosticCollection(name) {
    languages._calls.push({ kind: 'createDiagnosticCollection', name });
    return new DiagnosticCollectionMock(name);
  },
  registerCodeActionsProvider(selector, provider, options) {
    languages._calls.push({ kind: 'registerCodeActionsProvider', selector, provider, options });
    return new Disposable(() => {});
  }
};

/**
 * DiagnosticCollection mock：set/delete/forEach/clear/some 不限制 dtype。
 */
class DiagnosticCollectionMock {
  constructor(name) {
    this.name = name;
    this._docs = new Map();
    this._disposed = false;
  }

  set(uri, diagnostics) {
    this._docs.set(uri.toString(), { uri, diagnostics });
  }

  delete(uri) {
    return this._docs.delete(uri.toString());
  }

  clear() {
    this._docs.clear();
  }

  forEach(callback) {
    for (const { uri, diagnostics } of this._docs.values()) {
      callback(uri, diagnostics, this);
    }
  }

  get(uri) {
    return this._docs.get(uri.toString());
  }

  has(uri) {
    return this._docs.has(uri.toString());
  }

  dispose() {
    this._disposed = true;
    this.clear();
  }
}

/**
 * commands mock：registerCommand 记录调用，返回空 Disposable。
 */
const commands = {
  _calls: [],
  _resetCalls() {
    commands._calls = [];
  },
  registerCommand(commandId, handler) {
    commands._calls.push({ commandId, handler });
    return new Disposable(() => {});
  }
};

/**
 * Event mock：onDidChange* 钩子 (extension.js 调用 onDidChangeTextDocument 等)。
 */
class EventEmitter {
  constructor() {
    this._listeners = [];
  }

  event(listener) {
    this._listeners.push(listener);
    return new Disposable(() => this._remove(listener));
  }

  fire(change) {
    for (const listener of this._listeners) {
      listener(change);
    }
  }

  _remove(listener) {
    const i = this._listeners.indexOf(listener);
    if (i >= 0) this._listeners.splice(i, 1);
  }

  dispose() {
    this._listeners = [];
  }
}

/**
 * window mock：createStatusBarItem/showInformationMessage 等。
 */
class StatusBarItem {
  constructor(alignment, priority) {
    this.alignment = alignment;
    this.priority = priority;
    this.text = '';
    this.tooltip = '';
    this._shown = false;
    this._disposed = false;
  }

  show() {
    this._shown = true;
  }

  hide() {
    this._shown = false;
  }

  dispose() {
    this._disposed = true;
  }
}

const window = {
  _calls: { showInformationMessage: [], createOutputChannel: [] },
  _resetCalls() {
    window._calls.showInformationMessage = [];
    window._calls.createOutputChannel = [];
  },
  createStatusBarItem(alignment, priority) {
    return new StatusBarItem(alignment, priority);
  },
  createOutputChannel(name) {
    window._calls.createOutputChannel.push(name);
    const lines = [];
    return {
      name,
      appendLine(line) { lines.push(line); },
      _lines: lines,
      dispose() {}
    };
  },
  showInformationMessage(message) {
    window._calls.showInformationMessage.push(message);
    return Promise.resolve();
  }
};

/** * CodeAction mock：title + kind + edit/diagnostics/isPreferred 字段可写。
 */
class CodeAction {
  constructor(title, kind) {
    this.title = title;
    this.kind = kind;
    this.edit = undefined;
    this.diagnostics = undefined;
    this.isPreferred = false;
    this.command = undefined;
  }
}

/**
 * WorkspaceEdit mock：set/insert/delete 记录操作，不真正修改文档。
 */
class WorkspaceEdit {
  constructor() {
    this._ops = [];
  }

  set(uri, edits) {
    this._ops.push({ kind: 'set', uri, edits });
  }

  replace(uri, range, newText) {
    this._ops.push({ kind: 'replace', uri, range, newText });
  }

  insert(uri, position, newText) {
    this._ops.push({ kind: 'insert', uri, position, newText });
  }

  delete(uri, range) {
    this._ops.push({ kind: 'delete', uri, range });
  }
}

/** * 枚举常量：CodeActionKind \u4e0e StatusBarAlignment
 */
const CodeActionKind = {
  QuickFix: { kind: 'quickfix', value: 'quickfix' }
};

const StatusBarAlignment = {
  Left: 1,
  Right: 2
};

/**
 * workspace.getConfiguration mock：返回 syntecMacro.* 配置，默认 enable* 为 true。
 */
const workspace = {
  getConfiguration(section, _resource) {
    const store = {
      syntecMacro: {
        enableDiagnostics: true,
        enableCompletions: true,
        enableHover: true,
        includePath: []
      }
    };
    return {
      get(key, defaultValue) {
        const sect = store[section] || {};
        const value = sect[key];
        return value === undefined ? defaultValue : value;
      },
      has(key) {
        const sect = store[section] || {};
        return key in sect;
      },
      inspect() {
        return {};
      },
      update() {
        return Promise.resolve();
      }
    };
  },

  /** workspace.getWorkspaceFolder(uri) mock：返回 uri.fsPath 根目录。 */
  getWorkspaceFolder(uri) {
    return { uri, name: '', index: 0 };
  },

  /** workspace.textDocuments mock：默认空数组。 */
  textDocuments: [],

  /** workspace.onDidChangeTextDocument mock：返回空 Disposable。 */
  onDidChangeTextDocument() {
    return new Disposable(() => {});
  },

  /** workspace.onDidOpenTextDocument mock：返回空 Disposable。 */
  onDidOpenTextDocument() {
    return new Disposable(() => {});
  },

  /** workspace.onDidChangeConfiguration mock：返回空 Disposable。 */
  onDidChangeConfiguration() {
    return new Disposable(() => {});
  }
};

/**
 * 进程级 vscode mock 对象：把所有类与 workspace 暴露在同一接口。
 */
const vscodeMock = {
  Position,
  Range,
  Location,
  Uri,
  CompletionItem,
  MarkdownString,
  SnippetString,
  Hover,
  TextEdit,
  CompletionItemKind,
  Disposable,
  DiagnosticCollectionMock,
  EventEmitter,
  StatusBarItem,
  StatusBarAlignment,
  CodeAction,
  CodeActionKind,
  WorkspaceEdit,
  languages,
  commands,
  window,
  workspace
};

// `installVscodeMock` 重建 workspace 时的副本原版，避免测试用例
// 直接修改 vscode.workspace 的字段后污染下一个用例。
const defaultWorkspace = { ...workspace };

/**
 * 把 mock 注入到 Node 的模块解析路径，使 `require('vscode')` 返回 mock。
 *
 * `vscode` 是 VS Code Extension Host 在运行时通过 globals 注入的 native 全局
 * 模块，node --test 下 require.resolve('vscode') 会抛 MODULE_NOT_FOUND；
 * 同时 Node 的 `require.cache` key 用 resolved filename 而不是模块 id，
 * 直接写 `require.cache['vscode']` 不会命中 require 路径。
 * 因此这里 patch `Module._load`：当 request === 'vscode' 时直接返回 mock。
 *
 * 每次调用 installVscodeMock 都会重新构造一个组合对象（含**新的**
 * `workspace` 引用），避免前一个测试用例覆盖了 `vscode.workspace.getConfiguration`
 * 之后被后续测试用例继承污染。这意味着：测试中临时覆盖 `workspace.*` 字段
 * 不会影响下一个测试用例——因为本应 `installVscodeMock()` 重建。
 *
 * @param {object} [overrides] 额外覆盖字段（如 workspace.textDocuments）
 * @returns {object} mock 对象
 */
function installVscodeMock(overrides = {}) {
  // 重建 workspace（避免上一个测试覆盖 getConfiguration 后被继承）
  const freshWorkspace = { ...defaultWorkspace, ...(overrides.workspace || {}) };
  // 重置 languages/commands/window 内部 _calls 状态。
  // languages/commands/window 是模块顶层常量对象，installVscodeMock 不复制它们，
  // 保证测试模块 require 出来的同名常量与 vscode.languages 仍是同一引用。
  languages._resetCalls();
  commands._resetCalls();
  window._resetCalls();
  const combined = { ...vscodeMock, ...overrides, workspace: freshWorkspace };
  const Module = require('module');
  const originalLoad = Module._load;
  if (!Module.__syntecVscodeMockInstalled) {
    Module._load = function patchedLoad(request, _parent, _isMain) {
      if (request === 'vscode') {
        if (Module.__syntecVscodeMock) return Module.__syntecVscodeMock;
      }
      return originalLoad.apply(this, arguments);
    };
    Module.__syntecVscodeMockInstalled = true;
  }
  Module.__syntecVscodeMock = combined;
  return combined;
}

/**
 * 卸载 mock：恢复原始 Module._load，让 require('vscode') 抛 MODULE_NOT_FOUND
 * （测试环境下 native vscode 模块不存在）。
 */
function uninstallVscodeMock() {
  const Module = require('module');
  Module.__syntecVscodeMock = null;
}

module.exports = {
  vscodeMock,
  installVscodeMock,
  uninstallVscodeMock,
  Position,
  Range,
  Location,
  Uri,
  CompletionItem,
  MarkdownString,
  SnippetString,
  Hover,
  TextEdit,
  CompletionItemKind,
  Disposable,
  DiagnosticCollectionMock,
  EventEmitter,
  StatusBarItem,
  StatusBarAlignment,
  CodeAction,
  CodeActionKind,
  WorkspaceEdit,
  languages,
  commands,
  window,
  workspace
};
