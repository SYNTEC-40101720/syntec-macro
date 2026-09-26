// inlineCompletionProvider.js
// 行内补全（1.67+ InlineCompletionItemProvider）：关键字 ghost text。
//
// 定位：现有补全链路只在触发字符（./#）或 Ctrl+Space 显式调出时工作；
// 敲关键字前缀（如 USER、SYNC）不会自动出建议。本 provider 在行内
// 实时给出唯一匹配关键字的 ghost text——唯一匹配才提示（多匹配留给
// 显式补全列表，避免 ghost text 抢占选择权），Tab 采纳。
//
// 范围刻意收窄：只做关键字（数据真源 keywords.json），不碰函数
// （函数带参数 snippet，ghost text 一次全插入不合适）与 G/M 码
// （多档位歧义大）。

const vscode = require('vscode');
const { isFeatureEnabled } = require('./providerShared');

// 唯一前缀匹配的关键字缓存（getAllKeywords 顺序即优先级，取首个）
let cachedKeywords = null;
let cachedKeywordsCount = -1;

function getKeywordPrefixIndex() {
  const { getAllKeywords } = require('./keywords');
  const all = getAllKeywords();
  if (!cachedKeywords || cachedKeywordsCount !== all.length) {
    cachedKeywords = all.map(kw => [kw, kw]);
    cachedKeywordsCount = all.length;
  }
  return cachedKeywords;
}

// 行内补全主入口：行内标识符前缀 -> 唯一关键字匹配 -> ghost text
async function provideInlineCompletionItems(document, position) {
  if (!isFeatureEnabled(document.uri, 'enableCompletions')) return { items: [] };

  const line = document.lineAt(position).text;
  const textBefore = line.substring(0, position.character);

  // 行首缩进后 / 行内标识符前缀（排除带小数点的 G 码段如 G1.15——交给显式补全）
  const wordMatch = textBefore.match(/(^|\s)([A-Za-z_][A-Za-z0-9_]*)$/);
  if (!wordMatch) return { items: [] };

  const prefix = wordMatch[2].toUpperCase();
  if (prefix.length < 2) return { items: [] }; // 单字母歧义过大

  // 唯一匹配才给 ghost text；多匹配返回空（显式补全列表的场景）
  let matched = null;
  let matchCount = 0;
  for (const [kw] of getKeywordPrefixIndex()) {
    if (kw.startsWith(prefix)) {
      matchCount++;
      if (matchCount > 1) break;
      matched = kw;
    }
  }
  if (matchCount !== 1 || !matched) return { items: [] };

  const remaining = matched.slice(prefix.length);
  if (!remaining) return { items: [] }; // 已是完整关键字

  const item = new vscode.InlineCompletionItem(remaining, null);
  return {
    items: [item],
    // enableForwardStability (1.92+)：继续输入仍匹配同一关键字时保持
    // 建议，避免 ghost text 闪烁；旧引擎无此字段亦兼容
    enableForwardStability: true
  };
}

module.exports = { provideInlineCompletionItems };
