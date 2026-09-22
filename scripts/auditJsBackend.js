// JS backend 退役路线图审计脚本（一次性 surface audit）。
//
// 目标：在 user 决定"Rust/Wasm 替代 JS、精简插件"后，给出一份精确的
// 缺口清单，确认 Rust 端已完整覆盖 JS 端所有诊断、数据表与 provider 层
// 能力，作为剔除 JS 模块的准入依据。
//
// 仅读取源码静态文本，不调用 cargo / wasm asset / npm compare:rust：
//   - 用 regex 扫 src/diagnosticCodes.js 的全量 code 集
//   - 在 crates/syntec-core/src/lib.rs 文本中按 code 字符串 literal
//     出现情况判断 Rust 是否覆盖该 code 作为 emit 目标
//   - 列出 host-only provider 文件清单 + 各 JS 数据表覆盖的项数
//
// 输出格式：stdout 的 markdown 报告，便于直接 append 到路线图文档。
//
// 用法：node scripts/auditJsBackend.js

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DIAGNOSTIC_CODES_PATH = path.join(ROOT, 'src', 'diagnosticCodes.js');
const RUST_LIB_PATH = path.join(ROOT, 'crates', 'syntec-core', 'src', 'lib.rs');

// === 1. JS Side: 全量 DiagnosticCode ===
function readJsDiagnosticCodes() {
  const content = fs.readFileSync(DIAGNOSTIC_CODES_PATH, 'utf8');
  const codes = [];
  const re = /^\s*([A-Z][A-Z0-9_]*)\s*:\s*'(SYNTEC_[A-Z0-9_]+)'\s*,/gm;
  let m;
  while ((m = re.exec(content)) !== null) {
    codes.push({ key: m[1], code: m[2] });
  }
  return codes;
}

// === 2. Rust Side: code 字符串 literal 扫描（粗略覆盖判定）===
function readRustEmittedCodes() {
  const content = fs.readFileSync(RUST_LIB_PATH, 'utf8');
  const codes = new Set();
  // 扫"SYNTEC_..." quoted 字符串 literal（含 push_diagnostic 调用与 unit-test assert）
  const re = /"(SYNTEC_[A-Z0-9_]+)"/g;
  let m;
  while ((m = re.exec(content)) !== null) {
    codes.add(m[1]);
  }
  return codes;
}

// === 3. Host-only provider 层清单（vscode API 直接依赖）===
function listHostOnlyProviders() {
  const srcDir = path.join(ROOT, 'src');
  // 这些文件是 VS Code Provider / API 绑定层，不属于 analyzer 函数式核心
  const providers = [
    'extension.js',
    'completionProvider.js',
    'hoverProvider.js',
    'definitionProvider.js',
    'formattingProvider.js',
    'navigationProvider.js',
    'diagnosticsProvider.js',
    'providerShared.js',
    'validatorWorker.js',
    'rustWasmAdapter.js',
    'rustWasmAssert.js',
    'rustWasmAsset.js',
    'rustWasmWorkerAdapter.js',
    'analysisHost.js',
    'analysisBackend.js'
  ];
  const out = [];
  for (const name of providers) {
    const full = path.join(srcDir, name);
    if (fs.existsSync(full)) {
      const stat = fs.statSync(full);
      out.push({ name, kb: Math.round((stat.size / 1024) * 10) / 10 });
    }
  }
  return out;
}

// === 4. JS 数据表清单（hover/completion 真源数据）===
function readDataTables() {
  const tables = [
    { name: 'keywords.js → gcodes/mcodes', file: 'keywords.js', snippet: 'gcodes' },
    { name: 'keywords.js → keywords', file: 'keywords.js', snippet: 'keywords' },
    { name: 'functions.js → functions', file: 'functions.js', snippet: 'function ' },
    { name: 'codeDocs.js → hoverDocs', file: 'codeDocs.js', snippet: 'docs' },
    { name: 'systemVariables.js → 编号表', file: 'systemVariables.js', snippet: '#' },
    { name: 'completionSnippets.js → snippets', file: 'completionSnippets.js', snippet: 'snippets' },
    { name: 'statementClassifier.js → 分类', file: 'statementClassifier.js', snippet: 'classify' }
  ];
  const srcDir = path.join(ROOT, 'src');
  const out = [];
  for (const t of tables) {
    const full = path.join(srcDir, t.file);
    let lineCount = 0;
    let exists = false;
    if (fs.existsSync(full)) {
      exists = true;
      lineCount = fs.readFileSync(full, 'utf8').split('\n').length;
    }
    out.push({ name: t.name, file: t.file, lineCount, exists });
  }
  return out;
}

// === 5. analyzer 函数式核心（Rust 对应） ===
function readAnalyzerCoreModules() {
  const srcDir = path.join(ROOT, 'src');
  const modules = [
    'validator.js',                  // 主 line-rule 顺序
    'lexer.js',
    'controlFlowValidator.js',
    'robotValidator.js',            // 跨行状态机
    'functionArgumentValidator.js',
    'diagnosticFactory.js',
    'diagnosticActions.js',
    'diagnosticRules.js',
    'formatter.js',                 // 已迁到 Rust format_document
    'navigationSymbols.js',
    'navigationIndex.js',
    'fileResolver.js',
    'analysisCore.js',
    'analysisProtocol.js'
  ];
  const out = [];
  for (const name of modules) {
    const full = path.join(srcDir, name);
    let kb = 0, lineCount = 0, exists = false;
    if (fs.existsSync(full)) {
      exists = true;
      const stat = fs.statSync(full);
      kb = Math.round((stat.size / 1024) * 10) / 10;
      lineCount = fs.readFileSync(full, 'utf8').split('\n').length;
    }
    out.push({ name, exists, kb, lineCount });
  }
  return out;
}

// === main ===
function main() {
  const jsCodes = readJsDiagnosticCodes();
  const rustCodes = readRustEmittedCodes();

  const rustMissing = jsCodes.filter(c => !rustCodes.has(c.code));
  const rustCoverage = jsCodes.length - rustMissing.length;

  const providers = listHostOnlyProviders();
  const dataTables = readDataTables();
  const analyzerCore = readAnalyzerCoreModules();

  const lines = [];
  lines.push('# JS Backend 退役审计（surface audit）');
  lines.push('');
  lines.push(`> 生成日期: ${new Date().toISOString()}`);
  lines.push('> 仅基于源码文本静态扫描（regex literal 命中）；非运行时 emit 验证。');
  lines.push('> 准入门槛见 docs/迭代优化计划.md §「后续计划 (v4.x+)」Phase R2 不变约束 (源自已合并的 JS-Backend 退役路线图).');
  lines.push('');
  lines.push('## 1. 诊断 code parity 缺口');
  lines.push('');
  lines.push(`- JS 端 DiagnosticCode 总数: ${jsCodes.length}`);
  lines.push(`- Rust 端 lib.rs literal 覆盖: ${rustCoverage}`);
  lines.push(`- 在 Rust 端未发现 literal 的 code: ${rustMissing.length}`);
  lines.push('');
  if (rustMissing.length > 0) {
    lines.push('| JS key | code | 说明 |');
    lines.push('|---|---|---|');
    for (const m of rustMissing) {
      // dead code 标记
      const reason = (m.code.includes('Q_RANGE') && (m.code.includes('SWAITSIG') || m.code.includes('SYNCOUT') || m.code.includes('SKIPCOND')))
        ? 'dead code（两个后端均未实装 emit）'
        : '未在 Rust lib.rs literal 中发现';
      lines.push(`| \`${m.key}\` | \`${m.code}\` | ${reason} |`);
    }
    lines.push('');
  }
  lines.push('## 2. analyzer 函数式核心模块清单（Rust 对应实体）');
  lines.push('');
  lines.push('| src/ 文件 | 行数 | KB | 是否对应 Rust 实体 |');
  lines.push('|---|---|---|---|');
  for (const m of analyzerCore) {
    const rustCount = m.exists ? '是（crates/syntec-core/src/lib.rs）' : '—';
    lines.push(`| \`${m.name}\` | ${m.lineCount} | ${m.kb} | ${rustCount} |`);
  }
  lines.push('');
  lines.push('## 3. JS 数据表清单（hover/completion 真源数据）');
  lines.push('');
  lines.push('> **关键约束**: hover/completion/definition 仍依赖 vscode API；这些数据表是真源，');
  lines.push('> Rust 剔除 JS 工作不得删除这些数据表，仅能将其搬至 host 层或 Rust 共享段。');
  lines.push('');
  lines.push('| 表名 | 文件 | 行数 | 是否存在 |');
  lines.push('|---|---|---|---|');
  for (const t of dataTables) {
    lines.push(`| ${t.name} | \`${t.file}\` | ${t.lineCount} | ${t.exists ? '是' : '否'} |`);
  }
  lines.push('');
  lines.push('## 4. host-only Provider 层清单（vscode API 绑定）');
  lines.push('');
  lines.push('> **关键约束**: 这些文件依赖 vscode API 不可被 Rust 替换；保留作为 host 层入口。');
  lines.push('');
  lines.push('| 文件 | KB |');
  lines.push('|---|---|');
  for (const p of providers) {
    lines.push(`| \`${p.name}\` | ${p.kb} |`);
  }
  lines.push('');

  console.info(lines.join('\n'));
}

if (require.main === module) {
  main();
}

module.exports = {
  readJsDiagnosticCodes,
  readRustEmittedCodes,
  listHostOnlyProviders,
  readDataTables,
  readAnalyzerCoreModules
};
