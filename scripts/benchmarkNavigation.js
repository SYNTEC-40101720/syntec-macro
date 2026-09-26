// @ts-check
// 导航基准 fixture 生成器：构造 500 文件 × 40 行的宏程序集合。
//
// R1.2 Stage B (2026-09-22): buildNavigationIndexEntry JS 路径已退役
// (navigationSymbols.js git rm)。本脚本不再有独立 CLI 入口，只作为
// tests/integration/runTest.js --navigation-benchmark 生成 VS Code
// workspace 文件的 fixture 库；真实基准由 benchmarkSuite 在 VS Code
// 内经 Rust/Wasm 后端执行（npm.cmd run test:integration:navigation）。

const FILE_COUNT = 500;
const LINES_PER_FILE = 40;

function createMacroText(fileIndex) {
  const lines = ['%@MACRO'];
  for (let lineIndex = 1; lineIndex < LINES_PER_FILE; lineIndex++) {
    if (lineIndex % 10 === 0) {
      lines.push(`N${fileIndex * 100 + lineIndex};`);
    } else if (lineIndex % 3 === 0) {
      lines.push(`G65 P${1000 + (fileIndex % 20)} A${lineIndex};`);
    } else {
      lines.push(`#1 := #1 + ${lineIndex};`);
    }
  }
  return lines.join('\n');
}

function buildFixture() {
  return Array.from({ length: FILE_COUNT }, (_, fileIndex) => ({
    filePath: `/workspace/G${String(fileIndex).padStart(4, '0')}.nc`,
    text: createMacroText(fileIndex)
  }));
}

module.exports = { FILE_COUNT, LINES_PER_FILE, buildFixture };
