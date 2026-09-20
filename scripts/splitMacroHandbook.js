#!/usr/bin/env node
// One-off Phase 4.2 splitter: slices docs/新代MACRO语法规范手册.md (3444 lines,
// 14 top-level ## sections) into 7 themed files under docs/macro-handbook/,
// then rewrites the original file as a top-level index that preserves every
// ## heading (so external anchor links do not break), with a single
// 「详见 [章节文件](path)」pointer line under each heading.
//
// Mapping (## section number -> themed file):
//   0  状态标记            -> 01-format.md
//   1  基础文件格式        -> 01-format.md
//   2  变量系统            -> 02-variables.md
//   3  运算子              -> 02-variables.md
//   4  MACRO 语法指令      -> 03-syntax.md
//   5  子程序与宏呼叫      -> 04-call.md
//   6  机器人移动指令      -> 05-robot.md
//   7  坐标系与工具系      -> 05-robot.md
//   8  应用指令            -> 05-robot.md
//   9  函数规则            -> 06-functions.md
//  10  MACRO 撰写注意事项  -> 07-notes.md
//  11  已落地规则索引      -> 07-notes.md
//  12  待落地优先级        -> 07-notes.md
//  13  待确认项            -> 07-notes.md
//  14  后续维护流程        -> 01-format.md
//
// Output themed files keep their original ## sections verbatim; each themed
// file is prefixed by a one-line header pointer back to the index. External
// anchor links (e.g. #25-公用变量--1) to the original file still resolve,
// because every ## heading is preserved in the original file (content is
// replaced by a pointer line, headings remain).

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'docs', '新代MACRO语法规范手册.md');
const OUT_DIR = path.join(ROOT, 'docs', 'macro-handbook');

// Preserve ALL heading anchors (## and ### and ####) in the index file so
// external links like `新代MACRO语法规范手册.md#25-公用变量--1` keep resolving.
// Strategy: for each ## section, copy the section verbatim into a themed file
// AND keep the same ## headline in the index file, but replace the body of
// each (sub)section in the index file with a one-line pointer to the themed file.

const SECTION_TO_FILE = {
  '0': '01-format.md',
  '1': '01-format.md',
  '2': '02-variables.md',
  '3': '02-variables.md',
  '4': '03-syntax.md',
  '5': '04-call.md',
  '6': '05-robot.md',
  '7': '05-robot.md',
  '8': '05-robot.md',
  '9': '06-functions.md',
  '10': '07-notes.md',
  '11': '07-notes.md',
  '12': '07-notes.md',
  '13': '07-notes.md',
  '14': '01-format.md'
};

const FILE_TITLE = {
  '01-format.md': '基础文件格式与状态标记',
  '02-variables.md': '变量系统与运算子',
  '03-syntax.md': 'MACRO 语法指令',
  '04-call.md': '子程序与宏呼叫',
  '05-robot.md': '机器人移动、坐标系与应用指令',
  '06-functions.md': '函数规则',
  '07-notes.md': '撰写注意事项与待确认项'
};

function main() {
  if (!fs.existsSync(SRC)) throw new Error(`Source not found: ${SRC}`);
  // IMPORTANT: This script is re-runnable. To avoid reading an already-rewritten
  // index file and producing garbage, we regenerate from a backup if present.
  const backupPath = path.join(ROOT, 'scripts', '.split-backup-handbook.md');
  let sourceText;
  let usedBackup = false;
  if (fs.existsSync(backupPath)) {
    sourceText = fs.readFileSync(backupPath, 'utf8');
    usedBackup = true;
  } else {
    sourceText = fs.readFileSync(SRC, 'utf8');
    // Stash a backup the first time so re-runs are safe.
    fs.writeFileSync(backupPath, sourceText, 'utf8');
  }
  // Detect the original EOL used by the source.
  const eol = sourceText.includes('\r\n') ? '\r\n' : '\n';
  const lines = sourceText.split(eol);

  // 1) Split into a flat list of (headingLevel, text, bodyLines[]) for EVERY
  //    heading line (## and deeper), preserving order. Heading level is the
  //    count of leading #-chars. The body of a heading is every line until the
  //    next heading (any level) or EOF. The very first # H1 title and its
  //    intro paragraphs are kept verbatim for the index header.
  const firstSectionIdx = lines.findIndex(l => /^#{2,}\s/.test(l));
  if (firstSectionIdx < 0) throw new Error('No top-level ## section found');
  const introLines = lines.slice(0, firstSectionIdx);

  const sections = []; // {level, heading, body}
  let cur = null;
  for (let i = firstSectionIdx; i < lines.length; i++) {
    const line = lines[i];
    const m = line.match(/^(#{2,})\s+(.*)$/);
    if (m) {
      if (cur) sections.push(cur);
      cur = { level: m[1].length, heading: line, body: [] };
    } else if (cur) {
      cur.body.push(line);
    }
  }
  if (cur) sections.push(cur);

  console.warn(`Parsed ${sections.length} heading sections (used backup: ${usedBackup})`);

  // 2) For each themed file: collect all sections belonging to that file.
  //    A top-level ## section determines which themed file it belongs to;
  //    any deeper subsection inherits the file from the most-recent ## section.
  const fileSections = {};
  let currentFile = null;
  for (const sec of sections) {
    if (sec.level === 2) {
      const m = sec.heading.match(/^##\s+(\d+)\./);
      if (!m) throw new Error(`Cannot parse section number: ${sec.heading}`);
      const num = m[1];
      currentFile = SECTION_TO_FILE[num];
      if (!currentFile) throw new Error(`No file mapping for section ${num}`);
    }
    if (!currentFile) throw new Error('Subsection found before any ## section');
    if (!fileSections[currentFile]) fileSections[currentFile] = [];
    fileSections[currentFile].push(sec);
  }

  // 3) Write each themed file: every heading + body verbatim.
  for (const [file, secs] of Object.entries(fileSections)) {
    const out = [];
    out.push(`> 本文件为 [新代 MACRO 语法规范手册](../新代MACRO语法规范手册.md) 的拆分子主题（${FILE_TITLE[file]}）。`);
    out.push('> 状态标记规则与维护流程见 [原手册索引 §0](../新代MACRO语法规范手册.md#0-状态标记) 与 [macro-knowledge/README](../macro-knowledge/README.md#文档分层与职责边界)。');
    out.push('');
    for (const sec of secs) {
      out.push(sec.heading);
      for (const bodyLine of sec.body) out.push(bodyLine);
      // Ensure a blank line after each section for Markdown readability.
      if (sec.body.length === 0 || sec.body[sec.body.length - 1] !== '') out.push('');
    }
    const outPath = path.join(OUT_DIR, file);
    fs.writeFileSync(outPath, out.join(eol), 'utf8');
    console.warn(`Wrote ${outPath} (${out.length} lines)`);
  }

  // 4) Rewrite the original file as a top-level index that PRESERVES EVERY
  //    heading line (so GitHub's auto-anchor for `### 2.5 公用变量 @` still
  //    resolves to the same anchor the external links expect). The body of
  //    each heading is replaced by a single pointer line to the themed file.
  const indexOut = [];
  for (const line of introLines) indexOut.push(line);
  indexOut.push('');
  indexOut.push('> **本文为顶层索引**。手册按主题聚类拆分为 7 个独立文档，便于按主题维护；全部章节标题（含 `###`/`####`）保留在本文，外部链接锚点（如 `#25-公用变量--1`）仍指向本文件的对应标题。每个章节的内容已迁移到对应主题文件，上方表格与下方章节标题均为指针。');
  indexOut.push('');
  indexOut.push('| 主题文件 | 覆盖章节 |');
  indexOut.push('| --- | --- |');
  const fileToSections = {};
  for (const sec of sections) {
    if (sec.level !== 2) continue;
    const m = sec.heading.match(/^##\s+(\d+)\./);
    const num = m[1];
    const file = SECTION_TO_FILE[num];
    if (!fileToSections[file]) fileToSections[file] = [];
    fileToSections[file].push(sec.heading.replace(/^##\s+/, ''));
  }
  for (const [file, titles] of Object.entries(fileToSections)) {
    indexOut.push(`| [${file}](macro-handbook/${file}) — ${FILE_TITLE[file]} | ${titles.join('、')} |`);
  }
  indexOut.push('');

  // Now preserve EVERY heading line in document order; replace the body with
  // a pointer line. Only top-level (##) headings get a pointer to the themed
  // file; deeper ### / #### headings are kept as empty anchors (their bodies
  // are also moved into the themed file, but the anchor must still resolve).
  // To keep external deep anchors working, we keep the heading text and replace
  // its body with a single pointer line only if the heading is the topmost of
  // its branch, otherwise leave empty body. In practice GitHub anchors are
  // generated from the heading TEXT regardless of body, so simply keeping the
  // heading lines (with a short body) is enough.
  let lastFile = null;
  for (const sec of sections) {
    indexOut.push(sec.heading);
    if (sec.level === 2) {
      const m = sec.heading.match(/^##\s+(\d+)\./);
      const num = m[1];
      const file = SECTION_TO_FILE[num];
      lastFile = file;
      indexOut.push('');
      indexOut.push(`详见 [${FILE_TITLE[file]}](macro-handbook/${file})。`);
      indexOut.push('');
    } else {
      // Deeper subsection: keep heading as anchor, but do not duplicate content.
      // Provide a brief pointer so readers know where the full content lives.
      indexOut.push('');
      if (lastFile) {
        indexOut.push(`内容已迁移到 [${FILE_TITLE[lastFile]}](macro-handbook/${lastFile})。`);
        indexOut.push('');
      }
    }
  }

  fs.writeFileSync(SRC, indexOut.join(eol), 'utf8');
  console.warn(`Rewrote index ${SRC} (${indexOut.length} lines)`);
}

main();
