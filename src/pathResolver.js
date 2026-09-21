// @ts-check
// pathResolver.js
// Host-only 文件路径/元数据辅助 helper 集合 (R1.2 Stage B §2.3 新建, 2026-09-22).
//
// 用途: 给 host 层 `rustWasmAdapter.js` / `definitionProvider.js` 提供
// 跨 macro 文件的元数据访问, 不依赖即将 R1.2 剔除的 `navigationSymbols.js`
// / `fileResolver.js` 中的 analyzer 行为部分 (但保留 host 元数据访问).
//
// 当前实现策略 (过渡期): 暂时从 `navigationSymbols.js` / `fileResolver.js`
// re-export 既有实现, 让 `rustWasmAdapter` 等仅依赖 `pathResolver` 这个
// 稳定符号。R1.2 Stage B `git rm navigationSymbols.js` / `fileResolver.js`
// (如最终判定不保留) 时, 在本文件内 inline host-only 实现, 不再 re-export.
//
// 保留判定: fileResolver.js 中的 path helper (buildFileCandidates /
//   normalizeProgramName / normalizeSubprogramName / MACRO_FILE_EXTENSIONS)
//   实际是 host 元数据访问, 不是 analyzer 行为, 因此 fileResolver.js
//   整体保留可能性高 (参见 docs/R1.2-实施方案.md §1d).
//
// 测试覆盖见 tests/extension.test.js 对 navigationSymbols.js 的 4 函数断言
// (R1.2 Stage B 完成后这些断言改 require pathResolver 而非 navigationSymbols).

const {
  extractNavigationSymbols,
  getMacroProgramName,
  getProgramEntryName,
  isMacroFileContent
} = require('./navigationSymbols');

const {
  MACRO_FILE_EXTENSIONS,
  normalizeProgramName,
  normalizeSubprogramName,
  buildFileCandidates
} = require('./fileResolver');

module.exports = {
  // 元数据 helper (host-only, 来自 navigationSymbols — R1.2 Stage B §2.12 后 inline)
  extractNavigationSymbols,
  getMacroProgramName,
  getProgramEntryName,
  isMacroFileContent,
  // path helper (host-only, 来自 fileResolver — §1d 判定为整体保留)
  MACRO_FILE_EXTENSIONS,
  normalizeProgramName,
  normalizeSubprogramName,
  buildFileCandidates
};
