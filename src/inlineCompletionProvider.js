// inlineCompletionProvider.js
// 行内补全（1.67+ InlineCompletionItemProvider）：关键字 ghost text。
//
// 定位：现有补全链路只在触发字符（./#）或 Ctrl+Space 显式调出时工作；
// 敲关键字前缀（如 USER、SYNC）不会自动出建议。本 provider 在行内
// 实时给出关键字前缀匹配的 ghost text，Tab 采纳、继续输入切换候选。
//
// 策略：多匹配返回最多 3 条候选（VS Code 行内 UI 负责切换/展示，
// 不抢占显式补全列表场景）；唯一匹配时单条直达。61 个关键字全部
// 可达（唯一匹配直达 35 个，多匹配经候选列表可达 26 个）。
//
// 范围刻意收窄：只做关键字（数据真源 keywords.json），不碰函数
// （函数带参数 snippet，ghost text 一次全插入不合适）与 G/M 码
// （多档位歧义大）。

const vscode = require('vscode');
const { isFeatureEnabled } = require('./providerShared');

const MAX_CANDIDATES = 3;

// 关键字缓存（getAllKeywords 顺序即优先级）
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

// 行内补全主入口：行内标识符前缀 -> 关键字前缀匹配 -> ghost text 候选
async function provideInlineCompletionItems(document, position) {
  if (!isFeatureEnabled(document.uri, 'enableCompletions')) return { items: [] };

  const line = document.lineAt(position).text;
  const textBefore = line.substring(0, position.character);

  // 行首缩进后 / 行内标识符前缀（排除带小数点的 G 码段如 G1.15——交给显式补全）
  const wordMatch = textBefore.match(/(^|\s)([A-Za-z_][A-Za-z0-9_]*)$/);
  if (!wordMatch) return { items: [] };

  const prefix = wordMatch[2].toUpperCase();
  if (prefix.length < 2) return { items: [] }; // 单字母歧义过大

  // 前缀匹配候选（表顺序即优先级），完整词跳过——已是完整关键字时剩余为空
  const items = [];
  for (const [kw] of getKeywordPrefixIndex()) {
    if (!kw.startsWith(prefix)) continue;
    const remaining = kw.slice(prefix.length);
    if (!remaining) continue;
    items.push(new vscode.InlineCompletionItem(remaining, null));
    if (items.length >= MAX_CANDIDATES) break;
  }

  return {
    items,
    // enableForwardStability (1.92+)：继续输入仍命中候选时保持建议，
    // 避免候选列表闪烁；旧引擎无此字段亦兼容
    enableForwardStability: true
  };
}

module.exports = { provideInlineCompletionItems };
